/* =====================================================================
   cloud-config.js — khai báo dự án Firebase
   ---------------------------------------------------------------------
   Để enabled: false thì ứng dụng chạy gói gọn trong một máy, như trước.
   Điền xong và đặt enabled: true thì mới bật phần đồng bộ nhiều thiết bị.

   KHÔNG có bí mật nào trong tệp này. Theo thiết kế của Firebase, apiKey
   phía trình duyệt không phải khoá bí mật — nó chỉ để biết gọi tới dự án
   nào. Cái giữ an toàn là bộ quy tắc ở server/firestore.rules.
   Vì vậy ĐỪNG bật enabled trước khi đã dán bộ quy tắc đó lên Firebase.
   ===================================================================== */
window.CV = window.CV || {};

CV.cloudConfig = {

  /* Bật/tắt toàn bộ phần đồng bộ. */
  enabled: false,

  /* Thư điện tử của Trường chạy trên Google Workspace, nên để "google".
     Vẫn nhận "microsoft" (Microsoft 365) hoặc "ca-hai" (hiện cả hai nút)
     phòng khi về sau Trường đổi nền. */
  provider: "google",

  /* Tên miền thư điện tử của Trường.
     Ba việc: (1) bảo Google chỉ hiện tài khoản thuộc Trường trong ô chọn;
     (2) ứng dụng tự kiểm lại sau khi đăng nhập và thoát ngay nếu sai tên miền;
     (3) báo lỗi cho dễ hiểu. Chặn cuối cùng vẫn nằm ở quy tắc trên máy chủ. */
  hostedDomain: "mtu.edu.vn",

  /* Chỉ dùng tới khi đổi sang Microsoft. Bỏ qua khi provider là "google". */
  tenantId: "organizations",

  /* Lấy ở Firebase Console → Project settings → General → Your apps → Web app.
     Dán nguyên khối cấu hình vào đây. */
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  }
};
