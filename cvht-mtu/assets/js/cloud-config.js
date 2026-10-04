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

  /* Đăng nhập bằng nền nào.
     "google"    — thư của Trường chạy trên Google Workspace
     "microsoft" — thư của Trường chạy trên Microsoft 365
     "ca-hai"    — hiện cả hai nút, để người dùng tự chọn

     Chưa chắc dùng nền nào thì xem lúc đăng nhập hộp thư của Trường:
       accounts.google.com        → Google
       login.microsoftonline.com  → Microsoft
     Hoặc cứ để "ca-hai", bật nền nào trong Firebase Console thì nền đó chạy. */
  provider: "ca-hai",

  /* Tên miền thư điện tử của Trường. Dùng để gợi ý trình duyệt chỉ hiện tài
     khoản thuộc Trường, và để báo lỗi cho dễ hiểu. Chặn thật nằm ở quy tắc. */
  hostedDomain: "mtu.edu.vn",

  /* Chỉ cần khi dùng Microsoft: mã tenant của Trường, hoặc để "organizations"
     nếu muốn nhận mọi tài khoản cơ quan (vẫn bị quy tắc lọc lại theo tên miền). */
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
