/* =====================================================================
   view-advisor.js — các màn hình của giảng viên cố vấn
   Phạm vi dữ liệu: mỗi cố vấn chỉ thấy lớp do mình phụ trách.
   Tài khoản vai trò "owner" (người cài đặt đầu tiên) thấy toàn bộ.
   ===================================================================== */
window.CV = window.CV || {};

CV.viewAdvisor = (function () {
  "use strict";
  const U = CV.util, el = U.el, ui = CV.ui, A = CV.academic, S = CV.store;

  /* ---------- phạm vi dữ liệu ---------- */
  const me = () => { const c = CV.auth.current(); return c && c.kind === "advisor" ? c.user : null; };
  const isOwner = () => { const m = me(); return !!m && m.role === "owner"; };

  function myClasses() {
    const m = me();
    if (!m) return [];
    const all = S.all("classes");
    return isOwner() ? all : all.filter((c) => c.advisorId === m.id);
  }
  function myStudents() {
    const ids = new Set(myClasses().map((c) => c.id));
    return S.all("students").filter((s) => ids.has(s.classId));
  }
  const classOf = (id) => S.get("classes", id);
  const semesters = () => U.sortBy(S.all("semesters"), (s) => s.code);

  function needClass() {
    return ui.empty("Chưa có lớp cố vấn nào",
      "Hãy tạo lớp trước, sau đó thêm hoặc nhập danh sách sinh viên.",
      el("button", { class: "btn btn-primary", text: "Tạo lớp đầu tiên",
        onclick: () => editClass(null, () => CV.app.render()) }));
  }

  /* =====================================================================
     1. BÀN LÀM VIỆC
     ===================================================================== */
  function dashboard(host) {
    const classes = myClasses();
    const students = myStudents();
    const sum = A.summarize(students);

    // hàng thẻ số liệu
    const deck = el("div", { class: "deck" }, [
      ui.stat({ label: "Sinh viên", value: String(sum.total), icon: "users",
        note: `${classes.length} lớp cố vấn`, onClick: () => CV.app.go("advisor/students") }),
      ui.stat({ label: "GPA trung bình", value: sum.gpaAvg === null ? "—" : U.num(sum.gpaAvg),
        icon: "score", note: `${sum.graded}/${sum.total} em đã có điểm` }),
      ui.stat({ label: "Đang cảnh báo", value: String(sum.counts.warn + sum.counts.critical),
        icon: "report", tone: sum.counts.critical ? "critical" : sum.counts.warn ? "warn" : "ok",
        note: `${sum.counts.watch} em cần theo dõi thêm`,
        onClick: () => CV.app.go("advisor/students?loc=warn") }),
      ui.stat({ label: "Tín chỉ nợ", value: String(sum.debtTotal), icon: "note",
        tone: sum.debtTotal ? "warn" : "ok", note: "Tổng toàn bộ sinh viên" })
    ]);
    host.appendChild(deck);

    if (!classes.length) { host.appendChild(ui.card(null, needClass())); return; }

    // biểu đồ
    const chartRow = el("div", { class: "grid-2" });
    const c1 = el("div");
    const c2 = el("div");
    chartRow.appendChild(ui.card("Phân bố học lực", [c1],
      { sub: "Theo GPA tích luỹ hệ 4" }));
    chartRow.appendChild(ui.card("Cơ cấu cảnh báo học vụ", [c2],
      { sub: A.warningRuleText()[1] }));
    host.appendChild(chartRow);

    CV.charts.bars(c1, {
      labels: ["Dưới 2,0", "2,0–2,5", "2,5–3,2", "3,2–3,6", "Từ 3,6"],
      values: sum.gpaBins,
      ariaLabel: "Phân bố sinh viên theo mức GPA",
      unitCol: "Số sinh viên"
    });
    CV.charts.stack(c2, [
      { label: "Bình thường", value: sum.counts.ok, color: CV.charts.STATUS.ok.color },
      { label: "Cần theo dõi", value: sum.counts.watch, color: CV.charts.STATUS.watch.color },
      { label: "Cảnh báo", value: sum.counts.warn, color: CV.charts.STATUS.warn.color },
      { label: "Nguy cơ thôi học", value: sum.counts.critical, color: CV.charts.STATUS.critical.color },
      { label: "Chưa có điểm", value: sum.counts.none, color: CV.charts.STATUS.none.color }
    ]);

    // danh sách cần chú ý
    const flagged = sum.rows
      .filter((r) => r.warning.level === "warn" || r.warning.level === "critical")
      .sort((a, b) => A.LEVELS[b.warning.level].rank - A.LEVELS[a.warning.level].rank ||
                      (a.stats.gpa4 || 0) - (b.stats.gpa4 || 0));

    host.appendChild(ui.card("Sinh viên cần gặp sớm", [
      flagged.length
        ? ui.table([
            { key: "mssv", label: "Sinh viên", render: (r) => el("div", { class: "t-name" }, [
                el("strong", { text: r.student.name }),
                el("small", { text: `${r.student.mssv} · ${(classOf(r.student.classId) || {}).code || "—"}` })
              ]) },
            { key: "gpa", label: "GPA", num: true, render: (r) => U.num(r.stats.gpa4) },
            { key: "debt", label: "Nợ (TC)", num: true, render: (r) => String(r.stats.debtCredits) },
            { key: "lv", label: "Mức", render: (r) => ui.badge(r.warning.level, r.warning.label) },
            { key: "why", label: "Lý do", render: (r) => r.warning.reasons.join("; ") }
          ], flagged, { onRow: (r) => CV.app.go("advisor/student?id=" + r.student.id) })
        : ui.empty("Không có em nào ở mức cảnh báo", "Số liệu tính theo quy tắc trong mục Cài đặt.")
    ], { sub: `Sắp theo mức độ ưu tiên · ${flagged.length} em` }));

    // lịch hẹn sắp tới
    const today = U.todayISO();
    const mine = new Set(students.map((s) => s.id));
    const soon = S.all("appointments")
      .filter((a) => mine.has(a.studentId) && a.date >= today && a.status !== "Đã huỷ")
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .slice(0, 6);
    host.appendChild(ui.card("Lịch tư vấn sắp tới", [
      soon.length
        ? el("ul", { class: "timeline" }, soon.map((ap) => {
            const st = S.get("students", ap.studentId);
            return el("li", {}, [
              el("span", { class: "dot" }),
              el("div", { class: "tl-body" }, [
                el("strong", { text: `${U.dmy(ap.date)} ${ap.time || ""} — ${st ? st.name : "?"}` }),
                el("div", { text: ap.topic || "(chưa ghi nội dung)" }),
                el("small", { text: `${ap.place || "Chưa chọn nơi gặp"} · ${ap.status || "Chờ duyệt"}` })
              ])
            ]);
          }))
        : ui.empty("Chưa có lịch hẹn nào sắp tới", "Sinh viên đặt lịch từ Cổng Sinh viên, hoặc bạn tự thêm.")
    ], { actions: [el("button", { class: "btn btn-ghost btn-sm", text: "Xem tất cả",
        onclick: () => CV.app.go("advisor/appointments") })] }));
  }

  /* =====================================================================
     2. LỚP CỐ VẤN
     ===================================================================== */
  function editClass(klass, done) {
    const advisors = S.all("advisors");
    ui.formModal({
      title: klass ? "Sửa lớp cố vấn" : "Thêm lớp cố vấn",
      values: klass || {},
      fields: [
        { name: "code", label: "Mã lớp", required: true, placeholder: "26XD01" },
        { name: "name", label: "Tên lớp", required: true, placeholder: "Xây dựng dân dụng K26" },
        { name: "course", label: "Khoá", placeholder: "K26" },
        { name: "major", label: "Ngành", placeholder: "Kỹ thuật xây dựng" },
        { name: "startYear", label: "Năm nhập học", type: "number", min: 2000, max: 2100 },
        isOwner()
          ? { name: "advisorId", label: "Cố vấn phụ trách", type: "select",
              value: (klass && klass.advisorId) || (me() || {}).id,
              options: advisors.map((a) => ({ value: a.id, label: a.name })) }
          : { name: "sep", type: "separator", label: "" },
        { name: "note", label: "Ghi chú", type: "textarea", full: true }
      ],
      check: (d) => {
        const dup = S.all("classes").find((c) =>
          U.fold(c.code) === U.fold(d.code) && (!klass || c.id !== klass.id));
        return dup ? `Mã lớp "${d.code}" đã tồn tại.` : null;
      }
    }).then((d) => {
      if (!d) return;
      const payload = Object.assign({}, d, { advisorId: d.advisorId || (klass && klass.advisorId) || (me() || {}).id });
      delete payload.sep;
      if (klass) payload.id = klass.id;
      S.put("classes", payload);
      ui.toast(klass ? "Đã lưu lớp." : "Đã thêm lớp.", "ok");
      done && done();
    });
  }

  function classes(host) {
    const rows = myClasses().map((c) => {
      const sts = S.all("students").filter((s) => s.classId === c.id);
      const sum = A.summarize(sts);
      return { klass: c, count: sts.length, sum };
    });

    host.appendChild(ui.card("Danh sách lớp cố vấn", [
      ui.table([
        { key: "code", label: "Mã lớp", render: (r) => el("div", { class: "t-name" }, [
            el("strong", { text: r.klass.code }), el("small", { text: r.klass.name }) ]) },
        { key: "major", label: "Ngành", render: (r) => r.klass.major || "—" },
        { key: "n", label: "Sĩ số", num: true, render: (r) => String(r.count) },
        { key: "gpa", label: "GPA TB", num: true, render: (r) => U.num(r.sum.gpaAvg) },
        { key: "warn", label: "Cảnh báo", num: true,
          render: (r) => String(r.sum.counts.warn + r.sum.counts.critical) },
        { key: "act", label: "", render: (r) => el("div", { class: "row" }, [
            el("button", { class: "btn btn-ghost btn-sm", text: "Sửa",
              onclick: () => editClass(r.klass, () => CV.app.render()) }),
            el("button", { class: "btn btn-ghost btn-sm", text: "Xoá", onclick: async () => {
              const okd = await ui.confirm({ title: "Xoá lớp", danger: true,
                message: `Xoá lớp ${r.klass.code}?`,
                detail: "Chỉ xoá được khi lớp không còn sinh viên." });
              if (!okd) return;
              const res = S.removeClass(r.klass.id);
              if (!res.ok) { ui.toast(res.reason, "err"); return; }
              ui.toast("Đã xoá lớp.", "ok");
              CV.app.render();
            } })
          ]) }
      ], rows, {
        onRow: (r) => CV.app.go("advisor/students?class=" + r.klass.id),
        emptyTitle: "Chưa có lớp nào",
        emptyText: "Tạo lớp cố vấn để bắt đầu quản lý sinh viên.",
        emptyAction: el("button", { class: "btn btn-primary", text: "Tạo lớp",
          onclick: () => editClass(null, () => CV.app.render()) })
      })
    ], { actions: [el("button", { class: "btn btn-primary btn-sm", text: "+ Thêm lớp",
        onclick: () => editClass(null, () => CV.app.render()) })] }));
  }

  /* =====================================================================
     3. DANH SÁCH SINH VIÊN
     ===================================================================== */
  const filterState = { q: "", classId: "", loc: "all" };

  function editStudent(student, done) {
    const ks = myClasses();
    if (!ks.length) { ui.toast("Hãy tạo lớp cố vấn trước.", "err"); return; }
    ui.formModal({
      title: student ? "Sửa hồ sơ sinh viên" : "Thêm sinh viên",
      size: "lg",
      values: student || {},
      fields: [
        { name: "mssv", label: "Mã số sinh viên", required: true,
          validate: (v) => A.validate.mssv(v) },
        { name: "name", label: "Họ và tên", required: true, validate: (v) => A.validate.name(v) },
        { name: "classId", label: "Lớp", type: "select", required: true,
          value: (student && student.classId) || filterState.classId || ks[0].id,
          options: ks.map((k) => ({ value: k.id, label: `${k.code} — ${k.name}` })) },
        { name: "gender", label: "Giới tính", type: "select",
          options: [{ value: "", label: "—" }, { value: "Nam", label: "Nam" }, { value: "Nữ", label: "Nữ" }] },
        { name: "dob", label: "Ngày sinh", type: "date", validate: (v) => A.validate.dob(v) },
        { name: "phone", label: "Điện thoại", type: "tel", validate: (v) => A.validate.phone(v) },
        { name: "email", label: "Email", type: "email", validate: (v) => A.validate.email(v) },
        { name: "cadreRole", label: "Chức vụ trong lớp", placeholder: "Lớp trưởng, Bí thư…" },
        { name: "status", label: "Trạng thái", type: "select", value: (student && student.status) || "Đang học",
          options: ["Đang học", "Bảo lưu", "Đình chỉ", "Thôi học", "Đã tốt nghiệp"]
            .map((x) => ({ value: x, label: x })) },
        { name: "address", label: "Địa chỉ", full: true },
        { name: "note", label: "Ghi chú", type: "textarea", full: true }
      ],
      check: (d) => {
        const dup = S.all("students").find((s) =>
          String(s.mssv).toUpperCase() === d.mssv.toUpperCase() && (!student || s.id !== student.id));
        return dup ? `MSSV ${d.mssv} đã có trong hệ thống.` : null;
      }
    }).then((d) => {
      if (!d) return;
      d.mssv = d.mssv.toUpperCase();
      if (student) d.id = student.id;
      const saved = S.put("students", d);
      ui.toast(student ? "Đã lưu hồ sơ." : "Đã thêm sinh viên.", "ok");
      done ? done(saved) : CV.app.render();
    });
  }

  /** Cấp hoặc cấp lại mã PIN cho sinh viên. Mã chỉ hiện một lần. */
  async function issuePin(student) {
    const okd = await ui.confirm({
      title: student.secret ? "Cấp lại mã PIN" : "Cấp mã PIN",
      message: `${student.secret ? "Cấp lại" : "Cấp"} mã PIN đăng nhập cho ${student.name}?`,
      detail: "Mã PIN chỉ hiện một lần ngay sau đây. Sinh viên sẽ phải đổi mã ở lần đăng nhập đầu tiên.",
      okText: "Cấp mã"
    });
    if (!okd) return;
    const pin = U.randomPin();
    S.put("students", { id: student.id, secret: U.makeSecret(pin), mustChangeSecret: true });
    ui.modal({
      title: "Mã PIN của " + student.name,
      body: [
        el("p", { text: "Đọc hoặc gửi riêng mã này cho sinh viên. Đóng hộp thoại là không xem lại được nữa." }),
        el("div", { style: "font-size:2.4rem;font-weight:800;letter-spacing:.5rem;text-align:center;" +
          "background:var(--card-2);border:1px dashed var(--line-2);border-radius:14px;padding:1rem;margin:.5rem 0;" +
          "font-variant-numeric:tabular-nums", text: pin }),
        ui.note(`MSSV đăng nhập: <strong>${U.esc(student.mssv)}</strong>`, "info")
      ],
      actions: [
        { label: "Sao chép mã", class: "btn-ghost", onClick: () => {
            if (navigator.clipboard) navigator.clipboard.writeText(pin)
              .then(() => ui.toast("Đã sao chép mã PIN.", "ok"))
              .catch(() => ui.toast("Trình duyệt không cho sao chép tự động.", "err"));
          } },
        { label: "Xong", class: "btn-primary", onClick: (c) => { c(); CV.app.render(); } }
      ]
    });
  }

  function students(host, params) {
    if (params.class) filterState.classId = params.class;
    if (params.loc) filterState.loc = params.loc;
    const ks = myClasses();
    if (!ks.length) { host.appendChild(ui.card(null, needClass())); return; }

    const bar = el("div", { class: "row", style: "margin-bottom:1rem" });
    const search = el("input", { type: "search", placeholder: "Tìm theo tên, MSSV…",
      value: filterState.q, style: "max-width:260px" });
    search.addEventListener("input", U.debounce(() => { filterState.q = search.value; draw(); }, 200));

    const classSel = el("select", { style: "max-width:220px" }, [el("option", { value: "", text: "Tất cả lớp" })]
      .concat(ks.map((k) => el("option", { value: k.id, text: k.code, selected: filterState.classId === k.id }))));
    classSel.addEventListener("change", () => { filterState.classId = classSel.value; draw(); });

    bar.appendChild(search);
    bar.appendChild(classSel);
    bar.appendChild(ui.segmented([
      { value: "all", label: "Tất cả" }, { value: "warn", label: "Cảnh báo" },
      { value: "debt", label: "Còn nợ" }, { value: "none", label: "Chưa có điểm" },
      { value: "cadre", label: "Cán bộ lớp" }
    ], filterState.loc, (v) => { filterState.loc = v; draw(); }));

    const actions = el("div", { class: "row row-end" }, [
      el("button", { class: "btn btn-ghost btn-sm", text: "Nhập CSV", onclick: doImport }),
      el("button", { class: "btn btn-ghost btn-sm", text: "Xuất CSV",
        onclick: () => CV.io.exportSummary(visible()) }),
      el("button", { class: "btn btn-primary btn-sm", text: "+ Thêm sinh viên",
        onclick: () => editStudent(null) })
    ]);
    bar.appendChild(actions);
    host.appendChild(bar);

    const listHost = el("div");
    host.appendChild(listHost);

    function visible() {
      const q = U.fold(filterState.q);
      return myStudents().filter((s) => {
        if (filterState.classId && s.classId !== filterState.classId) return false;
        if (q && !(U.fold(s.name).includes(q) || U.fold(s.mssv).includes(q) ||
                   U.fold(s.phone || "").includes(q) || U.fold(s.email || "").includes(q))) return false;
        if (filterState.loc === "cadre") return !!s.cadreRole;
        if (filterState.loc !== "all") {
          const st = A.statsOf(s.id);
          const w = A.warningOf(st);
          if (filterState.loc === "warn") return w.level === "warn" || w.level === "critical";
          if (filterState.loc === "debt") return st.debtCredits > 0;
          if (filterState.loc === "none") return w.level === "none";
        }
        return true;
      });
    }

    async function doImport() {
      const f = await ui.pickFile(".csv,.txt");
      if (!f) return;
      const res = CV.io.importStudents(f.text, filterState.classId || ks[0].id);
      if (!res.ok) { ui.toast(res.error, "err"); return; }
      ui.importReport("Kết quả nhập danh sách sinh viên", res);
      draw();
    }

    function draw() {
      listHost.innerHTML = "";
      const rows = U.sortBy(visible(), (s) => s.mssv).map((s) => {
        const stats = A.statsOf(s.id);
        return { s, stats, w: A.warningOf(stats), lv: A.classifyLearning(stats.gpa4) };
      });
      listHost.appendChild(ui.card(`Sinh viên (${rows.length})`, [
        ui.table([
          { key: "mssv", label: "Sinh viên", render: (r) => el("div", { class: "t-name" }, [
              el("strong", { text: r.s.name }),
              el("small", { text: `${r.s.mssv}${r.s.cadreRole ? " · " + r.s.cadreRole : ""}` })
            ]) },
          { key: "class", label: "Lớp", render: (r) => (classOf(r.s.classId) || {}).code || "—" },
          { key: "gpa", label: "GPA", num: true, render: (r) => U.num(r.stats.gpa4) },
          { key: "cr", label: "TC tích luỹ", num: true, render: (r) => String(r.stats.earnedCredits) },
          { key: "debt", label: "TC nợ", num: true, render: (r) => String(r.stats.debtCredits) },
          { key: "lv", label: "Học lực", render: (r) => r.lv.label },
          { key: "w", label: "Cảnh báo", render: (r) => ui.badge(r.w.level, r.w.label) },
          { key: "pin", label: "Đăng nhập", render: (r) => r.s.secret
              ? el("span", { class: "badge badge-ok", text: "Đã cấp PIN" })
              : el("button", { class: "btn btn-ghost btn-sm", text: "Cấp PIN",
                  onclick: () => issuePin(r.s) }) }
        ], rows, {
          onRow: (r) => CV.app.go("advisor/student?id=" + r.s.id),
          emptyTitle: "Không có sinh viên nào khớp bộ lọc",
          emptyText: "Thử đổi bộ lọc, hoặc nhập danh sách từ tệp CSV."
        })
      ], { sub: "Bấm vào một dòng để mở hồ sơ chi tiết." }));
    }
    draw();
  }

  /* =====================================================================
     4. HỒ SƠ MỘT SINH VIÊN
     ===================================================================== */
  function studentDetail(host, params) {
    const p = A.profileOf(params.id);
    if (!p) { host.appendChild(ui.empty("Không tìm thấy sinh viên", "Có thể hồ sơ đã bị xoá.")); return; }
    const st = p.student;

    host.appendChild(el("div", { class: "row", style: "margin-bottom:1rem" }, [
      el("button", { class: "btn btn-ghost btn-sm", text: "← Danh sách",
        onclick: () => CV.app.go("advisor/students") }),
      el("div", { class: "row row-end" }, [
        el("button", { class: "btn btn-ghost btn-sm", text: st.secret ? "Cấp lại PIN" : "Cấp PIN",
          onclick: () => issuePin(st) }),
        el("button", { class: "btn btn-ghost btn-sm", text: "Sửa hồ sơ",
          onclick: () => editStudent(st, () => CV.app.render()) }),
        el("button", { class: "btn btn-ghost btn-sm", text: "In hồ sơ", onclick: () => printOne(p) }),
        el("button", { class: "btn btn-danger btn-sm", text: "Xoá", onclick: async () => {
          const okd = await ui.confirm({ title: "Xoá sinh viên", danger: true,
            message: `Xoá ${st.name} (${st.mssv})?`,
            detail: "Toàn bộ điểm, điểm rèn luyện, lịch hẹn và nhật ký của em này cũng bị xoá theo." });
          if (!okd) return;
          S.removeStudentCascade(st.id);
          ui.toast("Đã xoá.", "ok");
          CV.app.go("advisor/students");
        } })
      ])
    ]));

    // thẻ tổng quan
    host.appendChild(el("div", { class: "deck" }, [
      ui.stat({ label: "GPA tích luỹ", value: U.num(p.stats.gpa4), icon: "score",
        note: `Hệ 10: ${U.num(p.stats.gpa10)} · ${p.learning.label}` }),
      ui.stat({ label: "Tín chỉ tích luỹ", value: String(p.stats.earnedCredits), icon: "class",
        note: `${p.stats.subjects} học phần đã có điểm` }),
      ui.stat({ label: "Tín chỉ nợ", value: String(p.stats.debtCredits), icon: "note",
        tone: p.stats.debtCredits ? "warn" : "ok",
        note: p.stats.debtSubjects.length ? `${p.stats.debtSubjects.length} học phần chưa đạt` : "Không nợ học phần nào" }),
      ui.stat({ label: "Điểm rèn luyện", value: U.num(p.stats.conductAvg, 1), icon: "users",
        note: p.conduct.label })
    ]));

    // thông tin cá nhân + mức cảnh báo
    const info = el("dl", { class: "kv" });
    [["Lớp", p.klass ? `${p.klass.code} — ${p.klass.name}` : "—"],
     ["Ngày sinh", U.dmy(st.dob)],
     ["Giới tính", st.gender || "—"],
     ["Điện thoại", st.phone || "—"],
     ["Email", st.email || "—"],
     ["Chức vụ", st.cadreRole || "—"],
     ["Trạng thái", st.status || "Đang học"],
     ["Địa chỉ", st.address || "—"],
     ["Đăng nhập", st.secret ? (st.mustChangeSecret ? "Đã cấp PIN, chờ sinh viên đổi" : "Đã kích hoạt") : "Chưa cấp PIN"]
    ].forEach(([k, v]) => { info.appendChild(el("dt", { text: k })); info.appendChild(el("dd", { text: v })); });

    const warnBox = el("div", {}, [
      el("div", { style: "margin-bottom:.5rem" }, ui.badge(p.warning.level, p.warning.label)),
      el("ul", { style: "margin:0;padding-left:1.1rem;font-size:.87rem" },
        p.warning.reasons.map((r) => el("li", { text: r })))
    ]);

    host.appendChild(el("div", { class: "grid-2" }, [
      ui.card("Thông tin sinh viên", [info]),
      ui.card("Tình trạng học vụ", [warnBox, el("p", { class: "card-sub", style: "margin-top:.8rem",
        text: A.warningRuleText().join(" ") })])
    ]));

    // biểu đồ GPA theo kỳ
    if (p.stats.bySemester.length) {
      const chartHost = el("div");
      host.appendChild(ui.card("GPA qua các học kỳ", [chartHost],
        { sub: "Tính trên các học phần có điểm trong từng kỳ" }));
      CV.charts.line(chartHost, p.stats.bySemester.map((x) => ({
        label: x.semester.name || x.semester.code,
        short: x.semester.code,
        y: x.gpa4,
        note: `${x.credits} tín chỉ${x.conduct !== null ? " · rèn luyện " + U.num(x.conduct, 0) : ""}`
      })), { ariaLabel: "GPA qua các học kỳ" });
    }

    // bảng điểm
    host.appendChild(scoreCard(st));
    // điểm rèn luyện
    host.appendChild(conductCard(st));
    // nhật ký cố vấn
    host.appendChild(noteCard(st));
    // lịch hẹn
    host.appendChild(apptCard(st));
  }

  function scoreCard(st) {
    const rows = U.sortBy(S.find("scores", (r) => r.studentId === st.id),
      (r) => (r.semesterId ? (S.get("semesters", r.semesterId) || {}).code || "" : "") + (r.subjectCode || ""));
    const counted = new Set(A.bestAttempts(rows.filter((r) => !isNaN(U.parseNum(r.score10)))).map((r) => r.id));

    return ui.card("Bảng điểm học phần", [
      ui.table([
        { key: "sem", label: "Học kỳ", render: (r) => (S.get("semesters", r.semesterId) || {}).code || "—" },
        { key: "code", label: "Học phần", render: (r) => el("div", { class: "t-name" }, [
            el("strong", { text: r.subjectName || r.subjectCode || "—" }),
            el("small", { text: r.subjectCode || "" })]) },
        { key: "cr", label: "TC", num: true, render: (r) => String(r.credits) },
        { key: "s10", label: "Hệ 10", num: true, render: (r) => U.num(r.score10, 1) },
        { key: "g", label: "Điểm chữ", render: (r) => {
            const g = A.toGrade(r.score10);
            return g ? el("span", { class: "grade", "data-pass": g.passed ? "1" : "0", text: g.letter }) : "—";
          } },
        { key: "g4", label: "Hệ 4", num: true, render: (r) => {
            const g = A.toGrade(r.score10); return g ? U.num(g.gpa4, 1) : "—"; } },
        { key: "use", label: "Tính GPA", render: (r) => counted.has(r.id)
            ? el("span", { class: "badge badge-ok", text: "Có" })
            : el("span", { class: "badge badge-info", text: "Lần học cũ" }) },
        { key: "act", label: "", render: (r) => el("div", { class: "row" }, [
            el("button", { class: "btn btn-ghost btn-sm", text: "Sửa", onclick: () => editScore(st, r) }),
            el("button", { class: "btn btn-ghost btn-sm", text: "Xoá", onclick: async () => {
              if (!(await ui.confirm({ title: "Xoá điểm", danger: true,
                message: `Xoá điểm học phần ${r.subjectName || r.subjectCode}?` }))) return;
              S.remove("scores", r.id); ui.toast("Đã xoá.", "ok"); CV.app.render();
            } })
          ]) }
      ], rows, {
        emptyTitle: "Chưa có điểm học phần",
        emptyText: "Thêm từng học phần, hoặc dùng màn hình Nhập điểm để nhập cả lớp một lượt."
      })
    ], {
      sub: "Học lại: hệ thống chỉ tính một lần theo quy tắc trong Cài đặt.",
      actions: [el("button", { class: "btn btn-primary btn-sm", text: "+ Thêm điểm",
        onclick: () => editScore(st, null) })]
    });
  }

  function editScore(st, score) {
    const sems = semesters();
    if (!sems.length) { ui.toast("Hãy tạo học kỳ trong mục Nhập điểm trước.", "err"); return; }
    ui.formModal({
      title: score ? "Sửa điểm học phần" : "Thêm điểm học phần",
      values: score || {},
      fields: [
        { name: "semesterId", label: "Học kỳ", type: "select", required: true,
          value: (score && score.semesterId) || sems[sems.length - 1].id,
          options: sems.map((s) => ({ value: s.id, label: s.name || s.code })) },
        { name: "subjectCode", label: "Mã học phần", required: true, placeholder: "MTU101" },
        { name: "subjectName", label: "Tên học phần", required: true, full: true },
        { name: "credits", label: "Số tín chỉ", type: "number", required: true, min: 1, max: 15,
          validate: (v) => A.validate.credits(v) },
        { name: "score10", label: "Điểm hệ 10", required: true, inputmode: "decimal",
          hint: "Nhập 0–10, dùng dấu phẩy hoặc dấu chấm.",
          validate: (v) => A.validate.score10(v) }
      ]
    }).then((d) => {
      if (!d) return;
      const payload = {
        studentId: st.id, semesterId: d.semesterId,
        subjectCode: d.subjectCode.toUpperCase(), subjectName: d.subjectName,
        credits: U.parseNum(d.credits), score10: U.parseNum(d.score10),
        gradedAt: new Date().toISOString()
      };
      if (score) payload.id = score.id;
      S.put("scores", payload);
      ui.toast("Đã lưu điểm.", "ok");
      CV.app.render();
    });
  }

  function conductCard(st) {
    const rows = U.sortBy(S.find("conduct", (r) => r.studentId === st.id),
      (r) => (S.get("semesters", r.semesterId) || {}).code || "");
    return ui.card("Điểm rèn luyện", [
      ui.table([
        { key: "sem", label: "Học kỳ", render: (r) => (S.get("semesters", r.semesterId) || {}).code || "—" },
        { key: "sc", label: "Điểm", num: true, render: (r) => U.num(r.score, 0) },
        { key: "xl", label: "Xếp loại", render: (r) => A.classifyConduct(r.score).label },
        { key: "note", label: "Ghi chú", render: (r) => r.note || "—" },
        { key: "act", label: "", render: (r) => el("button", { class: "btn btn-ghost btn-sm", text: "Xoá",
            onclick: async () => {
              if (!(await ui.confirm({ title: "Xoá điểm rèn luyện", danger: true, message: "Xoá dòng này?" }))) return;
              S.remove("conduct", r.id); CV.app.render();
            } }) }
      ], rows, { emptyTitle: "Chưa chấm điểm rèn luyện", emptyText: "" })
    ], { actions: [el("button", { class: "btn btn-primary btn-sm", text: "+ Chấm điểm", onclick: () => {
      const sems = semesters();
      if (!sems.length) { ui.toast("Hãy tạo học kỳ trước.", "err"); return; }
      ui.formModal({
        title: "Chấm điểm rèn luyện",
        fields: [
          { name: "semesterId", label: "Học kỳ", type: "select", required: true,
            options: sems.map((s) => ({ value: s.id, label: s.name || s.code })) },
          { name: "score", label: "Điểm (0–100)", type: "number", required: true, min: 0, max: 100,
            validate: (v) => A.validate.conduct(v) },
          { name: "note", label: "Ghi chú", type: "textarea", full: true }
        ]
      }).then((d) => {
        if (!d) return;
        const old = S.first("conduct", (c) => c.studentId === st.id && c.semesterId === d.semesterId);
        S.put("conduct", Object.assign({ studentId: st.id, score: U.parseNum(d.score) },
          d, old ? { id: old.id } : {}));
        ui.toast("Đã lưu điểm rèn luyện.", "ok");
        CV.app.render();
      });
    } })] });
  }

  function noteCard(st) {
    const rows = S.find("notes", (n) => n.studentId === st.id)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return ui.card("Nhật ký cố vấn", [
      rows.length
        ? el("ul", { class: "timeline" }, rows.map((n) => el("li", {}, [
            el("span", { class: "dot" }),
            el("div", { class: "tl-body" }, [
              el("div", { text: n.body }),
              el("small", { text: `${U.dmyhm(n.createdAt)} · ${(S.get("advisors", n.advisorId) || {}).name || "—"}` +
                (n.privateNote ? " · chỉ cố vấn xem" : " · sinh viên xem được") }),
              el("div", { style: "margin-top:.3rem" },
                el("button", { class: "btn btn-ghost btn-sm", text: "Xoá", onclick: async () => {
                  if (!(await ui.confirm({ title: "Xoá ghi chú", danger: true, message: "Xoá ghi chú này?" }))) return;
                  S.remove("notes", n.id); CV.app.render();
                } }))
            ])
          ])))
        : ui.empty("Chưa có ghi chú nào", "Ghi lại nội dung các lần trao đổi với sinh viên.")
    ], { actions: [el("button", { class: "btn btn-primary btn-sm", text: "+ Ghi chú", onclick: () => {
      ui.formModal({
        title: "Thêm ghi chú cố vấn",
        fields: [
          { name: "body", label: "Nội dung", type: "textarea", required: true, full: true, rows: 5 },
          { name: "privateNote", label: "Ai xem được", type: "select", full: true,
            options: [{ value: "1", label: "Chỉ giảng viên cố vấn" },
                      { value: "", label: "Sinh viên cũng xem được" }] }
        ]
      }).then((d) => {
        if (!d) return;
        S.put("notes", { studentId: st.id, advisorId: (me() || {}).id, body: d.body,
          privateNote: d.privateNote === "1" });
        ui.toast("Đã lưu ghi chú.", "ok");
        CV.app.render();
      });
    } })] });
  }

  function apptCard(st) {
    const rows = S.find("appointments", (a) => a.studentId === st.id)
      .sort((a, b) => String(b.date + b.time).localeCompare(String(a.date + a.time)));
    return ui.card("Lịch tư vấn của sinh viên này", [
      ui.table([
        { key: "d", label: "Thời gian", render: (r) => `${U.dmy(r.date)} ${r.time || ""}` },
        { key: "t", label: "Nội dung", render: (r) => r.topic || "—" },
        { key: "p", label: "Nơi gặp", render: (r) => r.place || "—" },
        { key: "s", label: "Trạng thái", render: (r) => r.status || "Chờ duyệt" }
      ], rows, { emptyTitle: "Chưa có lịch hẹn", emptyText: "" })
    ], { actions: [el("button", { class: "btn btn-ghost btn-sm", text: "+ Đặt lịch",
      onclick: () => editAppointment(null, st.id) })] });
  }

  function printOne(p) {
    const s = p.student;
    const wrap = el("div");
    wrap.appendChild(el("h2", { text: `${s.name} — ${s.mssv}` }));
    wrap.appendChild(el("p", { text: `Lớp: ${p.klass ? p.klass.code : "—"} · Ngày sinh: ${U.dmy(s.dob)} · Điện thoại: ${s.phone || "—"}` }));
    wrap.appendChild(el("p", { text: `GPA tích luỹ: ${U.num(p.stats.gpa4)} (hệ 10: ${U.num(p.stats.gpa10)}) · ` +
      `Tín chỉ tích luỹ: ${p.stats.earnedCredits} · Tín chỉ nợ: ${p.stats.debtCredits} · Học lực: ${p.learning.label}` }));
    wrap.appendChild(el("p", { text: `Mức cảnh báo: ${p.warning.label} — ${p.warning.reasons.join("; ")}` }));
    const rows = U.sortBy(S.find("scores", (r) => r.studentId === s.id), (r) => r.subjectCode || "");
    wrap.appendChild(ui.table([
      { key: "code", label: "Mã HP", render: (r) => r.subjectCode || "" },
      { key: "name", label: "Tên học phần", render: (r) => r.subjectName || "" },
      { key: "cr", label: "TC", num: true, render: (r) => String(r.credits) },
      { key: "s", label: "Hệ 10", num: true, render: (r) => U.num(r.score10, 1) },
      { key: "g", label: "Chữ", render: (r) => (A.toGrade(r.score10) || {}).letter || "" }
    ], rows, { emptyTitle: "Chưa có điểm", emptyText: "" }));
    wrap.appendChild(el("p", { style: "margin-top:1rem;font-size:.85rem",
      text: `Thang điểm áp dụng: ${A.scaleSummary()}` }));
    CV.io.print(`Hồ sơ học tập — ${s.name}`, wrap);
  }

  /* =====================================================================
     5. NHẬP ĐIỂM CẢ LỚP
     ===================================================================== */
  function editSemester(sem, done) {
    ui.formModal({
      title: sem ? "Sửa học kỳ" : "Thêm học kỳ",
      values: sem || {},
      fields: [
        { name: "code", label: "Mã học kỳ", required: true, placeholder: "2025-1",
          hint: "Dùng để sắp thứ tự, nên đặt dạng nămhọc-kỳ." },
        { name: "name", label: "Tên hiển thị", required: true, placeholder: "Học kỳ 1 năm học 2025-2026" },
        { name: "startDate", label: "Bắt đầu", type: "date" },
        { name: "endDate", label: "Kết thúc", type: "date" }
      ],
      check: (d) => {
        const dup = S.all("semesters").find((x) => U.fold(x.code) === U.fold(d.code) && (!sem || x.id !== sem.id));
        return dup ? `Học kỳ "${d.code}" đã có.` : null;
      }
    }).then((d) => {
      if (!d) return;
      if (sem) d.id = sem.id;
      S.put("semesters", d);
      ui.toast("Đã lưu học kỳ.", "ok");
      done && done();
    });
  }

  const entryState = { classId: "", semesterId: "", subjectCode: "", subjectName: "", credits: 3 };

  function scoreEntry(host) {
    const ks = myClasses();
    const sems = semesters();
    if (!ks.length) { host.appendChild(ui.card(null, needClass())); return; }

    if (!sems.length) {
      host.appendChild(ui.card("Chưa có học kỳ", [
        ui.empty("Cần tạo học kỳ trước khi nhập điểm",
          "Mỗi điểm học phần đều thuộc về một học kỳ, nhờ vậy mới vẽ được biểu đồ GPA theo thời gian.",
          el("button", { class: "btn btn-primary", text: "Tạo học kỳ",
            onclick: () => editSemester(null, () => CV.app.render()) }))
      ]));
      return;
    }

    if (!entryState.classId || !ks.some((k) => k.id === entryState.classId)) entryState.classId = ks[0].id;
    if (!entryState.semesterId || !sems.some((s) => s.id === entryState.semesterId)) {
      entryState.semesterId = sems[sems.length - 1].id;
    }

    /* --- quản lý học kỳ --- */
    host.appendChild(ui.card("Học kỳ", [
      ui.table([
        { key: "code", label: "Mã", render: (r) => r.code },
        { key: "name", label: "Tên", render: (r) => r.name },
        { key: "t", label: "Thời gian", render: (r) => `${U.dmy(r.startDate)} – ${U.dmy(r.endDate)}` },
        { key: "n", label: "Số điểm đã nhập", num: true,
          render: (r) => String(S.find("scores", (x) => x.semesterId === r.id).length) },
        { key: "act", label: "", render: (r) => el("div", { class: "row" }, [
            el("button", { class: "btn btn-ghost btn-sm", text: "Sửa",
              onclick: () => editSemester(r, () => CV.app.render()) }),
            el("button", { class: "btn btn-ghost btn-sm", text: "Xoá", onclick: async () => {
              const n = S.find("scores", (x) => x.semesterId === r.id).length;
              if (n) { ui.toast(`Học kỳ này còn ${n} điểm, hãy xoá điểm trước.`, "err"); return; }
              if (!(await ui.confirm({ title: "Xoá học kỳ", danger: true, message: `Xoá ${r.name}?` }))) return;
              S.remove("semesters", r.id); CV.app.render();
            } })
          ]) }
      ], sems, { emptyTitle: "Chưa có học kỳ", emptyText: "" })
    ], { actions: [el("button", { class: "btn btn-ghost btn-sm", text: "+ Thêm học kỳ",
      onclick: () => editSemester(null, () => CV.app.render()) })] }));

    /* --- bảng nhập điểm --- */
    const pick = el("div", { class: "row", style: "margin-bottom:1rem" });
    const classSel = el("select", { style: "max-width:220px" },
      ks.map((k) => el("option", { value: k.id, text: `${k.code} — ${k.name}`, selected: k.id === entryState.classId })));
    const semSel = el("select", { style: "max-width:260px" },
      sems.map((s) => el("option", { value: s.id, text: s.name || s.code, selected: s.id === entryState.semesterId })));
    classSel.addEventListener("change", () => { entryState.classId = classSel.value; drawGrid(); });
    semSel.addEventListener("change", () => { entryState.semesterId = semSel.value; drawGrid(); });
    pick.appendChild(el("label", { text: "Lớp", style: "font-size:.85rem;font-weight:650" }));
    pick.appendChild(classSel);
    pick.appendChild(el("label", { text: "Học kỳ", style: "font-size:.85rem;font-weight:650" }));
    pick.appendChild(semSel);
    pick.appendChild(el("div", { class: "row row-end" }, [
      el("button", { class: "btn btn-ghost btn-sm", text: "Tải tệp mẫu", onclick: () => CV.io.templateScores() }),
      el("button", { class: "btn btn-ghost btn-sm", text: "Nhập điểm từ CSV", onclick: async () => {
        const f = await ui.pickFile(".csv,.txt");
        if (!f) return;
        const res = CV.io.importScores(f.text, entryState.semesterId);
        if (!res.ok) { ui.toast(res.error, "err"); return; }
        ui.importReport("Kết quả nhập điểm", res);
        drawGrid();
      } })
    ]));
    host.appendChild(pick);

    const gridHost = el("div");
    host.appendChild(gridHost);

    function drawGrid() {
      gridHost.innerHTML = "";
      const list = U.sortBy(S.all("students").filter((s) => s.classId === entryState.classId), (s) => s.mssv);
      if (!list.length) {
        gridHost.appendChild(ui.card("Nhập điểm theo học phần", [
          ui.empty("Lớp này chưa có sinh viên", "Thêm sinh viên trước khi nhập điểm.")
        ]));
        return;
      }

      const head = ui.form([
        { name: "subjectCode", label: "Mã học phần", required: true, value: entryState.subjectCode, placeholder: "MTU101" },
        { name: "subjectName", label: "Tên học phần", required: true, value: entryState.subjectName },
        { name: "credits", label: "Số tín chỉ", type: "number", required: true, value: entryState.credits,
          min: 1, max: 15, validate: (v) => A.validate.credits(v) }
      ]);

      const body = el("tbody");
      const inputs = new Map();
      list.forEach((st) => {
        const input = el("input", { type: "text", inputmode: "decimal", placeholder: "—", style: "max-width:110px" });
        inputs.set(st.id, input);
        const gradeCell = el("td");
        function refresh() {
          gradeCell.innerHTML = "";
          const raw = input.value.trim();
          if (!raw) return;
          const err = A.validate.score10(raw);
          if (err) {
            input.setAttribute("aria-invalid", "true");
            gradeCell.appendChild(el("small", { style: "color:var(--critical)", text: err }));
            return;
          }
          input.removeAttribute("aria-invalid");
          const g = A.toGrade(raw);
          gradeCell.appendChild(el("span", { class: "grade", "data-pass": g.passed ? "1" : "0", text: g.letter }));
          gradeCell.appendChild(el("small", { style: "margin-left:.4rem;color:var(--muted)", text: U.num(g.gpa4, 1) }));
        }
        input.addEventListener("input", refresh);
        // Enter nhảy xuống ô kế tiếp cho nhanh tay
        input.addEventListener("keydown", (ev) => {
          if (ev.key !== "Enter") return;
          ev.preventDefault();
          const arr = Array.from(inputs.values());
          const i = arr.indexOf(input);
          if (arr[i + 1]) arr[i + 1].focus();
        });
        body.appendChild(el("tr", {}, [
          el("td", {}, el("div", { class: "t-name" }, [
            el("strong", { text: st.name }), el("small", { text: st.mssv })])),
          el("td", {}, input),
          gradeCell
        ]));
      });

      const t = el("table");
      t.appendChild(el("thead", {}, el("tr", {}, [
        el("th", { text: "Sinh viên" }), el("th", { text: "Điểm hệ 10" }), el("th", { text: "Quy đổi" })])));
      t.appendChild(body);

      const saveBtn = el("button", { class: "btn btn-primary", text: "Lưu bảng điểm" });
      saveBtn.addEventListener("click", () => {
        const d = head.validate();
        if (!d) return;
        entryState.subjectCode = d.subjectCode.toUpperCase();
        entryState.subjectName = d.subjectName;
        entryState.credits = U.parseNum(d.credits);

        let saved = 0, bad = 0;
        inputs.forEach((input, studentId) => {
          const raw = input.value.trim();
          if (!raw) return;
          if (A.validate.score10(raw)) { bad++; return; }
          const existing = S.first("scores", (sc) => sc.studentId === studentId &&
            sc.semesterId === entryState.semesterId &&
            String(sc.subjectCode || "").toUpperCase() === entryState.subjectCode);
          const payload = {
            studentId, semesterId: entryState.semesterId,
            subjectCode: entryState.subjectCode, subjectName: entryState.subjectName,
            credits: entryState.credits, score10: U.parseNum(raw),
            gradedAt: new Date().toISOString()
          };
          if (existing) payload.id = existing.id;
          S.put("scores", payload, { save: false });
          saved++;
        });
        S.save("score-entry");
        if (bad) ui.toast(`Đã lưu ${saved} điểm. ${bad} ô sai định dạng nên bị bỏ qua.`, "warn");
        else if (saved) ui.toast(`Đã lưu ${saved} điểm cho học phần ${entryState.subjectCode}.`, "ok");
        else ui.toast("Chưa nhập ô điểm nào.", "err");
        if (saved) CV.app.render();
      });

      gridHost.appendChild(ui.card("Nhập điểm theo học phần", [
        head.node,
        ui.note("Nhập điểm hệ 10, cột quy đổi hiện ngay điểm chữ để kiểm tra bằng mắt. " +
          "Bỏ trống ô nào thì sinh viên đó không được ghi điểm. " +
          "Nếu học phần đã có điểm trong kỳ này, điểm mới sẽ ghi đè.", "info"),
        el("div", { class: "table-wrap" }, t),
        el("div", { class: "row", style: "margin-top:1rem" }, saveBtn)
      ], { sub: `${list.length} sinh viên · thang điểm: ${A.scaleSummary()}` }));

      // nạp sẵn điểm đã có của học phần đang gõ
      if (entryState.subjectCode) {
        inputs.forEach((input, studentId) => {
          const ex = S.first("scores", (sc) => sc.studentId === studentId &&
            sc.semesterId === entryState.semesterId &&
            String(sc.subjectCode || "").toUpperCase() === entryState.subjectCode);
          if (ex) { input.value = U.num(ex.score10, 1); input.dispatchEvent(new Event("input")); }
        });
      }
    }
    drawGrid();
  }

  /* =====================================================================
     6. LỊCH TƯ VẤN
     ===================================================================== */
  function editAppointment(ap, presetStudentId) {
    const list = U.sortBy(myStudents(), (s) => s.name);
    if (!list.length) { ui.toast("Chưa có sinh viên nào.", "err"); return; }
    ui.formModal({
      title: ap ? "Sửa lịch hẹn" : "Đặt lịch tư vấn",
      values: ap || {},
      fields: [
        { name: "studentId", label: "Sinh viên", type: "select", required: true,
          value: (ap && ap.studentId) || presetStudentId || list[0].id,
          options: list.map((s) => ({ value: s.id, label: `${s.name} — ${s.mssv}` })) },
        { name: "date", label: "Ngày", type: "date", required: true, value: (ap && ap.date) || U.todayISO() },
        { name: "time", label: "Giờ", type: "text", placeholder: "14:00", value: (ap && ap.time) || "" },
        { name: "place", label: "Nơi gặp", placeholder: "Văn phòng khoa" },
        { name: "status", label: "Trạng thái", type: "select", value: (ap && ap.status) || "Đã duyệt",
          options: ["Chờ duyệt", "Đã duyệt", "Đã gặp", "Đã huỷ"].map((x) => ({ value: x, label: x })) },
        { name: "topic", label: "Nội dung trao đổi", type: "textarea", full: true }
      ]
    }).then((d) => {
      if (!d) return;
      if (ap) d.id = ap.id;
      d.advisorId = (me() || {}).id;
      S.put("appointments", d);
      ui.toast("Đã lưu lịch hẹn.", "ok");
      CV.app.render();
    });
  }

  function appointments(host) {
    const mine = new Set(myStudents().map((s) => s.id));
    const rows = S.all("appointments").filter((a) => mine.has(a.studentId))
      .sort((a, b) => String(b.date + (b.time || "")).localeCompare(String(a.date + (a.time || ""))));
    const pending = rows.filter((a) => (a.status || "Chờ duyệt") === "Chờ duyệt");

    if (pending.length) {
      host.appendChild(ui.note(`Có <strong>${pending.length}</strong> yêu cầu đặt lịch đang chờ bạn duyệt.`, "warn"));
    }

    host.appendChild(ui.card(`Lịch tư vấn (${rows.length})`, [
      ui.table([
        { key: "d", label: "Thời gian", render: (r) => `${U.dmy(r.date)} ${r.time || ""}` },
        { key: "st", label: "Sinh viên", render: (r) => {
            const s = S.get("students", r.studentId);
            return s ? el("div", { class: "t-name" }, [
              el("strong", { text: s.name }), el("small", { text: s.mssv })]) : "—"; } },
        { key: "t", label: "Nội dung", render: (r) => r.topic || "—" },
        { key: "p", label: "Nơi gặp", render: (r) => r.place || "—" },
        { key: "s", label: "Trạng thái", render: (r) => {
            const s = r.status || "Chờ duyệt";
            const cls = s === "Đã huỷ" ? "badge-critical" : s === "Chờ duyệt" ? "badge-watch"
              : s === "Đã gặp" ? "badge-ok" : "badge-info";
            return el("span", { class: `badge ${cls}`, text: s }); } },
        { key: "act", label: "", render: (r) => el("div", { class: "row" }, [
            (r.status || "Chờ duyệt") === "Chờ duyệt"
              ? el("button", { class: "btn btn-primary btn-sm", text: "Duyệt", onclick: () => {
                  S.put("appointments", { id: r.id, status: "Đã duyệt" });
                  ui.toast("Đã duyệt lịch hẹn.", "ok"); CV.app.render();
                } })
              : null,
            el("button", { class: "btn btn-ghost btn-sm", text: "Sửa", onclick: () => editAppointment(r) }),
            el("button", { class: "btn btn-ghost btn-sm", text: "Xoá", onclick: async () => {
              if (!(await ui.confirm({ title: "Xoá lịch hẹn", danger: true, message: "Xoá lịch hẹn này?" }))) return;
              S.remove("appointments", r.id); CV.app.render();
            } })
          ].filter(Boolean)) }
      ], rows, { emptyTitle: "Chưa có lịch hẹn nào",
        emptyText: "Sinh viên có thể tự đặt lịch từ Cổng Sinh viên, bạn duyệt lại ở đây." })
    ], { actions: [el("button", { class: "btn btn-primary btn-sm", text: "+ Đặt lịch",
      onclick: () => editAppointment(null) })] }));
  }

  /* =====================================================================
     7. BÁO CÁO
     ===================================================================== */
  function reports(host) {
    const ks = myClasses();
    if (!ks.length) { host.appendChild(ui.card(null, needClass())); return; }

    const state = { classId: "" };
    const pick = el("div", { class: "row", style: "margin-bottom:1rem" });
    const sel = el("select", { style: "max-width:260px" },
      [el("option", { value: "", text: "Tất cả lớp tôi phụ trách" })]
        .concat(ks.map((k) => el("option", { value: k.id, text: `${k.code} — ${k.name}` }))));
    sel.addEventListener("change", () => { state.classId = sel.value; draw(); });
    pick.appendChild(el("label", { text: "Phạm vi", style: "font-size:.85rem;font-weight:650" }));
    pick.appendChild(sel);
    host.appendChild(pick);

    const body = el("div");
    host.appendChild(body);

    function draw() {
      body.innerHTML = "";
      const list = state.classId
        ? S.all("students").filter((s) => s.classId === state.classId)
        : myStudents();
      const sum = A.summarize(list);
      const scope = state.classId ? (classOf(state.classId) || {}).code : "toàn bộ lớp phụ trách";

      const tbl = ui.table([
        { key: "k", label: "Chỉ tiêu" },
        { key: "v", label: "Số liệu", num: true }
      ], [
        { k: "Tổng số sinh viên", v: sum.total },
        { k: "Đã có điểm", v: sum.graded },
        { k: "GPA trung bình (hệ 4)", v: U.num(sum.gpaAvg) },
        { k: "Bình thường", v: sum.counts.ok },
        { k: "Cần theo dõi", v: sum.counts.watch },
        { k: "Cảnh báo", v: sum.counts.warn },
        { k: "Nguy cơ buộc thôi học", v: sum.counts.critical },
        { k: "Chưa có điểm", v: sum.counts.none },
        { k: "Tổng tín chỉ nợ", v: sum.debtTotal }
      ]);

      const warnRows = sum.rows
        .filter((r) => r.warning.level === "warn" || r.warning.level === "critical")
        .sort((a, b) => A.LEVELS[b.warning.level].rank - A.LEVELS[a.warning.level].rank);

      const warnTable = ui.table([
        { key: "mssv", label: "MSSV", render: (r) => r.student.mssv },
        { key: "name", label: "Họ và tên", render: (r) => r.student.name },
        { key: "class", label: "Lớp", render: (r) => (classOf(r.student.classId) || {}).code || "—" },
        { key: "gpa", label: "GPA", num: true, render: (r) => U.num(r.stats.gpa4) },
        { key: "debt", label: "TC nợ", num: true, render: (r) => String(r.stats.debtCredits) },
        { key: "lv", label: "Mức", render: (r) => r.warning.label },
        { key: "why", label: "Lý do", render: (r) => r.warning.reasons.join("; ") }
      ], warnRows, { emptyTitle: "Không có sinh viên thuộc diện cảnh báo", emptyText: "" });

      body.appendChild(ui.card(`Báo cáo tổng hợp — ${scope}`, [
        ui.note(`Quy tắc đang áp dụng: ${A.warningRuleText().join(" ")}<br>` +
          `Thang điểm: ${U.esc(A.scaleSummary())}`, "info"),
        tbl
      ], {
        sub: `Lập ngày ${U.dmy(U.todayISO())}`,
        actions: [
          el("button", { class: "btn btn-ghost btn-sm", text: "Xuất CSV",
            onclick: () => CV.io.exportSummary(list) }),
          el("button", { class: "btn btn-primary btn-sm", text: "In / lưu PDF", onclick: () => {
            const doc = el("div");
            doc.appendChild(el("h2", { text: `Báo cáo công tác cố vấn học tập — ${scope}` }));
            doc.appendChild(el("p", { text: `Giảng viên cố vấn: ${(me() || {}).name || "—"}` }));
            doc.appendChild(el("p", { text: `Quy tắc cảnh báo: ${A.warningRuleText().join(" ")}` }));
            doc.appendChild(el("p", { text: `Thang điểm: ${A.scaleSummary()}` }));
            doc.appendChild(ui.table([{ key: "k", label: "Chỉ tiêu" }, { key: "v", label: "Số liệu", num: true }], [
              { k: "Tổng số sinh viên", v: sum.total }, { k: "Đã có điểm", v: sum.graded },
              { k: "GPA trung bình", v: U.num(sum.gpaAvg) },
              { k: "Cần theo dõi", v: sum.counts.watch }, { k: "Cảnh báo", v: sum.counts.warn },
              { k: "Nguy cơ buộc thôi học", v: sum.counts.critical },
              { k: "Tổng tín chỉ nợ", v: sum.debtTotal }
            ]));
            doc.appendChild(el("h3", { text: "Danh sách sinh viên cần lưu ý", style: "margin-top:1rem" }));
            doc.appendChild(warnTable.cloneNode(true));
            CV.io.print("Báo cáo công tác cố vấn học tập", doc);
          } })
        ]
      }));

      body.appendChild(ui.card(`Danh sách sinh viên cần lưu ý (${warnRows.length})`, [warnTable]));
    }
    draw();
  }

  /* =====================================================================
     8. CÀI ĐẶT
     ===================================================================== */
  function settings(host) {
    const s = S.settings();

    /* --- thông tin chung --- */
    const gf = ui.form([
      { name: "schoolName", label: "Tên trường", value: s.schoolName, full: true },
      { name: "schoolShort", label: "Tên viết tắt", value: s.schoolShort },
      { name: "facultyName", label: "Khoa / Bộ môn", value: s.facultyName }
    ]);
    host.appendChild(ui.card("Thông tin đơn vị", [gf.node,
      el("button", { class: "btn btn-primary", text: "Lưu", onclick: () => {
        const d = gf.validate(); if (!d) return;
        Object.assign(S.settings(), d);
        S.save("settings");
        ui.toast("Đã lưu.", "ok");
        CV.app.render();
      } })]));

    /* --- thang điểm --- */
    const scaleHost = el("div");
    function drawScale() {
      scaleHost.innerHTML = "";
      const rows = A.scale();
      const inputs = [];
      const body = el("tbody");
      rows.forEach((r) => {
        const iL = el("input", { type: "text", value: r.letter, style: "max-width:90px" });
        const iMin = el("input", { type: "text", inputmode: "decimal", value: U.num(r.min, 1), style: "max-width:110px" });
        const i4 = el("input", { type: "text", inputmode: "decimal", value: U.num(r.gpa4, 1), style: "max-width:110px" });
        const iLb = el("input", { type: "text", value: r.label || "" });
        inputs.push({ iL, iMin, i4, iLb });
        body.appendChild(el("tr", {}, [el("td", {}, iL), el("td", {}, iMin), el("td", {}, i4), el("td", {}, iLb)]));
      });
      const t = el("table");
      t.appendChild(el("thead", {}, el("tr", {}, [
        el("th", { text: "Điểm chữ" }), el("th", { text: "Từ điểm hệ 10" }),
        el("th", { text: "Điểm hệ 4" }), el("th", { text: "Xếp loại" })])));
      t.appendChild(body);
      scaleHost.appendChild(el("div", { class: "table-wrap" }, t));
      scaleHost.appendChild(el("div", { class: "row", style: "margin-top:1rem" }, [
        el("button", { class: "btn btn-primary", text: "Lưu thang điểm", onclick: () => {
          const next = inputs.map((x) => ({
            letter: x.iL.value.trim(), min: U.parseNum(x.iMin.value),
            gpa4: U.parseNum(x.i4.value), label: x.iLb.value.trim()
          }));
          const errs = A.validateScale(next);
          if (errs.length) { ui.toast(errs[0], "err"); return; }
          S.settings().gradeScale = next.sort((a, b) => b.min - a.min);
          S.save("scale");
          ui.toast("Đã lưu thang điểm. Mọi GPA được tính lại ngay.", "ok");
          CV.app.render();
        } }),
        el("button", { class: "btn btn-ghost", text: "Khôi phục mặc định", onclick: async () => {
          if (!(await ui.confirm({ title: "Khôi phục thang điểm",
            message: "Đưa thang điểm về mặc định theo Thông tư 08/2021/TT-BGDĐT?" }))) return;
          S.settings().gradeScale = S.defaultSettings().gradeScale;
          S.save("scale");
          CV.app.render();
        } })
      ]));
    }
    drawScale();
    host.appendChild(ui.card("Thang điểm chữ", [
      ui.note("Đây là nơi duy nhất định nghĩa thang điểm. Máy tính GPA, bảng điểm, báo cáo và cổng sinh viên đều lấy từ đây, nên không thể lệch nhau. " +
        "<strong>Hãy đối chiếu với quy chế đào tạo của Trường trước khi phát hành.</strong>", "warn"),
      scaleHost
    ], { sub: "Mặc định theo Thông tư 08/2021/TT-BGDĐT" }));

    /* --- ngưỡng cảnh báo --- */
    const w = s.warning;
    const wf = ui.form([
      { name: "gpaWatch", label: "Cần theo dõi khi GPA dưới", value: U.num(w.gpaWatch), inputmode: "decimal" },
      { name: "debtWatch", label: "…hoặc nợ từ (tín chỉ)", value: String(w.debtWatch), type: "number", min: 0 },
      { name: "gpaWarn", label: "Cảnh báo khi GPA dưới", value: U.num(w.gpaWarn), inputmode: "decimal" },
      { name: "debtWarn", label: "…hoặc nợ quá (tín chỉ)", value: String(w.debtWarn), type: "number", min: 0 },
      { name: "gpaCritical", label: "Nguy cơ thôi học khi GPA dưới", value: U.num(w.gpaCritical), inputmode: "decimal" },
      { name: "debtCritical", label: "…hoặc nợ quá (tín chỉ)", value: String(w.debtCritical), type: "number", min: 0 }
    ]);
    host.appendChild(ui.card("Ngưỡng cảnh báo học vụ", [
      ui.note("Con số ở đây quyết định biểu đồ cảnh báo trên bàn làm việc và số liệu trong báo cáo gửi Khoa. " +
        "<strong>Cần đối chiếu quy chế của Trường.</strong>", "warn"),
      wf.node,
      el("button", { class: "btn btn-primary", text: "Lưu ngưỡng", onclick: () => {
        const d = wf.validate(); if (!d) return;
        const next = {
          gpaWatch: U.parseNum(d.gpaWatch), gpaWarn: U.parseNum(d.gpaWarn), gpaCritical: U.parseNum(d.gpaCritical),
          debtWatch: U.parseNum(d.debtWatch), debtWarn: U.parseNum(d.debtWarn), debtCritical: U.parseNum(d.debtCritical)
        };
        for (const k in next) if (isNaN(next[k]) || next[k] < 0) { ui.toast("Các ô phải là số không âm.", "err"); return; }
        if (!(next.gpaCritical <= next.gpaWarn && next.gpaWarn <= next.gpaWatch)) {
          ui.toast("Ngưỡng GPA phải giảm dần: nguy cơ ≤ cảnh báo ≤ theo dõi.", "err"); return;
        }
        if (!(next.debtWatch <= next.debtWarn && next.debtWarn <= next.debtCritical)) {
          ui.toast("Ngưỡng tín chỉ nợ phải tăng dần: theo dõi ≤ cảnh báo ≤ nguy cơ.", "err"); return;
        }
        S.settings().warning = next;
        S.save("warning");
        ui.toast("Đã lưu ngưỡng cảnh báo.", "ok");
        CV.app.render();
      } })
    ], { sub: A.warningRuleText().join(" ") }));

    /* --- quy tắc khác --- */
    const of = ui.form([
      { name: "retakeRule", label: "Khi sinh viên học lại", type: "select", value: s.retakeRule,
        options: [{ value: "best", label: "Lấy điểm cao nhất" }, { value: "latest", label: "Lấy điểm lần gần nhất" }] },
      { name: "studentLogin", label: "Sinh viên đăng nhập bằng", type: "select", value: s.studentLogin,
        options: [{ value: "pin", label: "MSSV + mã PIN do cố vấn cấp (an toàn hơn)" },
                  { value: "dob", label: "MSSV + ngày sinh (dễ nhớ, kém an toàn)" }] }
    ]);
    host.appendChild(ui.card("Quy tắc tính toán và đăng nhập", [
      of.node,
      ui.note("Chọn <strong>MSSV + ngày sinh</strong> đồng nghĩa ai biết mã số và ngày sinh của một em là xem được hồ sơ em đó. " +
        "Chỉ nên dùng khi thật cần thiết.", "warn"),
      el("button", { class: "btn btn-primary", text: "Lưu", onclick: () => {
        const d = of.validate(); if (!d) return;
        Object.assign(S.settings(), d);
        S.save("rules");
        ui.toast("Đã lưu.", "ok");
        CV.app.render();
      } })
    ]));

    /* --- tài khoản --- */
    const m = me();
    host.appendChild(ui.card("Tài khoản của tôi", [
      el("dl", { class: "kv" }, [
        el("dt", { text: "Họ tên" }), el("dd", { text: m.name }),
        el("dt", { text: "Email" }), el("dd", { text: m.email || "—" }),
        el("dt", { text: "Mã cán bộ" }), el("dd", { text: m.code || "—" }),
        el("dt", { text: "Vai trò" }), el("dd", { text: m.role === "owner" ? "Quản trị (thấy mọi lớp)" : "Cố vấn" }),
        el("dt", { text: "Lần đăng nhập gần nhất" }), el("dd", { text: U.dmyhm(m.lastLoginAt) })
      ])
    ], { actions: [
      el("button", { class: "btn btn-ghost btn-sm", text: "Sửa thông tin", onclick: () => {
        ui.formModal({
          title: "Sửa thông tin tài khoản",
          values: m,
          fields: [
            { name: "name", label: "Họ và tên", required: true, validate: (v) => A.validate.name(v) },
            { name: "title", label: "Học hàm / học vị" },
            { name: "email", label: "Email", type: "email", required: true, validate: (v) => A.validate.email(v) },
            { name: "code", label: "Mã cán bộ" },
            { name: "phone", label: "Điện thoại", type: "tel", validate: (v) => A.validate.phone(v) }
          ]
        }).then((d) => {
          if (!d) return;
          S.put("advisors", Object.assign({ id: m.id }, d));
          ui.toast("Đã lưu.", "ok"); CV.app.render();
        });
      } }),
      el("button", { class: "btn btn-ghost btn-sm", text: "Đổi mật khẩu", onclick: () => {
        ui.formModal({
          title: "Đổi mật khẩu",
          fields: [
            { name: "old", label: "Mật khẩu hiện tại", type: "password", required: true, full: true },
            { name: "pw", label: "Mật khẩu mới", type: "password", required: true, full: true,
              validate: (v) => A.validate.password(v) },
            { name: "pw2", label: "Nhập lại mật khẩu mới", type: "password", required: true, full: true }
          ],
          check: (d) => d.pw !== d.pw2 ? "Hai ô mật khẩu mới chưa giống nhau." : null
        }).then((d) => {
          if (!d) return;
          if (!U.checkSecret(d.old, m.secret)) { ui.toast("Mật khẩu hiện tại không đúng.", "err"); return; }
          S.put("advisors", { id: m.id, secret: U.makeSecret(d.pw) });
          ui.toast("Đã đổi mật khẩu.", "ok");
        });
      } })
    ] }));

    /* --- danh sách cố vấn (chỉ chủ tài khoản) --- */
    if (isOwner()) {
      host.appendChild(ui.card("Giảng viên cố vấn", [
        ui.table([
          { key: "name", label: "Họ tên", render: (r) => `${r.title ? r.title + " " : ""}${r.name}` },
          { key: "email", label: "Email", render: (r) => r.email || "—" },
          { key: "role", label: "Vai trò", render: (r) => r.role === "owner" ? "Quản trị" : "Cố vấn" },
          { key: "n", label: "Số lớp", num: true,
            render: (r) => String(S.find("classes", (c) => c.advisorId === r.id).length) },
          { key: "act", label: "", render: (r) => r.id === m.id ? el("span", { class: "badge badge-info", text: "Bạn" })
            : el("button", { class: "btn btn-ghost btn-sm", text: "Xoá", onclick: async () => {
                const n = S.find("classes", (c) => c.advisorId === r.id).length;
                if (n) { ui.toast(`Cố vấn này còn phụ trách ${n} lớp. Hãy chuyển lớp trước.`, "err"); return; }
                if (!(await ui.confirm({ title: "Xoá tài khoản", danger: true,
                  message: `Xoá tài khoản của ${r.name}?` }))) return;
                S.remove("advisors", r.id); ui.toast("Đã xoá.", "ok"); CV.app.render();
              } }) }
        ], S.all("advisors"), { emptyTitle: "—", emptyText: "" })
      ], { actions: [el("button", { class: "btn btn-primary btn-sm", text: "+ Thêm cố vấn", onclick: () => {
        ui.formModal({
          title: "Thêm giảng viên cố vấn",
          fields: [
            { name: "name", label: "Họ và tên", required: true, validate: (v) => A.validate.name(v) },
            { name: "title", label: "Học hàm / học vị" },
            { name: "email", label: "Email đăng nhập", type: "email", required: true,
              validate: (v) => A.validate.email(v) },
            { name: "code", label: "Mã cán bộ" },
            { name: "phone", label: "Điện thoại", type: "tel", validate: (v) => A.validate.phone(v) },
            { name: "pw", label: "Mật khẩu ban đầu", type: "password", required: true,
              validate: (v) => A.validate.password(v), full: true }
          ],
          check: (d) => S.first("advisors", (a) => U.fold(a.email) === U.fold(d.email))
            ? "Email này đã có tài khoản." : null
        }).then((d) => {
          if (!d) return;
          const pw = d.pw; delete d.pw;
          S.put("advisors", Object.assign({ role: "advisor", active: true, secret: U.makeSecret(pw) }, d));
          ui.toast("Đã thêm cố vấn. Nhắc thầy/cô đổi mật khẩu sau lần đăng nhập đầu.", "ok");
          CV.app.render();
        });
      } })] }));
    }

    /* --- dữ liệu --- */
    const use = S.usage();
    host.appendChild(ui.card("Dữ liệu và sao lưu", [
      ui.note(`Toàn bộ dữ liệu nằm trong bộ nhớ của trình duyệt trên <strong>chính thiết bị này</strong>. ` +
        `Xoá dữ liệu duyệt web hoặc gỡ ứng dụng là mất. Hãy sao lưu định kỳ. ` +
        `Đang dùng khoảng ${use.kb} KB trong hạn mức thường thấy là ${Math.round(use.limitKb / 1024)} MB.`,
        use.kb > use.limitKb * 0.8 ? "danger" : "info"),
      el("div", { class: "row" }, [
        el("button", { class: "btn btn-primary btn-sm", text: "Tải tệp sao lưu (JSON)", onclick: () => CV.io.backup() }),
        el("button", { class: "btn btn-ghost btn-sm", text: "Phục hồi từ tệp", onclick: async () => {
          const f = await ui.pickFile(".json");
          if (!f) return;
          const mode = await ui.confirm({
            title: "Phục hồi dữ liệu",
            message: `Phục hồi từ tệp ${f.name}?`,
            detail: "Chọn “Thay thế” để xoá dữ liệu hiện tại và dùng hoàn toàn dữ liệu trong tệp.",
            okText: "Thay thế", cancelText: "Huỷ"
          });
          if (!mode) return;
          const res = S.importJson(f.text, "replace");
          if (!res.ok) { ui.toast(res.error, "err"); return; }
          ui.toast("Đã phục hồi dữ liệu. Mời đăng nhập lại.", "ok");
          CV.auth.logout();
          CV.app.render();
        } }),
        el("button", { class: "btn btn-ghost btn-sm", text: "Xuất danh sách sinh viên (CSV)",
          onclick: () => CV.io.exportStudents(myStudents()) }),
        el("button", { class: "btn btn-ghost btn-sm", text: "Tải tệp mẫu nhập sinh viên",
          onclick: () => CV.io.templateStudents() }),
        el("button", { class: "btn btn-danger btn-sm", text: "Xoá toàn bộ dữ liệu", onclick: async () => {
          if (!(await ui.confirm({ title: "Xoá toàn bộ dữ liệu", danger: true,
            message: "Xoá sạch mọi lớp, sinh viên, điểm và tài khoản trên thiết bị này?",
            detail: "Không thể hoàn tác. Hãy tải tệp sao lưu trước.", okText: "Tôi hiểu, xoá hết" }))) return;
          const again = await ui.confirm({ title: "Xác nhận lần hai", danger: true,
            message: "Chắc chắn xoá? Sau bước này dữ liệu không lấy lại được." });
          if (!again) return;
          S.reset();
          ui.toast("Đã xoá toàn bộ dữ liệu.", "ok");
          CV.app.render();
        } })
      ])
    ]));

    /* --- dữ liệu minh hoạ --- */
    host.appendChild(ui.card("Dữ liệu minh hoạ", [
      ui.note("Nạp một lớp mẫu gồm 12 sinh viên với <strong>tên và số điện thoại rõ ràng là giả</strong>, " +
        "dùng để xem thử giao diện hoặc trình chiếu. Ứng dụng không bao giờ tự sinh dữ liệu ảo.", "info"),
      el("button", { class: "btn btn-ghost btn-sm", text: "Nạp dữ liệu minh hoạ", onclick: async () => {
        if (!(await ui.confirm({ title: "Nạp dữ liệu minh hoạ",
          message: "Thêm một lớp mẫu vào dữ liệu hiện có?" }))) return;
        seedDemo();
        ui.toast("Đã nạp lớp minh hoạ.", "ok");
        CV.app.render();
      } })
    ]));
  }

  /* ---------- dữ liệu minh hoạ (chỉ chạy khi người dùng bấm) ---------- */
  function seedDemo() {
    const m = me();
    const k = S.put("classes", { code: "DEMO01", name: "Lớp minh hoạ (dữ liệu giả)",
      major: "Kỹ thuật xây dựng", course: "K26", advisorId: m.id, note: "Dữ liệu mẫu, xoá được." });
    let sem = S.first("semesters", (x) => x.code === "2025-1");
    if (!sem) sem = S.put("semesters", { code: "2025-1", name: "Học kỳ 1 năm học 2025-2026" });
    let sem2 = S.first("semesters", (x) => x.code === "2025-2");
    if (!sem2) sem2 = S.put("semesters", { code: "2025-2", name: "Học kỳ 2 năm học 2025-2026" });

    const names = ["Nguyễn Văn Mẫu", "Trần Thị Thử", "Lê Minh Giả", "Phạm Thu Mẫu", "Hoàng Văn Thử",
      "Võ Thị Giả", "Đặng Minh Mẫu", "Bùi Thu Thử", "Đỗ Văn Giả", "Ngô Thị Mẫu",
      "Dương Minh Thử", "Lý Thu Giả"];
    const subjects = [
      { code: "DEMO101", name: "Toán cao cấp (mẫu)", credits: 3 },
      { code: "DEMO102", name: "Vật lý đại cương (mẫu)", credits: 2 },
      { code: "DEMO103", name: "Sức bền vật liệu (mẫu)", credits: 3 }
    ];
    names.forEach((name, i) => {
      const st = S.put("students", {
        classId: k.id, mssv: `DEMO${String(i + 1).padStart(3, "0")}`, name,
        gender: i % 2 ? "Nữ" : "Nam", dob: `2007-0${(i % 9) + 1}-1${i % 9}`,
        phone: `0900000${String(i + 1).padStart(3, "0")}`,
        email: `demo${i + 1}@example.edu.vn`,
        cadreRole: i === 0 ? "Lớp trưởng" : i === 1 ? "Bí thư" : "",
        status: "Đang học", note: "Dữ liệu minh hoạ"
      }, { save: false });
      subjects.forEach((sub, j) => {
        // điểm rải đều để biểu đồ có hình dạng, không phải số ngẫu nhiên vô nghĩa
        const base = 3 + ((i * 7 + j * 3) % 8);
        S.put("scores", { studentId: st.id, semesterId: j === 2 ? sem2.id : sem.id,
          subjectCode: sub.code, subjectName: sub.name, credits: sub.credits,
          score10: Math.min(10, base + (j % 2 ? 0.5 : 0)), gradedAt: new Date().toISOString() },
          { save: false });
      });
      S.put("conduct", { studentId: st.id, semesterId: sem.id, score: 60 + ((i * 5) % 38) }, { save: false });
    });
    S.save("seed-demo");
  }

  /* =====================================================================
     Khai báo các màn hình cho bộ định tuyến
     ===================================================================== */
  const routes = {
    "advisor/dashboard":    { title: "Bàn làm việc", icon: "home", nav: "Bàn làm việc", render: dashboard },
    "advisor/students":     { title: "Sinh viên", icon: "users", nav: "Sinh viên", render: students },
    "advisor/student":      { title: "Hồ sơ sinh viên", icon: "user", render: studentDetail },
    "advisor/classes":      { title: "Lớp cố vấn", icon: "class", nav: "Lớp cố vấn", render: classes },
    "advisor/scores":       { title: "Nhập điểm", icon: "score", nav: "Nhập điểm", render: scoreEntry },
    "advisor/appointments": { title: "Lịch tư vấn", icon: "cal", nav: "Lịch tư vấn", render: appointments },
    "advisor/reports":      { title: "Báo cáo", icon: "report", nav: "Báo cáo", render: reports },
    "advisor/settings":     { title: "Cài đặt", icon: "gear", nav: "Cài đặt", render: settings }
  };

  return { routes, myClasses, myStudents, me, isOwner, editAppointment, seedDemo };
})();
