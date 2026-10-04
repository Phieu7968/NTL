// Firebase giả, đủ bề mặt để chạy thử luồng đăng nhập và nghe dữ liệu.
window.__FB = { docs: {}, written: [], deleted: [], user: null, authCbs: [] };
(function () {
  const DB = window.__FB.docs;   // DB["col/id"] = {...}
  const listeners = [];

  function rows(col) {
    return Object.keys(DB).filter(k => k.startsWith(col + '/'))
      .map(k => ({ id: k.slice(col.length + 1), data: () => DB[k] }));
  }
  function fire() {
    listeners.forEach(l => {
      let r = rows(l.col);
      l.filters.forEach(f => {
        r = r.filter(d => {
          const v = f.field === '__name__' ? d.id : d.data()[f.field];
          if (f.op === '==') return v === f.val;
          if (f.op === 'in') return (f.val || []).includes(v);
          return true;
        });
      });
      const snap = { forEach: fn => r.forEach(fn), empty: !r.length, size: r.length,
                     docs: r, metadata: { fromCache: false, hasPendingWrites: false } };
      try { l.cb(snap); } catch (e) { console.error('fake snapshot', e); }
    });
  }
  window.__FB.fire = fire;

  function Query(col, filters) {
    return {
      where: (field, op, val) => Query(col, filters.concat([{ field, op, val }])),
      limit: () => Query(col, filters),
      get: () => {
        let r = rows(col);
        filters.forEach(f => { r = r.filter(d => {
          const v = f.field === '__name__' ? d.id : d.data()[f.field];
          return f.op === '==' ? v === f.val : (f.val || []).includes(v);
        }); });
        return Promise.resolve({ forEach: fn => r.forEach(fn), empty: !r.length, size: r.length, docs: r });
      },
      onSnapshot: (cb) => { const l = { col, filters, cb }; listeners.push(l);
        setTimeout(() => fire(), 0);
        return () => { const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); }; }
    };
  }

  function docRef(col, id) {
    return {
      get: () => Promise.resolve({ exists: !!DB[col + '/' + id], data: () => DB[col + '/' + id] }),
      set: (v, o) => { window.__FB.written.push([col, id]);
        DB[col + '/' + id] = o && o.merge ? Object.assign({}, DB[col + '/' + id], v) : v;
        setTimeout(fire, 0); return Promise.resolve(); },
      delete: () => { window.__FB.deleted.push([col, id]); delete DB[col + '/' + id];
        setTimeout(fire, 0); return Promise.resolve(); },
      onSnapshot: (cb) => { cb({ exists: !!DB[col + '/' + id], data: () => DB[col + '/' + id] }); return () => {}; }
    };
  }

  function collection(col) {
    const q = Query(col, []);
    return Object.assign({}, q, { doc: (id) => docRef(col, id) });
  }

  const fs = () => ({ collection, enablePersistence: () => Promise.resolve() });
  fs.FieldPath = { documentId: () => '__name__' };
  fs.FieldValue = { serverTimestamp: () => new Date().toISOString() };

  const auth = () => ({
    get currentUser() { return window.__FB.user; },
    onAuthStateChanged: (cb) => { window.__FB.authCbs.push(cb); cb(window.__FB.user); return () => {}; },
    signInWithPopup: () => {
      window.__FB.user = window.__FB.nextUser;
      window.__FB.authCbs.forEach(cb => cb(window.__FB.user));
      return Promise.resolve({ user: window.__FB.user });
    },
    signOut: () => { window.__FB.user = null;
      window.__FB.authCbs.forEach(cb => cb(null)); return Promise.resolve(); }
  });
  auth.GoogleAuthProvider = function () { this.setCustomParameters = () => {}; };
  auth.OAuthProvider = function () { this.setCustomParameters = () => {}; };

  window.firebase = { initializeApp: () => ({}), firestore: fs, auth: auth };
  window.firebase.firestore.FieldPath = fs.FieldPath;
  window.firebase.firestore.FieldValue = fs.FieldValue;
})();
