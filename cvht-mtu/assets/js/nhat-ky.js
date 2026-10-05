/* =====================================================================
   nhat-ky.js — nhật ký hoạt động
   ---------------------------------------------------------------------
   Ghi lại những việc đụng tới quyền hạn và dữ liệu cá nhân, để khi cần
   còn truy được ai làm gì, lúc nào.

   KHÔNG đi qua store.js như các bảng khác, vì quy tắc trên máy chủ đòi
   hai điều mà put() thông thường không làm được:
     - dấu thời gian phải là GIỜ MÁY CHỦ (request.time), máy khách không
       khai man được;
     - chỉ được ghi thêm, không ai sửa, không ai xoá — kể cả owner.
   Nên tệp này ghi thẳng vào Firestore. Chưa bật đồng bộ thì ghi tạm vào
   bộ nhớ trình duyệt, và nói rõ là chỉ có giá trị tham khảo.
   ===================================================================== */
window.CV = window.CV || {};

CV.nhatKy = (function () {
  "use strict";
  const U = CV.util;
  const KHOA_CUC_BO = "CVHT_MTU_NHATKY_V1";
  const GIU_CUC_BO = 500;          // giữ tối đa ngần này dòng dưới máy

  /** Tên việc → câu mô tả ngắn, để bảng đọc được. */
  const VIEC = {
    "dang-nhap":   "Đăng nhập",
    "dang-xuat":   "Đăng xuất",
    "phan-quyen":  "Đổi vai trò",
    "gan-lop":     "Giao lớp",
    "bo-lop":      "Thu hồi lớp",
    "khoa-tk":     "Khoá tài khoản",
    "mo-tk":       "Mở khoá tài khoản",
    "tu-choi":     "Từ chối đăng ký",
    "them-khoa":   "Thêm Khoa",
    "sua-khoa":    "Sửa Khoa",
    "xoa-khoa":    "Xoá Khoa",
    "sua-lech":    "Sửa lệch phân quyền",
    "xuat-vb":     "Xuất văn bản",
    "nhap-ds":     "Nhập danh sách",
    "xoa-sv":      "Xoá sinh viên",
    "nap-du-lieu": "Nạp dữ liệu lên máy chủ"
  };
  const tenViec = (v) => VIEC[v] || v || "—";

  const tren_may_chu = () =>
    !!(CV.cloud && CV.cloud.db && CV.cloud.scope && CV.cloud.scope.uid);

  function aiDangLam() {
    if (tren_may_chu()) {
      const sc = CV.cloud.scope;
      return { uid: sc.uid, email: sc.email || "", ten: sc.name || "" };
    }
    const c = CV.auth && CV.auth.current ? CV.auth.current() : null;
    const u = c && c.user ? c.user : {};
    return { uid: u.id || "", email: u.email || "", ten: u.name || "" };
  }

  /* ---------- ghi ---------- */

  /**
   * @param viec   mã việc, xem bảng VIEC
   * @param moTa   câu mô tả cho người đọc
   * @param khoaId Khoa liên quan, để quản trị Khoa đọc được phần của mình
   */
  function ghi(viec, moTa, khoaId) {
    const ai = aiDangLam();
    const dong = {
      viec: String(viec || ""),
      moTa: String(moTa || ""),
      khoaId: String(khoaId || ""),
      uid: ai.uid,
      email: ai.email,
      ten: ai.ten
    };

    if (tren_may_chu()) {
      // Dấu thời gian do máy chủ đặt — quy tắc bắt buộc vậy.
      const fb = window.firebase;
      const ban = Object.assign({}, dong, {
        at: fb.firestore.FieldValue.serverTimestamp()
      });
      try {
        CV.cloud.db.collection("audit").doc(U.uid("log")).set(ban)
          .catch((e) => {
            console.warn("Không ghi được nhật ký lên máy chủ:", e);
            ghiCucBo(dong, true);
          });
      } catch (e) {
        console.warn("Không ghi được nhật ký:", e);
        ghiCucBo(dong, true);
      }
      return true;
    }

    ghiCucBo(dong, false);
    return true;
  }

  function ghiCucBo(dong, laDuPhong) {
    try {
      const ds = docCucBo();
      ds.unshift(Object.assign({}, dong, {
        id: U.uid("log"),
        at: new Date().toISOString(),
        cucBo: true,
        duPhong: !!laDuPhong
      }));
      window.localStorage.setItem(KHOA_CUC_BO,
        JSON.stringify(ds.slice(0, GIU_CUC_BO)));
    } catch (e) { /* đầy bộ nhớ thì thôi, không làm hỏng việc chính */ }
  }

  function docCucBo() {
    try {
      const raw = window.localStorage.getItem(KHOA_CUC_BO);
      const ds = raw ? JSON.parse(raw) : [];
      return Array.isArray(ds) ? ds : [];
    } catch (e) { return []; }
  }

  /* ---------- đọc ---------- */

  /**
   * Lấy các dòng gần đây. Trả về Promise vì bản trên máy chủ phải hỏi mạng.
   * Quyền đọc do quy tắc quyết định: owner đọc tất cả, quản trị Khoa đọc
   * phần Khoa mình, người khác bị từ chối.
   */
  async function doc(gioiHan) {
    const n = gioiHan || 200;
    if (!tren_may_chu()) {
      return { nguon: "cuc-bo", dong: docCucBo().slice(0, n) };
    }
    try {
      const snap = await CV.cloud.db.collection("audit")
        .orderBy("at", "desc").limit(n).get();
      const dong = [];
      snap.forEach((d) => {
        const v = d.data() || {};
        dong.push(Object.assign({}, v, {
          id: d.id,
          at: v.at && v.at.toDate ? v.at.toDate().toISOString() : ""
        }));
      });
      return { nguon: "may-chu", dong: dong };
    } catch (e) {
      const ma = (e && e.code) || "";
      return {
        nguon: "loi",
        dong: [],
        loi: ma === "permission-denied"
          ? "Tài khoản này không có quyền đọc nhật ký."
          : ma === "failed-precondition"
            ? "Thiếu chỉ mục cho nhật ký. Mở Console của trình duyệt, Firebase sẽ " +
              "in ra đường dẫn tạo chỉ mục chỉ cần bấm một cái."
            : "Không đọc được nhật ký: " + (e && e.message ? e.message : ma)
      };
    }
  }

  /** Số dòng đang nằm tạm dưới máy vì chưa đẩy lên được. */
  const soDuPhong = () => docCucBo().filter((x) => x.duPhong).length;

  return { ghi, doc, tenViec, VIEC, soDuPhong,
    get trenMayChu() { return tren_may_chu(); } };
})();
