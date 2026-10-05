/* =====================================================================
   view-quantri.js — màn hình quản trị: duyệt cố vấn, phân lớp, quản lý Khoa
   ---------------------------------------------------------------------
   Chỉ mở cho vai trò "owner" và "khoaAdmin". Quản trị Khoa chỉ thấy và
   chỉ sửa được người trong Khoa mình — đúng như quy tắc trên máy chủ.

   ĐIỂM DỄ SAI NHẤT của màn hình này: quyền xem một lớp được ghi ở HAI nơi.
     - classes[i].advisorId  — ứng dụng dùng để biết ai phụ trách lớp nào
     - advisors[uid].classIds — QUY TẮC trên máy chủ dùng để xét quyền
   Quy tắc Firestore không truy vấn ngược được, nên bắt buộc phải có bản
   sao thứ hai. Hai nơi lệch nhau thì giao diện hiện là có quyền mà máy chủ
   vẫn từ chối — lỗi rất khó hiểu. Mọi thay đổi ở đây đều đi qua
   ganLop()/boLop() để sửa cả hai, và có mục "Kiểm tra nhất quán" soi lại.
   ===================================================================== */
window.CV = window.CV || {};

CV.viewQuanTri = (function () {
  "use strict";
  const U = CV.util, el = U.el, ui = CV.ui, S = CV.store;

  const VAI_TRO = {
    owner:     "Tác giả sáng lập",
    khoaAdmin: "Quản trị Khoa",
    advisor:   "Cố vấn học tập",
    pending:   "Chờ duyệt"
  };

  const me = () => {
    const c = CV.auth.current();
    return c && c.kind === "advisor" ? c.user : null;
  };
  const laOwner = () => { const m = me(); return !!m && m.role === "owner"; };
  const laKhoaAdmin = () => { const m = me(); return !!m && m.role === "khoaAdmin"; };
  const duocQuanTri = () => laOwner() || laKhoaAdmin();

  /** Phạm vi: owner thấy toàn trường, quản trị Khoa chỉ thấy Khoa mình. */
  function trongTam(a) {
    if (laOwner()) return true;
    const m = me();
    return !!m && !!a && a.khoaId && a.khoaId === m.khoaId;
  }

  const dsKhoa = () => U.sortBy(S.all("khoa"), (x) => x.name || x.code || "");
  const dsGiangVien = () => U.sortBy(S.all("advisors").filter(trongTam),
    (x) => U.fold(x.name || ""));
  const dsLop = () => U.sortBy(S.all("classes").filter((c) =>
    laOwner() || (c.khoaId && c.khoaId === (me() || {}).khoaId)), (x) => x.code || "");

  const tenKhoa = (id) => { const k = S.get("khoa", id); return k ? (k.name || k.code || id) : ""; };

  /* ---------- giữ hai nơi khớp nhau ---------- */

  /* Bảng LỚP là nguồn sự thật: ai phụ trách lớp nào ghi ở classes.advisorId và
     classes.gvcnId. Trường advisors.classIds chỉ là BẢN SAO cho quy tắc máy chủ
     dùng, vì quy tắc không truy vấn ngược được. Nên mọi thay đổi đều sửa bảng
     lớp trước, rồi TÍNH LẠI classIds từ đó — không tự cộng trừ tay, vì cộng trừ
     tay là chỗ sinh ra lệch. */

  /** Giao một lớp cho một giảng viên, sửa cả hai nơi. */
  function ganLop(uid, classId, vaiTro) {
    const gv = S.get("advisors", uid);
    const lop = S.get("classes", classId);
    if (!gv || !lop) return false;
    S.put("classes", vaiTro === "gvcn" ? { id: classId, gvcnId: uid } : { id: classId, advisorId: uid });
    tinhLaiClassIds(uid);
    nhatKy("gan-lop", "Giao lớp " + (lop.code || classId) + " cho " +
      (gv.name || uid) + (vaiTro === "gvcn" ? " (GVCN)" : " (CVHT)"), gv.khoaId);
    return true;
  }

  /**
   * Thu hồi một lớp.
   * @param vaiTro "cvht" | "gvcn" — bỏ trống thì thu hồi cả hai vai trò.
   * Một người có thể vừa là CVHT vừa là GVCN cùng một lớp (Quyết định 758,
   * Điều 2.3), nên thu hồi một vai trò thì vẫn còn quyền xem lớp đó.
   */
  function boLop(uid, classId, vaiTro) {
    const gv = S.get("advisors", uid);
    const lop = S.get("classes", classId);
    if (!gv || !lop) return false;
    if (vaiTro !== "gvcn" && lop.advisorId === uid) {
      S.put("classes", { id: classId, advisorId: "" });
    }
    if (vaiTro !== "cvht" && lop.gvcnId === uid) {
      S.put("classes", { id: classId, gvcnId: "" });
    }
    tinhLaiClassIds(uid);
    nhatKy("bo-lop", "Thu hồi lớp " + (lop.code || classId) + " của " + (gv.name || uid) +
      (vaiTro ? (vaiTro === "gvcn" ? " (GVCN)" : " (CVHT)") : ""), gv.khoaId);
    return true;
  }

  /** Tính lại classIds của một người từ bảng lớp. Dùng khi phát hiện lệch. */
  function tinhLaiClassIds(uid) {
    const dung = S.all("classes")
      .filter((c) => c.advisorId === uid || c.gvcnId === uid)
      .map((c) => c.id);
    S.put("advisors", { id: uid, classIds: dung });
    return dung;
  }

  /** Những chỗ hai nơi đang lệch nhau. */
  function choLech() {
    const ra = [];
    dsGiangVien().forEach((gv) => {
      const khai = Array.isArray(gv.classIds) ? gv.classIds.slice().sort() : [];
      const that = S.all("classes")
        .filter((c) => c.advisorId === gv.id || c.gvcnId === gv.id)
        .map((c) => c.id).sort();
      if (khai.join("|") !== that.join("|")) {
        ra.push({ gv: gv, khai: khai, that: that });
      }
    });
    return ra;
  }

  function nhatKy(viec, moTa, khoaId) {
    if (CV.nhatKy && CV.nhatKy.ghi) CV.nhatKy.ghi(viec, moTa, khoaId);
  }

  /* ================= màn hình ================= */

  function render(host) {
    if (!duocQuanTri()) {
      host.appendChild(ui.card(null, [
        ui.empty("Không có quyền", "Màn hình này chỉ dành cho quản trị Khoa và tác giả hệ thống.")
      ]));
      return;
    }

    const body = el("div");
    host.appendChild(body);

    function ve() {
      body.innerHTML = "";
      khoiChoDuyet(body, ve);
      khoiGiangVien(body, ve);
      khoiPhanLop(body, ve);
      if (laOwner()) khoiKhoa(body, ve);
      khoiKiemTra(body, ve);
    }
    ve();
  }

  /* ---------- 1. chờ duyệt ---------- */

  function khoiChoDuyet(host, ve) {
    const cho = dsGiangVien().filter((a) => a.role === "pending");
    if (!cho.length) return;

    host.appendChild(ui.card(`Tài khoản chờ duyệt (${cho.length})`, [
      ui.note("Những tài khoản này đã đăng nhập bằng thư điện tử của Trường nhưng " +
              "chưa được phân quyền. Trước khi duyệt, hãy xác minh đúng là giảng viên " +
              "của đơn vị mình.", "warn"),
      ui.table([
        { key: "name", label: "Họ tên", render: (r) => r.name || "—" },
        { key: "email", label: "Thư điện tử", render: (r) => r.email || "—" },
        { key: "khoa", label: "Khoa khai báo", render: (r) => tenKhoa(r.khoaId) || r.khoaId || "—" },
        { key: "at", label: "Đăng ký lúc", render: (r) => U.dmyhm(r.createdAt) || "—" },
        { key: "act", label: "", render: (r) => el("div", { class: "row" }, [
            el("button", { class: "btn btn-primary btn-sm", text: "Duyệt",
              onclick: () => suaQuyen(r, ve) }),
            el("button", { class: "btn btn-ghost btn-sm", text: "Từ chối", onclick: async () => {
              if (!(await ui.confirm({ title: "Từ chối tài khoản", danger: true,
                message: `Xoá hồ sơ đăng ký của ${r.name || r.email}? ` +
                         `Người này có thể đăng ký lại sau.` }))) return;
              nhatKy("tu-choi", "Từ chối đăng ký của " + (r.email || r.id), r.khoaId);
              S.remove("advisors", r.id);
              ui.toast("Đã từ chối.", "ok");
              ve();
            } })
          ]) }
      ], cho, { emptyTitle: "—", emptyText: "" })
    ]));
  }

  /* ---------- 2. danh sách giảng viên ---------- */

  function khoiGiangVien(host, ve) {
    const ds = dsGiangVien().filter((a) => a.role !== "pending");
    const m = me();

    host.appendChild(ui.card(`Giảng viên (${ds.length})`, [
      ui.table([
        { key: "name", label: "Họ tên",
          render: (r) => (r.title ? r.title + " " : "") + (r.name || "—") },
        { key: "email", label: "Thư điện tử", render: (r) => r.email || "—" },
        { key: "role", label: "Vai trò", render: (r) =>
            el("span", { class: "badge badge-" + (r.role === "owner" ? "critical"
              : r.role === "khoaAdmin" ? "info" : "ok"),
              text: VAI_TRO[r.role] || r.role || "—" }) },
        { key: "khoa", label: "Khoa", render: (r) => tenKhoa(r.khoaId) || "—" },
        { key: "n", label: "Số lớp", num: true,
          render: (r) => String((r.classIds || []).length) },
        { key: "tt", label: "Trạng thái", render: (r) => r.active === false
            ? el("span", { class: "badge badge-warn", text: "Đã khoá" })
            : el("span", { class: "badge badge-ok", text: "Đang dùng" }) },
        { key: "act", label: "", render: (r) => {
            if (r.id === (m || {}).id) return el("span", { class: "badge badge-info", text: "Bạn" });
            // Quản trị Khoa không đụng được vào owner.
            if (r.role === "owner" && !laOwner()) return el("span", { class: "muted", text: "—" });
            return el("div", { class: "row" }, [
              el("button", { class: "btn btn-ghost btn-sm", text: "Sửa quyền",
                onclick: () => suaQuyen(r, ve) }),
              el("button", { class: "btn btn-ghost btn-sm",
                text: r.active === false ? "Mở khoá" : "Khoá", onclick: async () => {
                  const khoa = r.active !== false;
                  if (khoa && !(await ui.confirm({ title: "Khoá tài khoản", danger: true,
                    message: `Khoá tài khoản của ${r.name}? Người này sẽ không ` +
                             `vào được nữa cho tới khi mở lại.` }))) return;
                  S.put("advisors", { id: r.id, active: !khoa });
                  nhatKy(khoa ? "khoa-tk" : "mo-tk",
                    (khoa ? "Khoá" : "Mở khoá") + " tài khoản " + (r.email || r.id), r.khoaId);
                  ui.toast(khoa ? "Đã khoá." : "Đã mở khoá.", "ok");
                  ve();
                } })
            ]);
          } }
      ], ds, { emptyTitle: "Chưa có giảng viên nào",
               emptyText: "Giảng viên tự đăng ký bằng thư điện tử của Trường, rồi chờ duyệt ở đây." })
    ], { sub: laOwner() ? "Toàn trường" : "Chỉ " + (tenKhoa((m || {}).khoaId) || "Khoa của bạn") }));
  }

  /* ---------- sửa quyền một người ---------- */

  function suaQuyen(gv, ve) {
    const khoas = dsKhoa();
    const chonVaiTro = [
      { value: "pending", label: VAI_TRO.pending + " — chưa có quyền gì" },
      { value: "advisor", label: VAI_TRO.advisor + " — chỉ lớp được giao" }
    ];
    // Chỉ owner mới phong được quản trị Khoa và owner.
    if (laOwner()) {
      chonVaiTro.push({ value: "khoaAdmin", label: VAI_TRO.khoaAdmin + " — toàn bộ Khoa" });
      chonVaiTro.push({ value: "owner", label: VAI_TRO.owner + " — toàn trường" });
    }

    ui.formModal({
      title: "Phân quyền — " + (gv.name || gv.email || ""),
      intro: laOwner()
        ? "Quản trị Khoa duyệt và phân lớp trong Khoa mình, nhưng không nhập điểm thay cố vấn."
        : "Bạn chỉ phân quyền được trong Khoa mình, và không phong được vai trò quản trị.",
      fields: [
        { name: "name", label: "Họ và tên", value: gv.name || "", required: true, full: true },
        { name: "title", label: "Học hàm, học vị", value: gv.title || "" },
        { name: "phone", label: "Điện thoại", value: gv.phone || "" },
        { name: "role", label: "Vai trò", type: "select", value: gv.role || "pending",
          options: chonVaiTro, full: true },
        { name: "khoaId", label: "Khoa", type: "select",
          value: gv.khoaId || (laKhoaAdmin() ? (me() || {}).khoaId : ""),
          // Quản trị Khoa không kéo người sang Khoa khác: ô chọn chỉ có Khoa
          // của chính họ. Chặn thật vẫn nằm ở check() và ở quy tắc máy chủ.
          options: (laKhoaAdmin()
            ? khoas.filter((k) => k.id === (me() || {}).khoaId)
            : [{ id: "", name: "— Chưa thuộc Khoa nào —" }].concat(khoas)
          ).map((k) => ({ value: k.id, label: k.name || k.code })),
          full: true }
      ],
      check: (d) => {
        if (d.role !== "pending" && !d.khoaId) return "Phải chọn Khoa trước khi cấp quyền.";
        if (laKhoaAdmin() && d.khoaId !== (me() || {}).khoaId) {
          return "Bạn chỉ phân quyền được trong Khoa mình.";
        }
        if (d.role === "owner" && !laOwner()) return "Chỉ tác giả hệ thống mới phong được vai trò này.";
        return null;
      },
      okText: gv.role === "pending" ? "Duyệt" : "Lưu"
    }).then((d) => {
      if (!d) return;
      const cu = gv.role;
      S.put("advisors", {
        id: gv.id, name: d.name, title: d.title, phone: d.phone,
        role: d.role, khoaId: laKhoaAdmin() ? (me() || {}).khoaId : d.khoaId,
        active: true
      });
      nhatKy("phan-quyen",
        "Đổi vai trò của " + (gv.email || gv.id) + ": " + (VAI_TRO[cu] || cu) +
        " → " + (VAI_TRO[d.role] || d.role), d.khoaId);
      ui.toast(cu === "pending" ? "Đã duyệt. Giờ hãy giao lớp cho thầy/cô này." : "Đã lưu.", "ok");
      ve();
    });
  }

  /* ---------- 3. phân lớp ---------- */

  function khoiPhanLop(host, ve) {
    const lops = dsLop();
    const gvs = dsGiangVien().filter((a) => a.role !== "pending" && a.active !== false);

    const chon = (lop, truong) => {
      const sel = el("select", { style: "min-width:150px" },
        [el("option", { value: "", text: "— Chưa giao —" })].concat(
          gvs.map((g) => el("option", {
            value: g.id, text: (g.title ? g.title + " " : "") + (g.name || g.email),
            selected: lop[truong] === g.id ? "selected" : null
          }))));
      const vt = truong === "gvcnId" ? "gvcn" : "cvht";
      sel.addEventListener("change", () => {
        const cu = lop[truong];
        // Chỉ thu hồi ĐÚNG vai trò đang đổi, không đụng vai trò kia.
        if (cu) boLop(cu, lop.id, vt);
        if (sel.value) ganLop(sel.value, lop.id, vt);
        else S.put("classes", { id: lop.id, [truong]: "" });
        ui.toast("Đã cập nhật phân công.", "ok");
        ve();
      });
      return sel;
    };

    host.appendChild(ui.card(`Phân công lớp (${lops.length})`, [
      ui.note("Đổi ở đây là ứng dụng sửa luôn cả danh sách lớp trên hồ sơ giảng viên — " +
              "thứ mà máy chủ dùng để xét quyền. Hai nơi phải khớp nhau thì thầy/cô mới " +
              "thật sự mở được dữ liệu lớp.", "info"),
      ui.table([
        { key: "code", label: "Lớp", render: (r) => r.code || "—" },
        { key: "name", label: "Tên lớp", render: (r) => r.name || "—" },
        { key: "khoa", label: "Khoa", render: (r) => tenKhoa(r.khoaId) || "—" },
        { key: "n", label: "Sĩ số", num: true,
          render: (r) => String(S.find("students", (s) => s.classId === r.id).length) },
        { key: "cv", label: "Cố vấn học tập", render: (r) => chon(r, "advisorId") },
        { key: "gv", label: "Giáo viên chủ nhiệm", render: (r) => chon(r, "gvcnId") }
      ], lops, { emptyTitle: "Chưa có lớp nào",
                 emptyText: "Tạo lớp ở màn hình Lớp cố vấn trước." })
    ], { sub: "Quyết định 758/QĐ-ĐHXDMT, Điều 2.3: một người có thể làm CVHT lớp này và GVCN lớp kia" }));
  }

  /* ---------- 4. khoa ---------- */

  function khoiKhoa(host, ve) {
    const ds = dsKhoa();
    const sua = (k) => {
      ui.formModal({
        title: k ? "Sửa Khoa" : "Thêm Khoa",
        fields: [
          { name: "code", label: "Mã Khoa", value: (k && k.code) || "", required: true,
            placeholder: "XD", hint: "Chữ viết tắt ngắn gọn, ví dụ XD, KT, CNTT." },
          { name: "name", label: "Tên Khoa", value: (k && k.name) || "", required: true, full: true,
            placeholder: "Khoa Xây dựng" },
          { name: "dean", label: "Trưởng Khoa", value: (k && k.dean) || "", full: true }
        ],
        check: (d) => {
          const trung = S.first("khoa", (x) => U.fold(x.code) === U.fold(d.code) &&
            (!k || x.id !== k.id));
          return trung ? "Mã Khoa này đã có." : null;
        }
      }).then((d) => {
        if (!d) return;
        S.put("khoa", Object.assign(k ? { id: k.id } : {}, d, { active: true }));
        nhatKy(k ? "sua-khoa" : "them-khoa", (k ? "Sửa" : "Thêm") + " Khoa " + d.code, d.code);
        ui.toast("Đã lưu.", "ok");
        ve();
      });
    };

    host.appendChild(ui.card(`Khoa (${ds.length})`, [
      ui.table([
        { key: "code", label: "Mã", render: (r) => r.code || "—" },
        { key: "name", label: "Tên Khoa", render: (r) => r.name || "—" },
        { key: "dean", label: "Trưởng Khoa", render: (r) => r.dean || "—" },
        { key: "n", label: "Số lớp", num: true,
          render: (r) => String(S.find("classes", (c) => c.khoaId === r.id).length) },
        { key: "act", label: "", render: (r) => el("div", { class: "row" }, [
            el("button", { class: "btn btn-ghost btn-sm", text: "Sửa", onclick: () => sua(r) }),
            el("button", { class: "btn btn-ghost btn-sm", text: "Xoá", onclick: async () => {
              const n = S.find("classes", (c) => c.khoaId === r.id).length;
              if (n) { ui.toast(`Khoa này còn ${n} lớp. Chuyển lớp sang Khoa khác trước.`, "err"); return; }
              const ng = S.find("advisors", (a) => a.khoaId === r.id).length;
              if (ng) { ui.toast(`Khoa này còn ${ng} giảng viên. Chuyển họ trước.`, "err"); return; }
              if (!(await ui.confirm({ title: "Xoá Khoa", danger: true,
                message: `Xoá ${r.name}?` }))) return;
              nhatKy("xoa-khoa", "Xoá Khoa " + (r.code || r.id), r.code);
              S.remove("khoa", r.id);
              ui.toast("Đã xoá.", "ok");
              ve();
            } })
          ]) }
      ], ds, { emptyTitle: "Chưa khai báo Khoa nào",
               emptyText: "Mỗi lớp và mỗi giảng viên đều thuộc về một Khoa." })
    ], { actions: [el("button", { class: "btn btn-primary btn-sm", text: "+ Thêm Khoa",
      onclick: () => sua(null) })] }));
  }

  /* ---------- 5. kiểm tra nhất quán ---------- */

  function khoiKiemTra(host, ve) {
    const lech = choLech();
    if (!lech.length) {
      host.appendChild(ui.card("Kiểm tra nhất quán", [
        ui.note("Danh sách lớp trên hồ sơ giảng viên khớp với bảng phân công. " +
                "Máy chủ sẽ mở đúng những lớp mà giao diện đang hiện.", "ok")
      ]));
      return;
    }

    host.appendChild(ui.card(`Lệch phân quyền (${lech.length})`, [
      ui.note("Những người này có danh sách lớp trên hồ sơ KHÔNG khớp với bảng phân công. " +
              "Hậu quả: giao diện hiện là có quyền nhưng máy chủ vẫn từ chối, hoặc ngược lại. " +
              "Bấm Sửa lại để tính lại theo bảng phân công.", "warn"),
      ui.table([
        { key: "name", label: "Giảng viên", render: (r) => r.gv.name || r.gv.email || "—" },
        { key: "khai", label: "Hồ sơ đang ghi", render: (r) => r.khai.length
            ? r.khai.map((id) => (S.get("classes", id) || {}).code || id).join(", ") : "(trống)" },
        { key: "that", label: "Bảng phân công", render: (r) => r.that.length
            ? r.that.map((id) => (S.get("classes", id) || {}).code || id).join(", ") : "(trống)" },
        { key: "act", label: "", render: (r) => el("button", {
            class: "btn btn-primary btn-sm", text: "Sửa lại", onclick: () => {
              tinhLaiClassIds(r.gv.id);
              nhatKy("sua-lech", "Tính lại danh sách lớp của " + (r.gv.email || r.gv.id), r.gv.khoaId);
              ui.toast("Đã sửa lại.", "ok");
              ve();
            } }) }
      ], lech, { emptyTitle: "—", emptyText: "" })
    ], { actions: [el("button", { class: "btn btn-ghost btn-sm", text: "Sửa lại tất cả",
      onclick: () => {
        lech.forEach((r) => tinhLaiClassIds(r.gv.id));
        nhatKy("sua-lech", "Tính lại danh sách lớp cho " + lech.length + " giảng viên", "");
        ui.toast("Đã sửa lại " + lech.length + " hồ sơ.", "ok");
        ve();
      } })] }));
  }

  /* ================= màn hình nhật ký ================= */

  function renderNhatKy(host) {
    if (!duocQuanTri()) {
      host.appendChild(ui.card(null, [
        ui.empty("Không có quyền", "Nhật ký chỉ mở cho quản trị Khoa và tác giả hệ thống.")
      ]));
      return;
    }

    const body = el("div");
    host.appendChild(body);
    body.appendChild(ui.card(null, [ui.note("Đang tải nhật ký…", "info")]));

    CV.nhatKy.doc(300).then((kq) => {
      body.innerHTML = "";

      if (kq.nguon === "loi") {
        body.appendChild(ui.card("Nhật ký hoạt động", [ui.note(kq.loi, "warn")]));
        return;
      }

      const duPhong = CV.nhatKy.soDuPhong();
      const ghiChu = kq.nguon === "cuc-bo"
        ? ui.note("Chưa bật đồng bộ nên nhật ký chỉ nằm trên máy này: xoá dữ liệu " +
                  "trình duyệt là mất, và người dùng về lý thuyết sửa được. " +
                  "Bật đồng bộ thì nhật ký nằm trên máy chủ, chỉ ghi thêm, " +
                  "không ai sửa hay xoá được — kể cả tác giả hệ thống.", "warn")
        : ui.note("Nhật ký nằm trên máy chủ. Quy tắc chỉ cho GHI THÊM: không ai " +
                  "sửa hay xoá được dòng đã ghi, kể cả tác giả hệ thống. " +
                  "Dấu thời gian do máy chủ đặt nên không khai man được.", "ok");

      body.appendChild(ui.card(`Nhật ký hoạt động (${kq.dong.length} dòng gần nhất)`, [
        ghiChu,
        duPhong ? ui.note("Có " + duPhong + " dòng chưa đẩy được lên máy chủ, " +
          "đang nằm tạm dưới máy. Kiểm tra lại kết nối.", "warn") : null,
        ui.table([
          { key: "at", label: "Thời điểm", render: (r) => U.dmyhm(r.at) || "—" },
          { key: "viec", label: "Việc", render: (r) =>
              el("span", { class: "badge badge-info", text: CV.nhatKy.tenViec(r.viec) }) },
          { key: "moTa", label: "Nội dung", render: (r) => r.moTa || "—" },
          { key: "ai", label: "Người làm", render: (r) => r.ten || r.email || r.uid || "—" },
          { key: "khoa", label: "Khoa", render: (r) => tenKhoa(r.khoaId) || r.khoaId || "—" }
        ], kq.dong, {
          emptyTitle: "Chưa có hoạt động nào được ghi",
          emptyText: "Nhật ký ghi lại những việc đụng tới quyền hạn và dữ liệu cá nhân."
        })
      ]));
    });
  }

  return { render, renderNhatKy, duocQuanTri, laOwner, laKhoaAdmin,
    ganLop, boLop, tinhLaiClassIds, choLech, VAI_TRO };
})();
