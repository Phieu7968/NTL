/* =====================================================================
   xlsx.js — đọc và ghi tệp Excel .xlsx, không dùng thư viện ngoài

   Tệp .xlsx thực chất là một tệp ZIP chứa mấy tệp XML. Trình duyệt hiện
   đại có sẵn CompressionStream/DecompressionStream để nén và giải nén,
   và DOMParser để đọc XML — đủ để làm việc này bằng tay.

   Nhờ vậy ứng dụng nhận thẳng tệp Kết quả học tập do Phòng Đào tạo gửi
   và xuất ra bảng Cảnh cáo học vụ đúng mẫu, không phải chuyển qua CSV.
   ===================================================================== */
window.CV = window.CV || {};

CV.xlsx = (function () {
  "use strict";

  const supported = () => typeof DecompressionStream === "function" &&
    typeof CompressionStream === "function";

  /* ------------------------------------------------------------------ */
  /* 1. Giải nén ZIP                                                     */
  /* ------------------------------------------------------------------ */
  async function inflateRaw(bytes) {
    const ds = new DecompressionStream("deflate-raw");
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function deflateRaw(bytes) {
    const cs = new CompressionStream("deflate-raw");
    const stream = new Blob([bytes]).stream().pipeThrough(cs);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  /** Đọc một tệp ZIP thành bản đồ {tên tệp: Uint8Array}. */
  async function unzip(buffer) {
    const u8 = new Uint8Array(buffer);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);

    // Tìm bản ghi kết thúc thư mục trung tâm, quét ngược từ cuối tệp
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("Tệp không phải ZIP hợp lệ (thiếu bản ghi kết thúc).");

    const count = dv.getUint16(eocd + 10, true);
    let pos = dv.getUint32(eocd + 16, true);
    const out = {};
    const dec = new TextDecoder("utf-8");

    for (let i = 0; i < count; i++) {
      if (dv.getUint32(pos, true) !== 0x02014b50) break;
      const method = dv.getUint16(pos + 10, true);
      const compSize = dv.getUint32(pos + 20, true);
      const nameLen = dv.getUint16(pos + 28, true);
      const extraLen = dv.getUint16(pos + 30, true);
      const commentLen = dv.getUint16(pos + 32, true);
      const localOff = dv.getUint32(pos + 42, true);
      const name = dec.decode(u8.subarray(pos + 46, pos + 46 + nameLen));

      // Kích thước phần phụ ở đầu tệp con có thể khác trong thư mục trung tâm
      const lNameLen = dv.getUint16(localOff + 26, true);
      const lExtraLen = dv.getUint16(localOff + 28, true);
      const dataStart = localOff + 30 + lNameLen + lExtraLen;
      const raw = u8.subarray(dataStart, dataStart + compSize);
      out[name] = method === 8 ? await inflateRaw(raw) : raw.slice();

      pos += 46 + nameLen + extraLen + commentLen;
    }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* 2. Đọc bảng tính                                                    */
  /* ------------------------------------------------------------------ */
  /** "C7" -> 2 (chỉ số cột tính từ 0) */
  function colOf(ref) {
    let n = 0;
    for (let i = 0; i < ref.length; i++) {
      const ch = ref.charCodeAt(i);
      if (ch < 65 || ch > 90) break;
      n = n * 26 + (ch - 64);
    }
    return n - 1;
  }

  function parseXml(bytes) {
    const text = new TextDecoder("utf-8").decode(bytes);
    const doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.querySelector("parsererror")) throw new Error("Không đọc được nội dung XML trong tệp.");
    return doc;
  }

  /**
   * Đọc tệp .xlsx thành danh sách sheet, mỗi sheet là mảng các hàng,
   * mỗi hàng là mảng chuỗi. Ô trống trả về chuỗi rỗng.
   */
  async function read(buffer) {
    if (!supported()) {
      throw new Error("Trình duyệt này chưa hỗ trợ đọc .xlsx. Hãy lưu tệp sang định dạng CSV rồi nhập lại.");
    }
    const files = await unzip(buffer);
    if (!files["xl/workbook.xml"]) {
      throw new Error("Không phải tệp Excel .xlsx. Tệp .xls đời cũ cần mở bằng Excel rồi lưu lại dạng .xlsx hoặc CSV.");
    }

    // Chuỗi dùng chung
    let shared = [];
    if (files["xl/sharedStrings.xml"]) {
      const doc = parseXml(files["xl/sharedStrings.xml"]);
      shared = Array.from(doc.getElementsByTagName("si")).map((si) =>
        Array.from(si.getElementsByTagName("t")).map((t) => t.textContent).join(""));
    }

    // Tên sheet và tệp tương ứng
    const wb = parseXml(files["xl/workbook.xml"]);
    const rels = {};
    if (files["xl/_rels/workbook.xml.rels"]) {
      const rd = parseXml(files["xl/_rels/workbook.xml.rels"]);
      Array.from(rd.getElementsByTagName("Relationship")).forEach((r) => {
        rels[r.getAttribute("Id")] = r.getAttribute("Target");
      });
    }

    const sheets = [];
    const nodes = Array.from(wb.getElementsByTagName("sheet"));
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const rid = node.getAttribute("r:id") || node.getAttributeNS
        ? node.getAttribute("r:id") : null;
      let target = rid && rels[rid] ? rels[rid] : `worksheets/sheet${i + 1}.xml`;
      target = String(target).replace(/^\/?xl\//, "").replace(/^\//, "");
      const key = "xl/" + target;
      const data = files[key] || files[`xl/worksheets/sheet${i + 1}.xml`];
      if (!data) continue;

      const doc = parseXml(data);
      const rows = [];
      Array.from(doc.getElementsByTagName("row")).forEach((r) => {
        const rIndex = parseInt(r.getAttribute("r"), 10) - 1;
        const cells = [];
        Array.from(r.getElementsByTagName("c")).forEach((c) => {
          const ci = colOf(c.getAttribute("r") || "A1");
          const t = c.getAttribute("t");
          let v = "";
          if (t === "s") {
            const idx = parseInt((c.getElementsByTagName("v")[0] || {}).textContent, 10);
            v = shared[idx] !== undefined ? shared[idx] : "";
          } else if (t === "inlineStr") {
            v = Array.from(c.getElementsByTagName("t")).map((x) => x.textContent).join("");
          } else {
            const vn = c.getElementsByTagName("v")[0];
            v = vn ? vn.textContent : "";
          }
          cells[ci] = v;
        });
        for (let k = 0; k < cells.length; k++) if (cells[k] === undefined) cells[k] = "";
        rows[rIndex >= 0 ? rIndex : rows.length] = cells;
      });
      for (let k = 0; k < rows.length; k++) if (!rows[k]) rows[k] = [];
      sheets.push({ name: node.getAttribute("name") || `Sheet${i + 1}`, rows });
    }
    return sheets;
  }

  /* ------------------------------------------------------------------ */
  /* 3. Ghi bảng tính                                                    */
  /* ------------------------------------------------------------------ */
  const esc = (s) => String(s === null || s === undefined ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // XML 1.0 không nhận ký tự điều khiển
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");

  function colName(n) {
    let s = "";
    n += 1;
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  const isNumber = (v) => typeof v === "number" && isFinite(v);

  function sheetXml(sheet) {
    const rows = sheet.rows || [];
    const widths = sheet.widths || [];
    let cols = "";
    if (widths.length) {
      cols = "<cols>" + widths.map((w, i) =>
        `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("") + "</cols>";
    }
    const body = rows.map((row, ri) => {
      const cells = (row || []).map((cell, ci) => {
        const ref = colName(ci) + (ri + 1);
        const style = ri < (sheet.headerRows || 0) ? ' s="1"' : "";
        if (cell === null || cell === undefined || cell === "") return `<c r="${ref}"${style}/>`;
        if (isNumber(cell)) return `<c r="${ref}"${style}><v>${cell}</v></c>`;
        return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${esc(cell)}</t></is></c>`;
      }).join("");
      return `<row r="${ri + 1}">${cells}</row>`;
    }).join("");
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      cols + "<sheetData>" + body + "</sheetData></worksheet>";
  }

  const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border/></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="2"><xf xfId="0"/>' +
    '<xf xfId="0" fontId="1" applyFont="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    "</styleSheet>";

  /** Ghi nhiều sheet thành một Blob .xlsx. */
  async function write(sheets) {
    if (!supported()) throw new Error("Trình duyệt này chưa hỗ trợ tạo tệp .xlsx.");
    const enc = new TextEncoder();
    const files = {};

    files["[Content_Types].xml"] = enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
      "</Types>");

    files["_rels/.rels"] = enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      "</Relationships>");

    files["xl/workbook.xml"] = enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      sheets.map((s, i) => `<sheet name="${esc((s.name || "Sheet" + (i + 1)).slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
      "</sheets></workbook>");

    files["xl/_rels/workbook.xml.rels"] = enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
      `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      "</Relationships>");

    files["xl/styles.xml"] = enc.encode(STYLES);
    sheets.forEach((s, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = enc.encode(sheetXml(s)); });

    return zip(files);
  }

  /* ------------------------------------------------------------------ */
  /* 4. Đóng gói ZIP                                                     */
  /* ------------------------------------------------------------------ */
  const CRC_TABLE = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  async function zip(files) {
    const enc = new TextEncoder();
    const parts = [], central = [];
    let offset = 0;

    for (const name of Object.keys(files)) {
      const data = files[name];
      const nameBytes = enc.encode(name);
      const comp = await deflateRaw(data);
      const crc = crc32(data);

      const local = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);       // phiên bản cần để giải nén
      lv.setUint16(6, 0x0800, true);   // cờ: tên tệp mã hoá UTF-8
      lv.setUint16(8, 8, true);        // phương pháp nén: deflate
      lv.setUint16(10, 0, true);       // giờ
      lv.setUint16(12, 0x2821, true);  // ngày: 2020-01-01 cho ổn định
      lv.setUint32(14, crc, true);
      lv.setUint32(18, comp.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      local.set(nameBytes, 30);

      parts.push(local, comp);

      const cd = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(cd.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 8, true);
      cv.setUint16(12, 0, true);
      cv.setUint16(14, 0x2821, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, comp.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint32(42, offset, true);
      cd.set(nameBytes, 46);
      central.push(cd);

      offset += local.length + comp.length;
    }

    const cdSize = central.reduce((a, c) => a + c.length, 0);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, central.length, true);
    ev.setUint16(10, central.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, offset, true);

    return new Blob(parts.concat(central, [end]),
      { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  return { supported, read, write, colName };
})();
