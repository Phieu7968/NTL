/* =====================================================================
   cloud.js — nơi cất giữ thật: Cloud Firestore
   ---------------------------------------------------------------------
   Cắm vào store.js qua CV.store.useBackend(). Không nạp tệp này thì ứng
   dụng vẫn chạy y như trước, chỉ gói gọn trong một máy.

   Ba việc tệp này làm:
     1. Đăng nhập bằng tài khoản thư điện tử của Trường.
     2. Nghe thay đổi theo thời gian thực, đổ vào bản sao của store.js.
     3. Đẩy ngược những gì người dùng sửa lên máy chủ.

   Điều KHÔNG làm: xét quyền. Quyền do quy tắc trên máy chủ quyết định
   (server/firestore.rules). Ở đây chỉ hỏi đúng phần mình được phép hỏi;
   hỏi quá thì máy chủ từ chối, và như thế là đúng.
   ===================================================================== */
window.CV = window.CV || {};

CV.cloud = (function () {
  "use strict";

  /* Firestore giới hạn 30 giá trị cho mỗi truy vấn "in". Cố vấn phụ trách
     nhiều hơn 30 lớp thì chia thành nhiều truy vấn. */
  const IN_LIMIT = 30;

  const SETTINGS_COL = "advisor_settings";
  const LINKS_COL = "links";

  let app = null;
  let fdb = null;
  let fauth = null;
  let cfg = null;

  let unsubs = [];
  let scope = null;          // { kind, uid, email, classIds, studentId, khoaId }
  let authCbs = new Set();

  const state = {
    online: false,
    pending: 0,
    lastAt: "",
    lastError: "",
    loaded: 0,        // số bộ sưu tập đã nhận xong lượt đầu
    expected: 0
  };

  const available = () => typeof window.firebase !== "undefined"
    && typeof window.firebase.initializeApp === "function";

  /* ================= khởi động ================= */

  /**
   * @param config  cấu hình Firebase của dự án
   * @param opts    { provider: "google" | "microsoft" }
   */
  async function init(config, opts) {
    if (!available()) throw new Error("Chưa nạp được thư viện Firebase.");
    if (app) return app;
    cfg = Object.assign({ provider: "google" }, opts || {});

    app = window.firebase.initializeApp(config);
    fdb = window.firebase.firestore();
    fauth = window.firebase.auth();

    // Bộ nhớ đệm bền: đọc được khi không mạng, ghi thì xếp hàng rồi tự đẩy.
    // synchronizeTabs để mở nhiều tab trên cùng một máy không giẫm lên nhau.
    try {
      await fdb.enablePersistence({ synchronizeTabs: true });
    } catch (e) {
      // failed-precondition = nhiều tab mà trình duyệt không cho đồng bộ;
      // unimplemented = trình duyệt không hỗ trợ. Cả hai đều chạy tiếp được,
      // chỉ là mất khả năng đọc khi không mạng.
      console.warn("Không bật được bộ nhớ đệm bền:", e && e.code);
      state.lastError = "Máy này không giữ được dữ liệu để dùng khi mất mạng.";
    }

    fauth.onAuthStateChanged((user) => {
      authCbs.forEach((fn) => { try { fn(user); } catch (e) { console.error(e); } });
    });

    return app;
  }

  function onAuth(fn) { authCbs.add(fn); return () => authCbs.delete(fn); }
  const currentUser = () => (fauth ? fauth.currentUser : null);

  /* ================= đăng nhập ================= */

  function providerFor(kind) {
    const F = window.firebase.auth;
    if ((kind || cfg.provider) === "microsoft") {
      const p = new F.OAuthProvider("microsoft.com");
      // Chỉ nhận tài khoản của Trường, không nhận tài khoản cá nhân.
      if (cfg.tenantId) p.setCustomParameters({ tenant: cfg.tenantId });
      return p;
    }
    const p = new F.GoogleAuthProvider();
    // Gợi ý trình duyệt chỉ hiện tài khoản thuộc tên miền Trường. Đây chỉ là
    // gợi ý giao diện — chặn thật nằm ở quy tắc trên máy chủ.
    if (cfg.hostedDomain) p.setCustomParameters({ hd: cfg.hostedDomain });
    return p;
  }

  async function signIn(kind) {
    if (!fauth) throw new Error("Chưa khởi động Firebase.");
    const res = await fauth.signInWithPopup(providerFor(kind));
    return res.user;
  }

  async function signOut() {
    disconnect();
    scope = null;
    if (fauth) await fauth.signOut();
  }

  /* ================= xác định phạm vi ================= */

  /**
   * Người này là ai, và được thấy những gì.
   * Trả về { kind: "advisor" | "student" | "unknown", ... }
   */
  async function resolveScope(user) {
    if (!user) return { kind: "unknown" };
    const email = (user.email || "").toLowerCase();

    // Giảng viên?
    const adv = await fdb.collection("advisors").doc(user.uid).get();
    if (adv.exists) {
      const d = adv.data() || {};
      return {
        kind: d.role === "pending" ? "pending" : "advisor",
        uid: user.uid, email,
        role: d.role || "pending",
        khoaId: d.khoaId || "",
        classIds: Array.isArray(d.classIds) ? d.classIds : [],
        name: d.name || user.displayName || ""
      };
    }

    // Sinh viên đã nối tài khoản?
    const link = await fdb.collection(LINKS_COL).doc(user.uid).get();
    if (link.exists) {
      const d = link.data() || {};
      return {
        kind: "student", uid: user.uid, email,
        studentId: d.studentId || "", classId: d.classId || "", mssv: d.mssv || ""
      };
    }

    return { kind: "unknown", uid: user.uid, email };
  }

  /**
   * Sinh viên lần đầu đăng nhập: tìm dòng danh sách lớp mang đúng địa chỉ
   * thư của mình rồi nối tài khoản vào đó. Không có dòng nào thì nghĩa là
   * cố vấn chưa tải danh sách lớp lên, hoặc tải lên thiếu địa chỉ thư.
   */
  async function linkStudent(user) {
    const email = (user.email || "").toLowerCase();
    const snap = await fdb.collection("students")
      .where("authEmail", "==", email).limit(2).get();

    if (snap.empty) {
      return { ok: false, reason: "no-record",
        error: "Không tìm thấy hồ sơ nào mang địa chỉ thư " + email +
               ". Nhờ cố vấn học tập kiểm tra lại danh sách lớp." };
    }
    if (snap.size > 1) {
      return { ok: false, reason: "duplicate",
        error: "Có nhiều hồ sơ cùng mang địa chỉ thư này. Nhờ cố vấn học tập xem lại." };
    }

    const doc = snap.docs[0];
    const d = doc.data() || {};
    await fdb.collection(LINKS_COL).doc(user.uid).set({
      studentId: doc.id,
      classId: d.classId || "",
      mssv: d.mssv || "",
      email: email,
      at: window.firebase.firestore.FieldValue.serverTimestamp()
    });
    return { ok: true, studentId: doc.id, classId: d.classId || "", mssv: d.mssv || "" };
  }

  /** Giảng viên lần đầu đăng nhập: tự đăng ký, vào hàng chờ duyệt. */
  async function registerAdvisor(user, info) {
    const email = (user.email || "").toLowerCase();
    await fdb.collection("advisors").doc(user.uid).set({
      id: user.uid,
      name: (info && info.name) || user.displayName || "",
      title: (info && info.title) || "",
      email: email,
      khoaId: (info && info.khoaId) || "",
      role: "pending",
      classIds: [],
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return { ok: true };
  }

  /* ================= nghe thay đổi ================= */

  function chunk(arr, n) {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  }

  /**
   * Gắn một listener, đổ kết quả vào store theo kiểu "thay toàn bộ".
   * Khoá part truyền riêng chứ không gắn vào bucket: nhiều listener dùng
   * chung một bucket, gắn vào đó thì mảnh sau đè lên mảnh trước.
   */
  function listen(col, query, bucket, partKey) {
    const key = partKey || "all";
    const un = query.onSnapshot(
      (snap) => {
        const rows = [];
        snap.forEach((d) => rows.push(Object.assign({}, d.data(), { id: d.id })));
        bucket.parts[key] = rows;
        flush(col, bucket);
        state.online = !snap.metadata.fromCache;
        state.lastAt = new Date().toISOString();
        notifyReady(col);
      },
      (err) => {
        console.error("Lỗi nghe " + col + ":", err);
        state.lastError = dienGiaiLoi(col, err);
        try { CV.store.applyRemote(col, [], []); } catch (e) { /* để báo ra ngoài */ }
      }
    );
    unsubs.push(un);
  }

  /** Nhiều truy vấn cho cùng một bộ sưu tập (do giới hạn 30) thì ghép lại. */
  function flush(col, bucket) {
    const merged = [];
    Object.keys(bucket.parts).forEach((k) => {
      (bucket.parts[k] || []).forEach((r) => merged.push(r));
    });
    CV.store.applyRemote(col, merged, [], { replace: true });
  }

  const ready = new Set();
  function notifyReady(col) {
    if (ready.has(col)) return;
    ready.add(col);
    state.loaded = ready.size;
  }

  function dienGiaiLoi(col, err) {
    const code = (err && err.code) || "";
    if (code === "permission-denied") {
      return "Máy chủ từ chối đọc mục " + col + ". Tài khoản này chưa được phân quyền.";
    }
    if (code === "unavailable") return "Mất kết nối. Đang dùng dữ liệu lưu trên máy.";
    if (code === "failed-precondition") {
      return "Thiếu chỉ mục cho mục " + col + ". Xem thông báo trong Console của trình duyệt.";
    }
    return "Lỗi đọc " + col + ": " + (err && err.message ? err.message : code);
  }

  /** Gắn toàn bộ listener theo phạm vi của người đang đăng nhập. */
  function connect(sc) {
    disconnect();
    scope = sc;
    ready.clear();
    state.loaded = 0;
    state.lastError = "";

    const S = CV.store;
    const shared = S.SHARED;
    const classScoped = S.CLASS_SCOPED;

    if (sc.kind === "advisor") {
      const ids = sc.classIds || [];
      state.expected = shared.length + classScoped.length + 2;

      // Dùng chung toàn trường
      shared.forEach((col) => {
        listen(col, fdb.collection(col), { parts: {} }, "all");
      });

      // Đồng nghiệp trong Khoa — để hiện tên người phụ trách lớp khác
      if (sc.khoaId) {
        listen("advisors",
          fdb.collection("advisors").where("khoaId", "==", sc.khoaId),
          { parts: {} }, "khoa");
      } else {
        listen("advisors",
          fdb.collection("advisors")
             .where(window.firebase.firestore.FieldPath.documentId(), "==", sc.uid),
          { parts: {} }, "self");
      }

      // Phiếu tự đánh giá của chính mình
      listen("evaluations",
        fdb.collection("evaluations").where("advisorId", "==", sc.uid),
        { parts: {} }, "self");

      if (!ids.length) {
        // Chưa được giao lớp nào: không hỏi gì thêm, tránh bị máy chủ từ chối.
        classScoped.forEach((col) => CV.store.applyRemote(col, [], [], { replace: true }));
        CV.store.applyRemote("classes", [], [], { replace: true });
        return;
      }

      const groups = chunk(ids, IN_LIMIT);

      // Lớp phụ trách
      const classBucket = { parts: {} };
      groups.forEach((g, i) => {
        listen("classes",
          fdb.collection("classes")
             .where(window.firebase.firestore.FieldPath.documentId(), "in", g),
          classBucket, "g" + i);
      });

      // Mọi bộ sưu tập thuộc lớp
      classScoped.forEach((col) => {
        const b = { parts: {} };
        groups.forEach((g, i) => {
          listen(col, fdb.collection(col).where("classId", "in", g), b, "g" + i);
        });
      });
      return;
    }

    if (sc.kind === "student") {
      // Sinh viên: chỉ hồ sơ của mình, lớp của mình, và dữ liệu dùng chung.
      // Bộ sưu tập "notes" KHÔNG nghe — đó là ghi chú riêng của cố vấn.
      const sid = sc.studentId;
      const visible = classScoped.filter((c) =>
        S.ADVISOR_ONLY.indexOf(c) === -1 && c !== "students" && c !== "meetings");
      state.expected = shared.length + visible.length + 2;

      shared.forEach((col) => listen(col, fdb.collection(col), { parts: {} }, "all"));

      listen("students",
        fdb.collection("students")
           .where(window.firebase.firestore.FieldPath.documentId(), "==", sid),
        { parts: {} }, "self");

      if (sc.classId) {
        listen("classes",
          fdb.collection("classes")
             .where(window.firebase.firestore.FieldPath.documentId(), "==", sc.classId),
          { parts: {} }, "self");
        listen("meetings",
          fdb.collection("meetings").where("classId", "==", sc.classId),
          { parts: {} }, "self");
      }

      visible.forEach((col) => {
        listen(col, fdb.collection(col).where("studentId", "==", sid), { parts: {} }, "self");
      });

      // Dọn sạch những bộ sưu tập sinh viên không được thấy, phòng trường hợp
      // trong bộ nhớ đệm còn sót dữ liệu của lần đăng nhập trước.
      S.ADVISOR_ONLY.forEach((col) => CV.store.applyRemote(col, [], [], { replace: true }));
      CV.store.applyRemote("advisors", [], [], { replace: true });
      return;
    }

    // pending hoặc unknown: không nghe gì cả.
    state.expected = 0;
  }

  function disconnect() {
    unsubs.forEach((un) => { try { un(); } catch (e) { /* bỏ qua */ } });
    unsubs = [];
    ready.clear();
    state.loaded = 0;
  }

  /* ================= đẩy lên ================= */

  function clean(obj) {
    // Firestore không nhận undefined. Bỏ hẳn những khoá như vậy.
    const out = {};
    Object.keys(obj || {}).forEach((k) => {
      if (obj[k] !== undefined) out[k] = obj[k];
    });
    return out;
  }

  async function push(col, obj) {
    if (!fdb || !obj || !obj.id) return;
    if (scope && scope.kind === "student" && CV.store.ADVISOR_ONLY.indexOf(col) !== -1) {
      return; // không bao giờ để phía sinh viên ghi vào ghi chú riêng
    }
    state.pending += 1;
    try {
      await fdb.collection(col).doc(String(obj.id)).set(clean(obj), { merge: true });
      state.lastAt = new Date().toISOString();
      state.lastError = "";
    } catch (e) {
      state.lastError = e && e.code === "permission-denied"
        ? "Máy chủ từ chối ghi mục " + col + ". Tài khoản này không có quyền."
        : "Không ghi được " + col + ": " + (e && e.message);
      throw e;
    } finally {
      state.pending = Math.max(0, state.pending - 1);
    }
  }

  async function del(col, id) {
    if (!fdb || !id) return;
    await fdb.collection(col).doc(String(id)).delete();
    state.lastAt = new Date().toISOString();
  }

  async function pushSettings(s) {
    if (!fdb || !scope || !scope.uid) return;
    await fdb.collection(SETTINGS_COL).doc(scope.uid).set(clean(s), { merge: true });
  }

  function listenSettings() {
    if (!fdb || !scope || !scope.uid) return;
    const un = fdb.collection(SETTINGS_COL).doc(scope.uid).onSnapshot((d) => {
      if (d.exists) CV.store.applyRemoteSettings(d.data());
    }, (e) => console.warn("Không đọc được thiết lập:", e));
    unsubs.push(un);
  }

  function status() {
    return {
      online: state.online,
      pending: state.pending,
      lastAt: state.lastAt,
      lastError: state.lastError,
      loaded: state.loaded,
      expected: state.expected,
      scope: scope ? scope.kind : "",
      text: !scope ? "Chưa đăng nhập"
        : state.lastError ? state.lastError
        : state.online ? "Đã đồng bộ"
        : "Đang dùng dữ liệu lưu trên máy"
    };
  }

  /* ================= bộ mặt cắm vào store ================= */

  const backend = {
    name: "firestore",
    push, del, pushSettings, status,
    connect: (sc) => { connect(sc); listenSettings(); },
    disconnect
  };

  return {
    available, init, signIn, signOut, onAuth, currentUser,
    resolveScope, linkStudent, registerAdvisor,
    connect: backend.connect, disconnect, status, backend,
    get scope() { return scope; },
    get db() { return fdb; }
  };
})();
