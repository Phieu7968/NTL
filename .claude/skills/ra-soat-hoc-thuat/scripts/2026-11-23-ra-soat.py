#!/usr/bin/env python3
"""Rà soát bài học thuật tiếng Việt / tiếng Anh.

Lệnh con:
  trich-xuat   In văn bản đã tách đoạn (để Claude đọc)
  cau-truc     Kiểm tra cấu trúc bắt buộc + đánh số chương, mục, bảng, hình
  trich-dan    Kiểm tra trích dẫn APA / IEEE và danh mục tài liệu tham khảo
  chinh-ta     Rà lỗi chính tả, dấu câu, khoảng trắng, bảng mã (heuristic)
  trung-lap    So khớp trùng lặp với các tài liệu nguồn (n-gram)
  cau-dac-trung  Chọn câu đặc trưng để tìm trên web
  tat-ca       Chạy cau-truc + trich-dan + chinh-ta, ghi báo cáo Markdown

Chỉ dùng thư viện chuẩn của Python (pdftotext / pypdf là tuỳ chọn cho PDF).
Mọi kết quả là CẢNH BÁO để người rà soát xem lại, không phải kết luận cuối cùng.
"""
import argparse
import datetime
import json
import re
import subprocess
import sys
import unicodedata
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
VN_UPPER = "A-ZÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬĐÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴ"
UP = f"[{VN_UPPER}]"
NAME_TOKEN = f"{UP}[\\w'’\\-]*"
YEAR = r"(?:1[89]\d{2}|20\d{2})[a-z]?|n\.d\.|k\.n\.|in press|đang in"


# ---------------------------------------------------------------- đọc tệp
class Para:
    __slots__ = ("idx", "text", "style", "numbered", "in_table")

    def __init__(self, idx, text, style="", numbered=False, in_table=False):
        self.idx, self.text, self.style = idx, text, style
        self.numbered, self.in_table = numbered, in_table


def _docx_styles(z):
    names = {}
    try:
        root = ET.fromstring(z.read("word/styles.xml"))
    except KeyError:
        return names
    for st in root.iter(W + "style"):
        sid = st.get(W + "styleId")
        nm = st.find(W + "name")
        if sid:
            names[sid] = nm.get(W + "val") if nm is not None else sid
    return names


def read_docx(path):
    with zipfile.ZipFile(path) as z:
        styles = _docx_styles(z)
        root = ET.fromstring(z.read("word/document.xml"))
    body = root.find(W + "body")
    paras = []

    def walk(node, in_table):
        for child in node:
            if child.tag == W + "p":
                parts = []
                for el in child.iter():
                    if el.tag == W + "t" and el.text:
                        parts.append(el.text)
                    elif el.tag == W + "tab":
                        parts.append("\t")
                    elif el.tag in (W + "br", W + "cr"):
                        parts.append(" ")
                ppr = child.find(W + "pPr")
                style, numbered = "", False
                if ppr is not None:
                    ps = ppr.find(W + "pStyle")
                    if ps is not None:
                        style = styles.get(ps.get(W + "val"), ps.get(W + "val"))
                    numbered = ppr.find(W + "numPr") is not None
                    if ppr.find(W + "outlineLvl") is not None and not style:
                        style = "outline"
                paras.append(Para(len(paras), "".join(parts), style, numbered, in_table))
            elif child.tag == W + "tbl":
                for row in child.iter(W + "tc"):
                    walk(row, True)
            elif child.tag == W + "sdt":
                content = child.find(W + "sdtContent")
                if content is not None:
                    walk(content, in_table)
    walk(body, False)
    return paras


def read_pdf(path):
    text = ""
    try:
        text = subprocess.run(["pdftotext", "-enc", "UTF-8", str(path), "-"],
                              capture_output=True, text=True, check=True).stdout
    except (OSError, subprocess.CalledProcessError):
        try:
            import pypdf
            text = "\n\n".join(p.extract_text() or "" for p in pypdf.PdfReader(str(path)).pages)
        except Exception as e:  # noqa: BLE001
            sys.exit(f"Không đọc được PDF: {e}")
    paras = []
    for block in re.split(r"\n\s*\n|\f", text):
        lines = [ln.strip() for ln in block.splitlines() if ln.strip()]
        if not lines:
            continue
        width = max(len(ln) for ln in lines)
        joined, prev_head, prev = "", False, ""
        for ln in lines:
            head = _pdf_heading_line(ln)
            short_end = prev and len(prev) < 0.7 * width and prev.endswith((".", ":", "!", "?"))
            if joined and (head or prev_head or short_end or re.match(r"^\[\d+\]\s", ln)):
                paras.append(Para(len(paras), joined))
                joined = ""
            if joined.endswith("-") and ln[:1].islower():
                joined = joined[:-1] + ln
            else:
                joined = (joined + " " + ln).strip()
            prev_head, prev = head, ln
        if joined:
            paras.append(Para(len(paras), joined))
    return paras


def _pdf_heading_line(t):
    if REF_HEAD.match(t) or APPX_HEAD.match(t) or re.match(r"^(chương|chapter)\s+[\dIVX]+\b", t, re.I):
        return True
    words = t.split()
    if len(words) > 15 or t.endswith((".", ",", ";")):
        return False
    if re.match(r"^\d+(\.\d+)*\.?\s+\S", t) or re.match(r"^(Bảng|Hình|Table|Figure)\s+\d", t):
        return True
    letters = [c for c in t if c.isalpha()]
    return bool(letters) and sum(c.isupper() for c in letters) / len(letters) > 0.8


def read_text(path):
    raw = Path(path).read_text(encoding="utf-8", errors="replace")
    blocks = re.split(r"\n\s*\n", raw) if re.search(r"\n\s*\n", raw) else raw.splitlines()
    paras = []
    for b in blocks:
        b = " ".join(x.strip() for x in b.splitlines()).strip()
        if not b:
            continue
        style = ""
        m = re.match(r"^(#{1,6})\s+(.*)", b)
        if m:
            style, b = f"heading {len(m.group(1))}", m.group(2)
        paras.append(Para(len(paras), b, style))
    return paras


def load(path):
    p = Path(path)
    if not p.exists():
        sys.exit(f"Không thấy tệp: {path}")
    ext = p.suffix.lower()
    if ext == ".docx":
        paras = read_docx(p)
    elif ext == ".pdf":
        paras = read_pdf(p)
    elif ext in (".doc", ".odt", ".rtf"):
        sys.exit("Hãy chuyển sang .docx trước: soffice --headless --convert-to docx <tệp>")
    else:
        paras = read_text(p)
    nfd = sum(1 for para in paras for c in para.text if unicodedata.combining(c))
    for para in paras:
        para.text = unicodedata.normalize("NFC", para.text).replace(" ", " ")
    paras = [x for x in paras if x.text.strip()]
    for i, x in enumerate(paras):
        x.idx = i
    return paras, nfd


# ---------------------------------------------------------------- tiện ích
def strip_accents(s):
    s = s.replace("đ", "d").replace("Đ", "D")
    return "".join(c for c in unicodedata.normalize("NFD", s) if not unicodedata.combining(c))


def fold(s):
    return strip_accents(s).lower()


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", fold(s)).strip("-")[:60] or "tai-lieu"


def snippet(text, start=0, end=None, width=60):
    end = start if end is None else end
    a, b = max(0, start - width), min(len(text), end + width)
    return ("…" if a else "") + text[a:b].replace("\n", " ") + ("…" if b < len(text) else "")


def is_toc_line(p):
    return bool(re.search(r"(\.{3,}|…{2,}|\t)\s*\d+\s*$", p.text)) or p.style.lower().startswith("toc")


def is_heading(p):
    if is_toc_line(p) or p.in_table:
        return False
    st = p.style.lower()
    if re.search(r"heading|title|đề mục|tiêu đề|outline|chuong|chương", st):
        return True
    t = p.text.strip()
    words = t.split()
    if not words or len(words) > 18 or len(t) > 150 or t.endswith((".", ",", ";")) and not re.match(r"^\d+\.$", words[0]):
        return False
    if re.match(r"^(chương|chapter|phần|part|mục)\s+([\dIVXLC]+)\b", t, re.I):
        return True
    if re.match(r"^\d+(\.\d+)*\.?\s+\S", t) and len(words) <= 15:
        return True
    letters = [c for c in t if c.isalpha()]
    return bool(letters) and sum(c.isupper() for c in letters) / len(letters) > 0.8 and len(words) <= 15


REF_HEAD = re.compile(r"^(?:[\dIVX]+[.)]?\s*)?(danh mục\s+)?(tài liệu tham khảo|references?|bibliography|works cited|tltk)\s*:?$", re.I)
APPX_HEAD = re.compile(r"^(?:[\dIVX]+[.)]?\s*)?(phụ lục|appendix|appendices)\b", re.I)


def split_sections(paras):
    """Trả về (thân bài, danh mục TLTK, phụ lục) theo chỉ số đoạn."""
    ref_i = None
    for p in paras:
        if not is_toc_line(p) and REF_HEAD.match(p.text.strip()):
            ref_i = p.idx
    if ref_i is None:
        return paras, [], []
    end = len(paras)
    for p in paras[ref_i + 1:]:
        if APPX_HEAD.match(p.text.strip()) and is_heading(p):
            end = p.idx
            break
    return paras[:ref_i], paras[ref_i + 1:end], paras[end:]


ABBR = r"(?:et al|tr|pp|p|vol|no|Fig|Tab|TS|ThS|PGS|GS|CN|KS|BS|Th\.S|TP|Mr|Mrs|Dr|Prof|v\.v|e\.g|i\.e|etc|ed|eds|Eq|Ref|St|Jr)\."


def sentences(text):
    parts = re.split(r"(?<=[.!?…])\s+", text)
    out = []
    for part in parts:
        if out and (re.search(rf"\b{ABBR}$", out[-1]) or (part[:1].islower())):
            out[-1] += " " + part
        else:
            out.append(part)
    return [s for s in out if s.strip()]


# ---------------------------------------------------------------- cấu trúc
TEMPLATES = {
    "khoa-luan": {
        "ten": "Khóa luận / luận văn / đồ án tốt nghiệp",
        "muc": [
            ("Lời cam đoan", [r"lời cam đoan", r"cam đoan"], True),
            ("Lời cảm ơn", [r"lời cảm ơn", r"acknowledg"], True),
            ("Mục lục", [r"^mục lục$", r"table of contents"], True),
            ("Danh mục chữ viết tắt", [r"(danh mục|bảng).{0,20}(viết tắt|ký hiệu)"], False),
            ("Danh mục bảng", [r"danh mục (các )?bảng", r"list of tables"], False),
            ("Danh mục hình", [r"danh mục (các )?(hình|biểu đồ|sơ đồ)", r"list of figures"], False),
            ("Mở đầu / Đặt vấn đề", [r"^(phần\s+[\dI]+[.:]?\s*)?(mở đầu|đặt vấn đề|giới thiệu|introduction)"], True),
            ("Tính cấp thiết / Lý do chọn đề tài", [r"(tính cấp thiết|lý do chọn|lí do chọn|sự cần thiết)"], True),
            ("Mục tiêu nghiên cứu", [r"mục (tiêu|đích) (nghiên cứu|của đề tài)", r"mục tiêu"], True),
            ("Câu hỏi / giả thuyết nghiên cứu", [r"câu hỏi nghiên cứu", r"giả thuyết"], False),
            ("Đối tượng và phạm vi nghiên cứu", [r"đối tượng", r"phạm vi"], True),
            ("Phương pháp nghiên cứu", [r"phương pháp (nghiên cứu|luận)", r"methodolog"], True),
            ("Ý nghĩa khoa học / thực tiễn", [r"ý nghĩa", r"đóng góp"], True),
            ("Bố cục / kết cấu", [r"(bố cục|kết cấu|cấu trúc) (của )?(khóa luận|khoá luận|luận văn|đề tài|đồ án|báo cáo)"], False),
            ("Chương tổng quan / cơ sở lý thuyết", [r"tổng quan", r"cơ sở (lý|lí) (thuyết|luận)", r"literature"], True),
            ("Chương kết quả / phân tích", [r"kết quả", r"thực trạng", r"phân tích", r"results?"], True),
            ("Thảo luận / giải pháp", [r"thảo luận", r"giải pháp", r"discussion"], False),
            ("Kết luận", [r"^(phần\s+[\dIV]+[.:]?\s*)?kết luận", r"conclusions?"], True),
            ("Kiến nghị / đề xuất / hướng phát triển", [r"kiến nghị", r"đề xuất", r"hướng phát triển", r"khuyến nghị"], False),
            ("Tài liệu tham khảo", [r"tài liệu tham khảo", r"^references?$"], True),
            ("Phụ lục", [r"^phụ lục", r"appendi"], False),
        ],
    },
    "bai-bao": {
        "ten": "Bài báo khoa học (IMRaD)",
        "muc": [
            ("Tóm tắt", [r"^tóm tắt", r"^abstract"], True, True),
            ("Từ khóa", [r"^(từ khóa|từ khoá|keywords?)"], True, True),
            ("Giới thiệu / Đặt vấn đề", [r"(giới thiệu|đặt vấn đề|mở đầu|introduction)"], True),
            ("Tổng quan nghiên cứu", [r"tổng quan", r"cơ sở (lý|lí) thuyết", r"related work", r"literature"], False),
            ("Phương pháp", [r"phương pháp", r"vật liệu", r"dữ liệu", r"methods?", r"materials"], True),
            ("Kết quả", [r"kết quả", r"results?"], True),
            ("Thảo luận", [r"thảo luận", r"discussion"], True),
            ("Kết luận", [r"kết luận", r"conclusions?"], True),
            ("Lời cảm ơn", [r"lời cảm ơn", r"acknowledg"], False),
            ("Tài liệu tham khảo", [r"tài liệu tham khảo", r"^references?$"], True),
        ],
        "tom_tat_so_tu": [150, 300],
        "tu_khoa": [3, 6],
    },
    "bao-cao-thuc-tap": {
        "ten": "Báo cáo thực tập",
        "muc": [
            ("Lời cảm ơn", [r"lời cảm ơn"], True),
            ("Nhận xét của đơn vị thực tập", [r"nhận xét"], True),
            ("Mục lục", [r"^mục lục$"], True),
            ("Mở đầu / Giới thiệu", [r"(mở đầu|giới thiệu|lời nói đầu)"], True),
            ("Giới thiệu đơn vị thực tập", [r"(giới thiệu|tổng quan).{0,30}(công ty|đơn vị|doanh nghiệp|cơ quan)"], True),
            ("Nội dung công việc thực tập", [r"(nội dung|công việc|nhiệm vụ).{0,30}(thực tập|được giao)"], True),
            ("Kết quả / bài học kinh nghiệm", [r"(kết quả|bài học|kinh nghiệm)"], True),
            ("Kết luận / kiến nghị", [r"kết luận", r"kiến nghị"], True),
            ("Tài liệu tham khảo", [r"tài liệu tham khảo"], False),
            ("Phụ lục", [r"^phụ lục"], False),
        ],
    },
    "tieu-luan": {
        "ten": "Tiểu luận",
        "muc": [
            ("Mục lục", [r"^mục lục$"], False),
            ("Mở đầu", [r"(mở đầu|đặt vấn đề|giới thiệu|lời nói đầu)"], True),
            ("Nội dung", [r"(nội dung|chương\s+1|phần\s+(1|i)\b|^1\.?\s)"], True),
            ("Kết luận", [r"kết luận"], True),
            ("Tài liệu tham khảo", [r"tài liệu tham khảo", r"^references?$"], True),
        ],
    },
    "de-cuong": {
        "ten": "Đề cương nghiên cứu",
        "muc": [
            ("Tên đề tài", [r"tên đề tài"], False),
            ("Tính cấp thiết", [r"(tính cấp thiết|lý do chọn|lí do chọn)"], True),
            ("Tổng quan tình hình nghiên cứu", [r"(tổng quan|tình hình nghiên cứu)"], True),
            ("Mục tiêu", [r"mục tiêu"], True),
            ("Đối tượng, phạm vi", [r"đối tượng", r"phạm vi"], True),
            ("Phương pháp nghiên cứu", [r"phương pháp"], True),
            ("Nội dung / dự kiến kết cấu", [r"(nội dung|kết cấu|bố cục)"], True),
            ("Kế hoạch / tiến độ", [r"(kế hoạch|tiến độ)"], True),
            ("Tài liệu tham khảo", [r"tài liệu tham khảo"], True),
        ],
    },
}


def load_template(name, custom):
    if custom:
        data = json.loads(Path(custom).read_text(encoding="utf-8"))
        data["muc"] = [(m["ten"], m["mau"], m.get("bat_buoc", True), m.get("cho_phep_trong_dong", False))
                       for m in data["muc"]]
        return data
    if name not in TEMPLATES:
        sys.exit(f"Loại bài không hợp lệ. Chọn: {', '.join(TEMPLATES)}")
    return TEMPLATES[name]


def check_structure(paras, tpl):
    issues, found = [], []
    heads = [p for p in paras if is_heading(p)]
    for item in tpl["muc"]:
        name, pats, required = item[:3]
        inline_ok = len(item) > 3 and item[3]
        hit = None
        for p in heads:
            if any(re.search(pt, p.text.strip(), re.I) for pt in pats):
                hit = ("đề mục", p)
                break
        if not hit:
            for p in paras:
                if is_toc_line(p):
                    continue
                if any(re.search(pt, p.text[:80], re.I) for pt in pats):
                    hit = ("trong văn bản", p)
                    break
        found.append((name, required, hit))
        if not hit and required:
            issues.append(f"THIẾU (bắt buộc): **{name}**")
        elif not hit:
            issues.append(f"Không thấy (khuyến nghị): {name}")
        elif hit[0] == "trong văn bản" and not inline_ok:
            issues.append(f"{name}: chỉ thấy trong văn bản (đoạn {hit[1].idx}), chưa thành đề mục riêng — "
                          f"«{hit[1].text[:70]}»")
    # thứ tự xuất hiện của các mục bắt buộc đã tìm thấy dưới dạng đề mục
    seq = [(n, h[1].idx) for n, req, h in found if h and h[0] == "đề mục" and req]
    for (n1, i1), (n2, i2) in zip(seq, seq[1:]):
        if i2 < i1:
            issues.append(f"Thứ tự có thể sai: «{n2}» (đoạn {i2}) đứng trước «{n1}» (đoạn {i1})")
    if "tom_tat_so_tu" in tpl:
        issues += check_abstract(paras, tpl)
    return found, issues


def check_abstract(paras, tpl):
    out = []
    lo, hi = tpl["tom_tat_so_tu"]
    used = set()
    for i, p in enumerate(paras):
        if i in used:
            continue
        t = p.text.strip()
        m = re.match(r"^(tóm tắt|abstract)\s*[:.\-–]?\s*(.*)$", t, re.I)
        if not m:
            continue
        text = m.group(2)
        j = i + 1
        while len(text.split()) < 40 and j < len(paras) and not is_heading(paras[j]):
            nxt = re.sub(r"^(tóm tắt|abstract)\s*[:.\-–]?\s*", "", paras[j].text.strip(), flags=re.I)
            if re.match(r"^(từ khóa|từ khoá|keywords?)\b", nxt, re.I):
                break
            text += " " + nxt
            used.add(j)
            j += 1
        n = len(text.split())
        if n and not lo <= n <= hi:
            out.append(f"{m.group(1)}: {n} từ (thường yêu cầu {lo}–{hi} từ — kiểm tra quy định tạp chí)")
    k_lo, k_hi = tpl.get("tu_khoa", [3, 6])
    for p in paras:
        m = re.match(r"^(từ khóa|từ khoá|keywords?)\s*[:.\-–]\s*(.+)$", p.text.strip(), re.I)
        if m:
            kws = [k for k in re.split(r"[;,]", m.group(2)) if k.strip()]
            if not k_lo <= len(kws) <= k_hi:
                out.append(f"{m.group(1)}: {len(kws)} từ khóa (thường {k_lo}–{k_hi})")
    return out


ROMAN = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7, "VIII": 8, "IX": 9, "X": 10}


def check_numbering(body):
    issues = []
    chapters = []
    for p in body:
        if not is_heading(p):
            continue
        m = re.match(r"^(chương|chapter)\s+([\dIVX]+)\b", p.text.strip(), re.I)
        if m:
            v = m.group(2).upper()
            chapters.append((int(v) if v.isdigit() else ROMAN.get(v, 0), p))
    for (a, _), (b, pb) in zip(chapters, chapters[1:]):
        if b != a + 1:
            issues.append(f"Đánh số chương không liên tục: sau Chương {a} là Chương {b} (đoạn {pb.idx})")
    if chapters and chapters[0][0] != 1:
        issues.append(f"Chương đầu tiên được đánh số {chapters[0][0]}, không phải 1")

    last_child = defaultdict(int)
    for p in body:
        if not is_heading(p):
            continue
        m = re.match(r"^(\d+(?:\.\d+)+)\.?\s+\S", p.text.strip())
        if not m:
            continue
        nums = tuple(int(x) for x in m.group(1).split("."))
        parent, n = nums[:-1], nums[-1]
        exp = last_child[parent] + 1
        if n != exp:
            issues.append(f"Đề mục {m.group(1)} (đoạn {p.idx}): mong đợi {'.'.join(map(str, parent + (exp,)))}"
                          f" — có thể nhảy số hoặc trùng số")
        last_child[parent] = n
        for k in list(last_child):
            if len(k) > len(parent) and k[:len(nums)] == nums:
                del last_child[k]

    cap_re = re.compile(r"^(Bảng|Hình|Biểu đồ|Sơ đồ|Đồ thị|Table|Figure|Fig\.)\s+(\d+(?:[.\-]\d+)*)\s*[.:\-–]?\s*(.*)",
                        re.I)
    caps = defaultdict(list)
    for p in body:
        if is_toc_line(p) or len(p.text) > 300:
            continue
        m = cap_re.match(p.text.strip())
        if m and not ("caption" in p.style.lower() or re.match(r"^\S+\s+\d+(?:[.\-]\d+)*(?!\d)\s*[.:\-–](?!\d)", p.text.strip())
                      or re.match(UP, m.group(3) or "")):
            m = None
        if m:
            kind = m.group(1).capitalize().replace("Fig.", "Figure")
            caps[kind].append((m.group(2), p))
    full = "\n".join(p.text for p in body)
    for kind, lst in caps.items():
        seen = Counter(num for num, _ in lst)
        for num, c in seen.items():
            if c > 1:
                issues.append(f"{kind} {num} có {c} chú thích trùng số")
        prev = None
        for num, p in lst:
            parts = tuple(int(x) for x in re.split(r"[.\-]", num))
            if prev is not None:
                ok = (parts[:-1] == prev[:-1] and parts[-1] == prev[-1] + 1) or \
                     (len(parts) > 1 and parts[:-1] > prev[:-1] and parts[-1] == 1)
                if not ok and seen[num] == 1:
                    issues.append(f"{kind} {num} (đoạn {p.idx}) không nối tiếp {kind} {'.'.join(map(str, prev))}")
            prev = parts
            mentions = len(re.findall(rf"(?<!\w){re.escape(kind)}\s+{re.escape(num)}(?![\d.]\d)", full, re.I))
            if mentions <= 1:
                issues.append(f"{kind} {num} không được nhắc tới trong văn bản (chỉ có chú thích)")
    return issues, {k: len(v) for k, v in caps.items()}, len(chapters)


# ---------------------------------------------------------------- trích dẫn
IEEE_CIT = re.compile(r"\[(\s*\d{1,3}\s*(?:[-–—,;]\s*\d{1,3}\s*)*)\]")


def expand(group):
    nums = []
    for part in re.split(r"[,;]", group):
        part = part.strip()
        m = re.match(r"^(\d+)\s*[-–—]\s*(\d+)$", part)
        if m:
            a, b = int(m.group(1)), int(m.group(2))
            nums += list(range(a, b + 1)) if a <= b <= a + 50 else [a, b]
        elif part.isdigit():
            nums.append(int(part))
    return nums


def parse_ref_entries(refs):
    entries, auto = [], 0
    for p in refs:
        t = p.text.strip()
        if len(t) < 8 or is_heading(p) and not re.match(r"^\[?\d+[\].)]", t) and len(t) < 40:
            continue
        m = re.match(r"^\[(\d+)\]\s*(.*)$", t) or re.match(r"^(\d+)[.)]\s+(.*)$", t)
        if m:
            entries.append({"so": int(m.group(1)), "text": m.group(2), "doan": p.idx})
        else:
            if p.numbered:
                auto += 1
            entries.append({"so": auto if p.numbered else None, "text": t, "doan": p.idx, "tu_dong": p.numbered})
    return entries


def ieee_entry_issues(e):
    t, out = e["text"], []
    if not re.search(r"\b(1[89]\d{2}|20\d{2})\b", t):
        out.append("không thấy năm xuất bản")
    if re.search(r"\b(vol\.|tập)\s*\d", t, re.I):
        if not re.search(r"[“\"].+?[”\"]", t):
            out.append("bài tạp chí nhưng tên bài chưa đặt trong ngoặc kép “...”")
        if not re.search(r"\b(pp?\.|tr\.)\s*\d", t):
            out.append("thiếu số trang (pp. x–y)")
    if re.search(r"https?://", t) and not re.search(r"available|truy cập|online", t, re.I):
        out.append("có URL nhưng thiếu “[Online]. Available:” / ngày truy cập")
    if re.match(rf"^{NAME_TOKEN},\s*[A-Z]\.", t):
        out.append("tên tác giả viết kiểu APA (Họ, T.) — IEEE dùng “T. Họ”")
    if re.search(r"\(\s*(1[89]\d{2}|20\d{2})\s*\)\s*\.", t[:120]):
        out.append("năm đặt trong ngoặc ngay sau tác giả — đây là kiểu APA")
    return out


def check_ieee(body, entries):
    issues, seq, occ = [], [], 0
    for p in body:
        for m in IEEE_CIT.finditer(p.text):
            nums = expand(m.group(1))
            if not nums or max(nums) > 999:
                continue
            occ += 1
            if nums != sorted(nums):
                issues.append(f"Trong một ngoặc nên xếp tăng dần: {m.group(0)} (đoạn {p.idx})")
            for n in nums:
                if n not in seq:
                    seq.append(n)
    rep = {"so_lan_trich": occ, "thu_tu_lan_dau": seq}
    if not seq:
        return issues, rep
    renum = {old: new for new, old in enumerate(seq, start=1) if old != new}
    if renum:
        issues.append("Số trích dẫn **không tăng dần theo thứ tự xuất hiện lần đầu**. Thứ tự xuất hiện: "
                      + ", ".join(map(str, seq[:60])) + (" …" if len(seq) > 60 else ""))
        issues.append("Đề xuất đánh số lại (cũ → mới), đồng thời sắp lại danh mục theo số mới: "
                      + ", ".join(f"[{a}]→[{b}]" for a, b in list(renum.items())[:80]))
    listed = [e["so"] for e in entries if e["so"] is not None]
    if entries and not listed:
        issues.append("Danh mục TLTK không có số thứ tự [n] — kiểu IEEE bắt buộc đánh số")
    cnt = Counter(listed)
    for n, c in cnt.items():
        if c > 1:
            issues.append(f"Danh mục có {c} mục cùng số [{n}]")
    if listed:
        for a, b in zip(listed, listed[1:]):
            if b != a + 1:
                issues.append(f"Danh mục đánh số không liên tục: [{a}] rồi [{b}]")
    missing = sorted(set(seq) - set(listed))
    unused = sorted(set(listed) - set(seq))
    if missing and listed:
        issues.append("Trích trong bài nhưng **không có trong danh mục**: " + ", ".join(f"[{n}]" for n in missing))
    if unused:
        issues.append("Có trong danh mục nhưng **không được trích trong bài**: " + ", ".join(f"[{n}]" for n in unused))
    for e in entries:
        probs = ieee_entry_issues(e)
        if probs:
            issues.append(f"Mục [{e['so']}] «{e['text'][:70]}…»: " + "; ".join(probs))
    norm = Counter(re.sub(r"\W+", "", fold(e["text"]))[:80] for e in entries)
    for k, c in norm.items():
        if c > 1 and k:
            issues.append(f"Có {c} mục danh mục trùng nhau (bắt đầu «{k[:40]}»)")
    return issues, rep


PAREN = re.compile(r"\(([^()]{3,300}?)\)")
_NM = rf"(?:{NAME_TOKEN}\s+){{0,3}}{NAME_TOKEN}"
NARR = re.compile(rf"({_NM}(?:,\s+{_NM})*(?:,?\s+(?:and|và|&)\s+{_NM})?(?:\s+(?:et al\.?|và cộng sự|và cs\.?))?)"
                  rf"\s+\(({YEAR})(?:,\s*(?:tr|p|pp|trang)\.?\s*[\d–\-]+)?\)")
CIT_PART = re.compile(rf"^(?:(?:xem|xem thêm|theo|see|e\.g\.,?|cf\.)\s+)?(?P<a>.+?),?\s+"
                      rf"(?P<y>(?:{YEAR})(?:\s*,\s*(?:{YEAR}))*)(?:\s*,\s*(?:tr|p|pp|trang)\.?\s*[\d–\-, ]+)?$", re.I)


def apa_citations(body):
    cites = []
    for p in body:
        for m in PAREN.finditer(p.text):
            inner = m.group(1)
            if not re.search(YEAR, inner) or not re.search(UP, inner):
                continue
            for part in inner.split(";"):
                cm = CIT_PART.match(part.strip())
                if not cm or not re.search(UP, cm.group("a")) or len(cm.group("a")) > 120:
                    continue
                for y in re.split(r"\s*,\s*", cm.group("y")):
                    cites.append({"a": cm.group("a").strip(), "y": y, "kieu": "ngoặc", "doan": p.idx,
                                  "goc": part.strip()})
        for m in NARR.finditer(p.text):
            cites.append({"a": m.group(1).strip(), "y": m.group(2), "kieu": "câu", "doan": p.idx,
                          "goc": m.group(0)})
    return cites


def apa_entry_key(text):
    t = re.sub(r"^\[?\d+[\].)]\s*", "", text.strip())
    ym = re.search(rf"\(({YEAR})\)", t)
    year = ym.group(1) if ym else None
    if not year:
        y2 = re.search(r"\b((?:1[89]\d{2}|20\d{2})[a-z]?)\b", t)
        year = y2.group(1) if y2 else None
    head = t[: ym.start()] if ym else t[:80]
    first = head.split(",")[0].strip()
    rest = head[len(first):]
    if re.match(r"^,\s*[A-ZĐ]\.", rest) or re.match(r"^,\s*[A-ZĐ][a-z]?\.", rest):
        kind, key = "tay", first
    else:
        kind, key = "viet", re.split(r"[,(.]", head)[0].strip()
    return {"key": key, "kind": kind, "year": year, "year_paren": bool(ym)}


ORG_WORDS = re.compile(r"^(bộ|tổng cục|cục|viện|trường|sở|ủy ban|uỷ ban|quốc hội|chính phủ|ngân hàng|"
                       r"tổ chức|hội|ban|văn phòng|tập đoàn|công ty|đại học|học viện|nxb|nhà xuất bản)\b", re.I)


def vn_sort_key(name, mode):
    toks = name.split()
    if mode == "ho" or ORG_WORDS.match(name) or len(toks) > 5 or len(toks) < 2:
        return fold(name)
    return fold(" ".join([toks[-1]] + toks[:-1]))


def check_apa(body, entries, vn_sort="ten"):
    issues = []
    cites = apa_citations(body)
    keys = [dict(apa_entry_key(e["text"]), text=e["text"], doan=e["doan"]) for e in entries]
    used = set()
    unmatched = []
    for c in cites:
        a_f = fold(c["a"])
        hit = None
        for i, k in enumerate(keys):
            if not k["year"] or fold(k["year"]) != fold(c["y"]):
                continue
            if fold(k["key"]) and fold(k["key"]) in a_f:
                hit = i
                break
        if hit is None:
            unmatched.append(c)
        else:
            used.add(hit)
        g = c["goc"]
        if c["kieu"] == "ngoặc" and re.search(r"\band\b", g):
            issues.append(f"Trích dẫn trong ngoặc dùng “and” — APA dùng “&”: ({g}) (đoạn {c['doan']})")
        if c["kieu"] == "câu" and "&" in g:
            issues.append(f"Trích dẫn trong câu dùng “&” — APA dùng “and”/“và”: {g} (đoạn {c['doan']})")
        if re.search(r"et\.\s?al|et al(?!\.)", g):
            issues.append(f"Viết sai “et al.”: {g} (đoạn {c['doan']})")
        n_auth = len(re.findall(r",", c["a"])) + (1 if re.search(r"&|\bvà\b|\band\b", c["a"]) else 0)
        if n_auth >= 2 and "et al" not in c["a"] and "cộng sự" not in c["a"]:
            issues.append(f"Từ 3 tác giả trở lên APA 7 viết “Tác giả đầu et al.”/“và cộng sự”: {g} (đoạn {c['doan']})")
    seen_u = set()
    for c in unmatched:
        k = (c["a"], c["y"])
        if k in seen_u:
            continue
        seen_u.add(k)
        issues.append(f"Trích dẫn **không khớp mục nào trong danh mục** (sai tên/năm hoặc thiếu): "
                      f"{c['goc']} (đoạn {c['doan']})")
    for i, k in enumerate(keys):
        if i not in used:
            issues.append(f"Mục danh mục **không thấy được trích trong bài**: «{k['text'][:80]}»")
        if not k["year"]:
            issues.append(f"Mục thiếu năm: «{k['text'][:80]}»")
        elif not k["year_paren"]:
            issues.append(f"Năm chưa đặt trong ngoặc sau tên tác giả: «{k['text'][:80]}»")
        if re.search(r"\bdoi:\s*10\.", k["text"], re.I):
            issues.append(f"APA 7 ghi DOI dạng https://doi.org/10.xxx: «{k['text'][:60]}»")
        if re.search(r"retrieved from", k["text"], re.I):
            issues.append(f"APA 7 bỏ “Retrieved from” (trừ khi cần ngày truy cập): «{k['text'][:60]}»")
    kinds = [k["kind"] for k in keys]
    switches = sum(1 for a, b in zip(kinds, kinds[1:]) if a != b)
    if switches > 1:
        issues.append("Tài liệu tiếng Việt và nước ngoài đang xen kẽ — quy định phổ biến yêu cầu xếp riêng từng nhóm ngôn ngữ")
    for grp_kind in ("viet", "tay"):
        grp = [k for k in keys if k["kind"] == grp_kind]
        sk = (lambda x: vn_sort_key(x, vn_sort)) if grp_kind == "viet" else fold
        for a, b in zip(grp, grp[1:]):
            if sk(a["key"]) > sk(b["key"]):
                issues.append(f"Danh mục chưa xếp theo ABC ({'tác giả Việt, theo ' + ('tên' if vn_sort == 'ten' else 'họ') if grp_kind == 'viet' else 'tác giả nước ngoài, theo họ'}): "
                              f"«{a['key']}» đứng trước «{b['key']}»")
    dup = Counter((fold(k["key"]), k["year"]) for k in keys if k["year"])
    for (key, y), c in dup.items():
        if c > 1 and not re.search(r"[a-z]$", y or ""):
            issues.append(f"{c} mục cùng tác giả «{key}» năm {y} — cần thêm hậu tố {y}a, {y}b")
    return issues, {"so_lan_trich": len(cites), "khong_khop": len(seen_u), "so_muc": len(keys)}


def detect_style(body, entries):
    ieee = sum(len(IEEE_CIT.findall(p.text)) for p in body)
    apa = len(apa_citations(body))
    numbered = sum(1 for e in entries if e["so"] is not None)
    if ieee > apa or (numbered > len(entries) / 2 and ieee):
        return "ieee", ieee, apa
    return ("apa" if apa else "khong-ro"), ieee, apa


def check_citations(paras, style="tu-dong", vn_sort="ten"):
    body, refs, _ = split_sections(paras)
    entries = parse_ref_entries(refs)
    det, n_ieee, n_apa = detect_style(body, entries)
    style = det if style == "tu-dong" else style
    head = [f"Kiểu nhận diện: **{style.upper()}** (dấu [n]: {n_ieee}, dạng Tác giả–năm: {n_apa}); "
            f"danh mục: {len(entries)} mục"]
    issues = []
    if not refs:
        issues.append("Không tìm thấy đề mục “Tài liệu tham khảo / References”")
    if n_ieee and n_apa and min(n_ieee, n_apa) >= 3:
        issues.append(f"Có vẻ **trộn hai kiểu trích dẫn** (IEEE {n_ieee} lần, APA {n_apa} lần) — chỉ dùng một kiểu")
    if style == "ieee":
        more, rep = check_ieee(body, entries)
    elif style == "apa":
        more, rep = check_apa(body, entries, vn_sort)
    else:
        more, rep = ["Không nhận ra kiểu trích dẫn nào trong thân bài"], {}
    return head, issues + more, rep


# ---------------------------------------------------------------- chính tả
COMMON_ERRORS = {
    "sử lý": "xử lý", "sử lí": "xử lí", "xữ lý": "xử lý", "sắp sếp": "sắp xếp", "chuẩn đoán": "chẩn đoán",
    "chia sẽ": "chia sẻ", "sáng lạng": "xán lạn", "bổ xung": "bổ sung", "suất sắc": "xuất sắc",
    "sản suất": "sản xuất", "năng xuất": "năng suất", "kiểm xoát": "kiểm soát", "sơ xuất": "sơ suất",
    "chỉnh chu": "chỉn chu", "vô hình chung": "vô hình trung", "cọ sát": "cọ xát", "sát nhập": "sáp nhập",
    "xát nhập": "sáp nhập", "tựu chung": "tựu trung", "đề suất": "đề xuất", "suất hiện": "xuất hiện",
    "suất bản": "xuất bản", "suất phát": "xuất phát", "xử dụng": "sử dụng", "nghiêng cứu": "nghiên cứu",
    "kết quã": "kết quả", "hiệu quã": "hiệu quả", "chính sác": "chính xác", "chao đổi": "trao đổi",
    "rỏ ràng": "rõ ràng", "sẳn sàng": "sẵn sàng", "cũng cố": "củng cố", "lẻ ra": "lẽ ra",
    "giữ liệu": "dữ liệu", "dử liệu": "dữ liệu", "hổ trợ": "hỗ trợ", "biễu đồ": "biểu đồ",
    "triễn khai": "triển khai", "bảo đãm": "bảo đảm", "giảm thiễu": "giảm thiểu", "lảnh đạo": "lãnh đạo",
    "tỗng quan": "tổng quan", "phát triễn": "phát triển", "thiếc kế": "thiết kế", "dể dàng": "dễ dàng",
    "nổ lực": "nỗ lực", "củng như": "cũng như", "tuy nhiên,": None, "giành cho": "dành cho",
    "dành chiến thắng": "giành chiến thắng", "trau chuốt": "trau chuốt", "chau chuốt": "trau chuốt",
    "sáng tạo": None, "khuyết điểm": None, "yếu điểm": "điểm yếu (nếu ý là nhược điểm)",
    "tham khảo ý kiến": None, "bàng quang với": "bàng quan với", "xuy xét": "suy xét",
    "suy sụp": None, "dụ dỗ": None, "giáo giục": "giáo dục", "trách nhiệm": None, "chách nhiệm": "trách nhiệm",
    "ngiên cứu": "nghiên cứu", "nghành": "ngành", "ngiệm": "nghiệm", "nghuyên": "nguyên",
    "phân tít": "phân tích", "thống kế": "thống kê", "câu hõi": "câu hỏi", "giã thuyết": "giả thuyết",
    "mục tiu": "mục tiêu", "hệ thồng": "hệ thống", "quản lí lý": "quản lý",
}
COMMON_ERRORS = {k: v for k, v in COMMON_ERRORS.items() if v and v != k}

OLD_TONE = re.compile(r"(?<!\w)(?!qu)\w*(o[àáảãạ]|o[èéẻẽẹ]|(?<!q)u[ỳýỷỹỵ])(?!\w)", re.I)
NEW_TONE = re.compile(r"(?<!\w)\w*([òóỏõọ]a|[òóỏõọ]e|[ùúủũụ]y)(?!\w)", re.I)
BAD_UO = re.compile(r"\w*[ừứửữự]ơ\w*", re.I)
IY_PAIRS = [("kỹ", "kĩ"), ("lý", "lí"), ("mỹ", "mĩ"), ("quy", "qui"), ("ký", "kí")]


def check_spelling(paras, nfd):
    issues = []
    if nfd:
        issues.append(f"Có {nfd} ký tự dựng sẵn kiểu tổ hợp (Unicode NFD) — dễ lỗi tìm kiếm/đếm trùng; "
                      f"nên chuyển về Unicode dựng sẵn (NFC). Script đã tự chuẩn hoá khi rà.")
    legacy = sum(len(re.findall(r"[äåæëïðñöøüþÿ]", p.text)) for p in paras)
    if legacy > 20:
        issues.append(f"Có {legacy} ký tự lạ (ä, ö, ñ…) — có thể còn đoạn gõ bằng bảng mã cũ TCVN3/VNI")
    per_type = defaultdict(list)
    old_n = new_n = 0
    old_ex, new_ex = Counter(), Counter()
    iy = {pair: [0, 0] for pair in IY_PAIRS}
    _, refs, _ = split_sections(paras)
    ref_ids = {p.idx for p in refs}
    for p in paras:
        t = p.text
        if p.idx in ref_ids or is_toc_line(p):
            continue
        low = t.lower()
        for wrong, right in COMMON_ERRORS.items():
            for m in re.finditer(rf"(?<!\w){re.escape(wrong)}(?!\w)", low):
                per_type["Từ hay viết sai"].append(f"«{t[m.start():m.end()]}» → «{right}» (đoạn {p.idx}): "
                                                   f"{snippet(t, m.start(), m.end(), 35)}")
        for m in BAD_UO.finditer(t):
            per_type["Đặt dấu sai ở “ươ”"].append(f"«{m.group(0)}» (đoạn {p.idx}) — dấu phải đặt trên “ơ”")
        for m in re.finditer(r"(?<!\w)(\w+)\s+\1(?!\w)", t, re.I):
            if not m.group(1).isdigit() and m.group(1).lower() not in ("có", "là", "và", "nhiều", "từng", "mỗi",
                                                                         "dần", "rất", "đâu", "ai", "gì", "nào"):
                per_type["Lặp từ"].append(f"«{m.group(0)}» (đoạn {p.idx}): {snippet(t, m.start(), m.end(), 30)}")
        for m in re.finditer(r"\s+([,.;:!?)])", t):
            if m.group(1) == "." and re.match(r"\.\d", t[m.start(1):m.start(1) + 2]):
                continue
            per_type["Khoảng trắng trước dấu câu"].append(f"(đoạn {p.idx}) {snippet(t, m.start(), m.end(), 25)}")
        for m in re.finditer(r"(?<=[^\W\d_])([,;:])(?=[^\W\d_])", t):
            per_type["Thiếu khoảng trắng sau dấu câu"].append(f"(đoạn {p.idx}) {snippet(t, m.start(), m.end(), 25)}")
        for m in re.finditer(rf"(?:(?<=[a-zà-ỹ]{{2}})|(?<=[\])]))[.,;](?={UP}[a-zà-ỹ]|\[)", t):
            per_type["Thiếu khoảng trắng sau dấu câu (sau ] hoặc chữ)"].append(f"(đoạn {p.idx}) {snippet(t, m.start(), m.end(), 25)}")
        for m in re.finditer(r"\(\s+|\s+\)", t):
            per_type["Khoảng trắng thừa trong ngoặc"].append(f"(đoạn {p.idx}) {snippet(t, m.start(), m.end(), 20)}")
        for m in re.finditer(r"(?<=\S)  +(?=\S)", t.replace("\t", " ")):
            per_type["Hai dấu cách liền nhau"].append(f"(đoạn {p.idx}) {snippet(t, m.start(), m.end(), 20)}")
        if t.count("(") != t.count(")"):
            per_type["Ngoặc đơn không cân"].append(f"(đoạn {p.idx}) «{t[:80]}»")
        if t.count("“") != t.count("”") or t.count('"') % 2:
            per_type["Ngoặc kép không cân"].append(f"(đoạn {p.idx}) «{t[:80]}»")
        if re.search(r"[.!?]\s+[a-zà-ỹđ]", t) and not re.search(ABBR + r"\s+[a-z]", t):
            m = re.search(r"[.!?]\s+[a-zà-ỹđ]", t)
            per_type["Sau dấu chấm chưa viết hoa"].append(f"(đoạn {p.idx}) {snippet(t, m.start(), m.end(), 25)}")
        for m in OLD_TONE.finditer(t):
            old_n += 1
            old_ex[m.group(0).lower()] += 1
        for m in NEW_TONE.finditer(t):
            if not re.match(r"qu", m.group(0), re.I):
                new_n += 1
                new_ex[m.group(0).lower()] += 1
        for pair in IY_PAIRS:
            for j, w in enumerate(pair):
                iy[pair][j] += len(re.findall(rf"(?<!\w){w}(?!\w)", low))
    if old_n and new_n:
        issues.append(f"Trộn hai kiểu bỏ dấu: kiểu cũ {old_n} lần (vd: {', '.join(w for w, _ in old_ex.most_common(4))}) "
                      f"và kiểu mới {new_n} lần (vd: {', '.join(w for w, _ in new_ex.most_common(4))}) — nên thống nhất")
    for (a, b), (na, nb) in iy.items():
        if na and nb:
            issues.append(f"Không thống nhất i/y: «{a}» {na} lần, «{b}» {nb} lần")
    for kind, lst in per_type.items():
        issues.append(f"**{kind}**: {len(lst)} chỗ")
        issues += ["  - " + x for x in lst[:15]]
        if len(lst) > 15:
            issues.append(f"  - … và {len(lst) - 15} chỗ khác")
    return issues


# ---------------------------------------------------------------- trùng lặp
def tokens(text):
    return re.findall(r"[^\W_]+", unicodedata.normalize("NFC", text).lower())


def strip_quotes(text):
    return re.sub(r"“[^”]{0,600}”|\"[^\"]{0,600}\"", " ", text)


def check_similarity(paras, sources, n=5, exclude_quotes=True, threshold=0.3):
    body, _, _ = split_sections(paras)
    index = defaultdict(set)
    names = []
    for si, src in enumerate(sources):
        sp, _ = load(src)
        names.append(Path(src).name)
        toks = tokens(" ".join(p.text for p in sp))
        for i in range(len(toks) - n + 1):
            index[tuple(toks[i:i + n])].add(si)
    total = covered = 0
    per_src = Counter()
    hits = []
    for p in body:
        text = strip_quotes(p.text) if exclude_quotes else p.text
        for s in sentences(text):
            toks = tokens(s)
            if not toks:
                continue
            cov = [False] * len(toks)
            srcs = Counter()
            for i in range(len(toks) - n + 1):
                found = index.get(tuple(toks[i:i + n]))
                if found:
                    for j in range(i, i + n):
                        cov[j] = True
                    for f in found:
                        srcs[f] += 1
            c = sum(cov)
            total += len(toks)
            covered += c
            if srcs:
                best = srcs.most_common(1)[0][0]
                per_src[best] += c
                if c / len(toks) >= threshold:
                    hits.append((c / len(toks), p.idx, s, names[best]))
    pct = 100 * covered / total if total else 0
    lines = [f"Tỷ lệ từ trùng (ước tính, n-gram {n} từ, "
             f"{'đã loại' if exclude_quotes else 'chưa loại'} trích dẫn trong ngoặc kép, đã loại danh mục TLTK): "
             f"**{pct:.1f}%** trên {total} từ",
             "Lưu ý: chỉ so với các tệp nguồn được cung cấp — **không phải** điểm Turnitin."]
    for si, c in per_src.most_common():
        lines.append(f"- {names[si]}: {100 * c / total:.1f}%")
    lines.append("")
    lines.append("Câu trùng nhiều nhất:")
    for r, idx, s, nm in sorted(hits, reverse=True)[:40]:
        lines.append(f"- {r * 100:.0f}% · đoạn {idx} · {nm}: «{s[:200]}»")
    return lines


def distinctive(paras, k=15):
    body, _, _ = split_sections(paras)
    cands = []
    for p in body:
        if is_heading(p) or is_toc_line(p) or p.in_table:
            continue
        for s in sentences(strip_quotes(p.text)):
            w = s.split()
            if 14 <= len(w) <= 40 and not IEEE_CIT.search(s) and not PAREN.search(s):
                cands.append((p.idx, s))
    if len(cands) <= k:
        return cands
    step = len(cands) / k
    return [cands[int(i * step)] for i in range(k)]


# ---------------------------------------------------------------- báo cáo
def section(title, items):
    out = [f"## {title}", ""]
    out += ([f"- {x}" if not x.startswith("  - ") else x for x in items] or ["- Không phát hiện vấn đề."])
    out.append("")
    return out


def full_report(path, kind, custom, style, vn_sort="ten"):
    paras, nfd = load(path)
    tpl = load_template(kind, custom)
    body, refs, appx = split_sections(paras)
    found, s_issues = check_structure(paras, tpl)
    n_issues, caps, n_ch = check_numbering(body)
    c_head, c_issues, rep = check_citations(paras, style, vn_sort)
    sp = check_spelling(paras, nfd)
    words = sum(len(p.text.split()) for p in body)
    today = datetime.date.today().isoformat()
    md = [f"# Báo cáo rà soát: {Path(path).name}", "",
          f"- Ngày rà soát: {today}",
          f"- Loại bài: {tpl['ten']}",
          f"- Số đoạn: {len(paras)} · thân bài ≈ {words} từ · danh mục TLTK: {len(refs)} đoạn · phụ lục: {len(appx)} đoạn",
          f"- Chương: {n_ch} · " + " · ".join(f"{k}: {v}" for k, v in caps.items()),
          "", "> Báo cáo do script tự động tạo, mỗi mục là **cảnh báo cần người xem lại**. "
          "Lỗi chính tả theo ngữ cảnh, logic nội dung và chất lượng học thuật cần đọc trực tiếp.", ""]
    md += ["## 1. Cấu trúc", "", "| Mục | Bắt buộc | Tình trạng |", "|---|---|---|"]
    for name, req, hit in found:
        st = "✅ đề mục" if hit and hit[0] == "đề mục" else ("⚠️ chỉ trong văn bản" if hit else ("❌ thiếu" if req else "— không có"))
        md.append(f"| {name} | {'có' if req else 'không'} | {st} |")
    md.append("")
    md += section("1b. Nhận xét cấu trúc", s_issues)
    md += section("2. Đánh số chương, mục, bảng, hình", n_issues)
    md += section("3. Trích dẫn và tài liệu tham khảo", c_head + c_issues)
    if rep.get("thu_tu_lan_dau"):
        md.append(f"Thứ tự xuất hiện lần đầu của trích dẫn: {', '.join(map(str, rep['thu_tu_lan_dau'][:80]))}\n")
    md += section("4. Chính tả, dấu câu, trình bày", sp)
    md += ["## 5. Việc cần đọc trực tiếp (script không làm được)", "",
           "- Lỗi chính tả phụ thuộc ngữ cảnh: hỏi/ngã, s/x, ch/tr, d/gi/r, l/n, -n/-ng, -c/-t.",
           "- Nội dung từng phần có đủ ý theo quy định chưa (xem tài liệu cấu trúc).",
           "- Mục tiêu ↔ phương pháp ↔ kết quả ↔ kết luận có khớp nhau không.",
           "- Định dạng in nghiêng/đậm trong danh mục TLTK (script không đọc được định dạng chữ).", ""]
    summary = {"cau_truc": len(s_issues), "danh_so": len(n_issues), "trich_dan": len(c_issues),
               "chinh_ta": len([x for x in sp if not x.startswith("  - ")])}
    return "\n".join(md), summary


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("trich-xuat", "cau-truc", "trich-dan", "chinh-ta", "cau-dac-trung", "tat-ca", "trung-lap"):
        s = sub.add_parser(name)
        s.add_argument("tep")
        s.add_argument("--loai", default="khoa-luan", help="khoa-luan | bai-bao | bao-cao-thuc-tap | tieu-luan | de-cuong")
        s.add_argument("--cau-truc-rieng", help="JSON cấu trúc theo quy định riêng của trường")
        s.add_argument("--kieu", default="tu-dong", choices=["tu-dong", "apa", "ieee"])
        s.add_argument("--ra", default=".", help="thư mục ghi báo cáo (lệnh tat-ca)")
        s.add_argument("--nguon", nargs="*", default=[], help="tệp nguồn để so trùng (lệnh trung-lap)")
        s.add_argument("--n", type=int, default=5)
        s.add_argument("--giu-ngoac-kep", action="store_true", help="không loại câu trong ngoặc kép khi so trùng")
        s.add_argument("--so-cau", type=int, default=15)
        s.add_argument("--xep-ten-viet", default="ten", choices=["ten", "ho"],
                       help="APA: xếp tác giả Việt theo tên (mặc định, quy định phổ biến) hay theo họ")
    a = ap.parse_args()

    if a.cmd == "trich-xuat":
        paras, nfd = load(a.tep)
        body, refs, appx = split_sections(paras)
        ref_ids, appx_ids = {p.idx for p in refs}, {p.idx for p in appx}
        for p in paras:
            tag = "H" if is_heading(p) else ("R" if p.idx in ref_ids else ("A" if p.idx in appx_ids else "P"))
            tag += "T" if p.in_table else ""
            print(f"[{p.idx}|{tag}{'|' + p.style if p.style else ''}] {p.text}")
        print(f"\n# {len(paras)} đoạn · H=đề mục, P=thân bài, R=TLTK, A=phụ lục, T=trong bảng · NFD={nfd}",
              file=sys.stderr)
    elif a.cmd == "cau-truc":
        paras, _ = load(a.tep)
        found, issues = check_structure(paras, load_template(a.loai, a.cau_truc_rieng))
        body, _, _ = split_sections(paras)
        n_issues, caps, n_ch = check_numbering(body)
        print("\n".join(section("Cấu trúc", issues) + section(f"Đánh số (chương: {n_ch}, {dict(caps)})", n_issues)))
    elif a.cmd == "trich-dan":
        paras, _ = load(a.tep)
        head, issues, rep = check_citations(paras, a.kieu, a.xep_ten_viet)
        print("\n".join(section("Trích dẫn", head + issues)))
        print(json.dumps(rep, ensure_ascii=False))
    elif a.cmd == "chinh-ta":
        paras, nfd = load(a.tep)
        print("\n".join(section("Chính tả & trình bày", check_spelling(paras, nfd))))
    elif a.cmd == "trung-lap":
        if not a.nguon:
            sys.exit("Cần --nguon <tệp1> <tệp2> ...")
        paras, _ = load(a.tep)
        print("\n".join(check_similarity(paras, a.nguon, a.n, not a.giu_ngoac_kep)))
    elif a.cmd == "cau-dac-trung":
        paras, _ = load(a.tep)
        for idx, s in distinctive(paras, a.so_cau):
            print(f"[{idx}] {s}")
    elif a.cmd == "tat-ca":
        md, summary = full_report(a.tep, a.loai, a.cau_truc_rieng, a.kieu, a.xep_ten_viet)
        out = Path(a.ra) / f"{datetime.date.today().isoformat()}-bao-cao-ra-soat-{slug(Path(a.tep).stem)}.md"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(md, encoding="utf-8")
        print(f"Đã ghi: {out}")
        print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
