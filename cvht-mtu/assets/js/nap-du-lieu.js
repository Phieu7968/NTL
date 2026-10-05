/* =====================================================================
   nap-du-lieu.js — đưa dữ liệu đang có dưới máy lên Firestore
   ---------------------------------------------------------------------
   Việc làm MỘT LẦN khi chuyển từ chạy một máy sang chạy nhiều máy.

   Nguyên tắc: SOÁT TRƯỚC, NẠP SAU.
   Quy tắc trên máy chủ từ chối những bản ghi thiếu trường nó cần xét quyền
   (classId, khoaId) hoặc mang trường cấm (CCCD). Nạp bừa rồi mới biết thì
   nửa dữ liệu lên được nửa không, rất khó dọn. Nên tệp này soát hết một
   lượt, báo rõ từng chỗ hỏng, rồi mới cho bấm nạp.
   ===================================================================== */
window.CV = window.CV || {};

CV.napDuLieu = (function () {
  "use strict";
  const U = CV.util, S = CV.store;

  /* Firestore cho tối đa 500 thao tác mỗi mẻ ghi. Để 400 cho chắc. */
  const MOI_ME = 400;

  /* Trường bị cấm tuyệt đối — quy tắc máy chủ cũng chặn, đây là lớp thứ nhất. */
  const TRUONG_CAM = ["cccd", "soCccd", "cmnd", "canCuoc"];

  const sanSang = () =>
    !!(CV.cloud && CV.cloud.db && CV.cloud.scope && CV.cloud.scope.uid);

  /* ================= soát ================= */

  /**
   * Soát toàn bộ dữ liệu dưới máy, trả về danh sách vấn đề.
   * Mỗi vấn đề: { muc, nang, soLuong, moTa, cachSua }
   *   nang = "chan"  → nạp lên sẽ bị máy chủ từ chối, phải sửa trước
   *   nang = "nhac"  → nạp được nhưng sẽ vướng về sau
   */
  function soat() {
    const vd = [];
    const lops = S.all("classes");
    const svs = S.all("students");

    /* --- 1. trường cấm --- */
    S.COLLECTIONS.forEach((col) => {
      const dinh = S.all(col).filter((r) =>
        TRUONG_CAM.some((t) => r[t] !== undefined && r[t] !== ""));
      if (dinh.length) {
        vd.push({ muc: col, nang: "chan", soLuong: dinh.length,
          moTa: "Có " + dinh.length + " bản ghi còn giữ số căn cước công dân.",
          cachSua: "Hệ thống này không lưu căn cước. Bấm “Dọn trường cấm” để xoá " +
                   "khỏi dữ liệu dưới máy trước khi nạp." });
      }
    });

    /* --- 2. lớp thiếu Khoa --- */
    const lopThieuKhoa = lops.filter((c) => !c.khoaId);
    if (lopThieuKhoa.length) {
      vd.push({ muc: "classes", nang: "chan", soLuong: lopThieuKhoa.length,
        moTa: "Có " + lopThieuKhoa.length + " lớp chưa thuộc Khoa nào: " +
              lopThieuKhoa.slice(0, 5).map((c) => c.code || c.id).join(", ") +
              (lopThieuKhoa.length > 5 ? "…" : ""),
        cachSua: "Quy tắc máy chủ xét quyền theo Khoa. Vào màn hình Quản trị, " +
                 "khai báo Khoa rồi gán Khoa cho từng lớp." });
    }

    /* --- 3. sinh viên thiếu lớp --- */
    const svThieuLop = svs.filter((s) => !s.classId || !S.get("classes", s.classId));
    if (svThieuLop.length) {
      vd.push({ muc: "students", nang: "chan", soLuong: svThieuLop.length,
        moTa: "Có " + svThieuLop.length + " sinh viên chưa thuộc lớp nào, " +
              "hoặc trỏ tới lớp đã bị xoá.",
        cachSua: "Quy tắc máy chủ xét quyền theo lớp, thiếu là bị từ chối. " +
                 "Mở màn hình Sinh viên, gán lớp cho những em này." });
    }

    /* --- 4. bản ghi phụ thiếu classId --- */
    S.CLASS_SCOPED.forEach((col) => {
      if (col === "students") return;
      const thieu = S.all(col).filter((r) => !r.classId);
      if (thieu.length) {
        vd.push({ muc: col, nang: "chan", soLuong: thieu.length,
          moTa: "Có " + thieu.length + " bản ghi thiếu mã lớp.",
          cachSua: "Thường là do bản ghi trỏ tới sinh viên đã bị xoá. " +
                   "Bấm “Điền lại mã lớp” để tính lại từ sinh viên; " +
                   "bản ghi nào không tính được thì nên xoá." });
      }
    });

    /* --- 5. sinh viên chưa có thư điện tử --- */
    const svThieuMail = svs.filter((s) => !String(s.authEmail || "").trim());
    if (svThieuMail.length) {
      vd.push({ muc: "students", nang: "nhac", soLuong: svThieuMail.length,
        moTa: "Có " + svThieuMail.length + "/" + svs.length +
              " sinh viên chưa có địa chỉ thư của Trường.",
        cachSua: "Những em này nạp lên được, nhưng CHƯA đăng nhập được: " +
                 "ứng dụng nhận ra sinh viên bằng cách đối chiếu địa chỉ thư. " +
                 "Bổ sung cột thư điện tử vào danh sách lớp rồi nhập lại." });
    }

    /* --- 6. trùng mã số sinh viên --- */
    const dem = {};
    svs.forEach((s) => { const m = String(s.mssv || "").trim(); if (m) dem[m] = (dem[m] || 0) + 1; });
    const trung = Object.keys(dem).filter((m) => dem[m] > 1);
    if (trung.length) {
      vd.push({ muc: "students", nang: "nhac", soLuong: trung.length,
        moTa: "Có " + trung.length + " mã số sinh viên bị trùng: " +
              trung.slice(0, 5).join(", ") + (trung.length > 5 ? "…" : ""),
        cachSua: "Mã số trùng thì mọi giấy tờ về sau đều lẫn. Sửa trước khi nạp." });
    }

    /* --- 7. trùng địa chỉ thư --- */
    const demMail = {};
    svs.forEach((s) => {
      const e = String(s.authEmail || "").trim().toLowerCase();
      if (e) demMail[e] = (demMail[e] || 0) + 1;
    });
    const trungMail = Object.keys(demMail).filter((e) => demMail[e] > 1);
    if (trungMail.length) {
      vd.push({ muc: "students", nang: "chan", soLuong: trungMail.length,
        moTa: "Có " + trungMail.length + " địa chỉ thư bị dùng cho nhiều sinh viên: " +
              trungMail.slice(0, 3).join(", "),
        cachSua: "Mỗi địa chỉ chỉ được ứng với một sinh viên, nếu không thì " +
                 "ứng dụng không biết mở hồ sơ của em nào. Sửa trước khi nạp." });
    }

    return vd;
  }

  const coChan = (vd) => vd.some((x) => x.nang === "chan");

  /** Đếm số bản ghi sẽ nạp, theo từng bảng. */
  function demSeNap() {
    const ra = {};
    let tong = 0;
    S.COLLECTIONS.forEach((col) => {
      const n = S.all(col).length;
      if (n) { ra[col] = n; tong += n; }
    });
    return { theoBang: ra, tong: tong };
  }

  /* ================= dọn ================= */

  /** Xoá hẳn những trường bị cấm khỏi dữ liệu dưới máy. */
  function donTruongCam() {
    let n = 0;
    S.COLLECTIONS.forEach((col) => {
      S.all(col).forEach((r) => {
        let dinh = false;
        TRUONG_CAM.forEach((t) => {
          if (r[t] !== undefined) { delete r[t]; dinh = true; }
        });
        if (dinh) n++;
      });
    });
    if (n) S.save("don-truong-cam");
    return n;
  }

  /** Tính lại classId cho các bản ghi phụ, dựa vào sinh viên mà nó trỏ tới. */
  function dienLaiMaLop() {
    let sua = 0, chiu = 0;
    S.CLASS_SCOPED.forEach((col) => {
      if (col === "students") return;
      S.all(col).forEach((r) => {
        if (r.classId) return;
        const st = r.studentId ? S.get("students", r.studentId) : null;
        if (st && st.classId) { r.classId = st.classId; sua++; }
        else chiu++;
      });
    });
    if (sua) S.save("dien-lai-ma-lop");
    return { sua: sua, chiu: chiu };
  }

  /* ================= nạp ================= */

  /**
   * Đẩy toàn bộ dữ liệu lên Firestore theo từng mẻ.
   * @param tien  hàm nhận {bang, xong, tong, me} để vẽ thanh tiến độ
   * @returns { ok, daNap, loi: [{bang, so, thong}] }
   */
  async function nap(tien) {
    if (!sanSang()) {
      return { ok: false, daNap: 0, loi: [{ bang: "", so: 0,
        thong: "Chưa đăng nhập bằng tài khoản Trường, hoặc chưa bật đồng bộ." }] };
    }
    const db = CV.cloud.db;
    const loi = [];
    let daNap = 0;

    // Nạp theo thứ tự: khoa và lớp trước, vì quy tắc xét quyền của sinh viên
    // phải tra ngược lên lớp. Lớp chưa có thì sinh viên bị từ chối hết.
    const thuTu = ["khoa", "classes", "advisors", "semesters", "handbook",
      "templates", "students"].concat(
      S.COLLECTIONS.filter((c) => ["khoa", "classes", "advisors", "semesters",
        "handbook", "templates", "students"].indexOf(c) === -1));

    const tongTatCa = thuTu.reduce((a, c) => a + S.all(c).length, 0);
    let xongTatCa = 0;

    for (let i = 0; i < thuTu.length; i++) {
      const col = thuTu[i];
      const rows = S.all(col);
      if (!rows.length) continue;

      for (let j = 0; j < rows.length; j += MOI_ME) {
        const me = rows.slice(j, j + MOI_ME);
        try {
          const lo = db.batch();
          me.forEach((r) => {
            const sach = {};
            Object.keys(r).forEach((k) => {
              if (r[k] !== undefined && TRUONG_CAM.indexOf(k) === -1) sach[k] = r[k];
            });
            lo.set(db.collection(col).doc(String(r.id)), sach, { merge: true });
          });
          await lo.commit();
          daNap += me.length;
        } catch (e) {
          loi.push({ bang: col, so: me.length, thong: dienGiai(e) });
        }
        xongTatCa += me.length;
        if (tien) {
          try { tien({ bang: col, xong: xongTatCa, tong: tongTatCa }); }
          catch (e) { /* lỗi vẽ không được làm hỏng việc nạp */ }
        }
      }
    }

    if (CV.nhatKy) {
      CV.nhatKy.ghi("nap-du-lieu",
        "Nạp dữ liệu lên máy chủ: " + daNap + "/" + tongTatCa + " bản ghi" +
        (loi.length ? ", " + loi.length + " mẻ lỗi" : ""),
        (CV.cloud.scope && CV.cloud.scope.khoaId) || "");
    }
    return { ok: !loi.length, daNap: daNap, tong: tongTatCa, loi: loi };
  }

  function dienGiai(e) {
    const ma = (e && e.code) || "";
    if (ma === "permission-denied") {
      return "Máy chủ từ chối. Thường là do bản ghi thiếu mã lớp hoặc mã Khoa, " +
             "hoặc tài khoản này chưa đủ quyền. Soát lại rồi thử lại.";
    }
    if (ma === "unavailable") return "Mất kết nối giữa chừng. Nối mạng rồi nạp lại.";
    return "Lỗi: " + (e && e.message ? e.message : ma || "không rõ");
  }

  return { soat, coChan, demSeNap, donTruongCam, dienLaiMaLop, nap,
    sanSang, TRUONG_CAM, MOI_ME };
})();
