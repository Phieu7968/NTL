/* =====================================================================
   view-student.js — Cổng Sinh viên
   Nguyên tắc: mỗi em chỉ xem được hồ sơ của chính mình. Không có ô chọn
   sinh viên khác, và mọi truy vấn đều lọc theo id trong phiên đăng nhập.
   ===================================================================== */
window.CV = window.CV || {};

CV.viewStudent = (function () {
  "use strict";
  const U = CV.util, el = U.el, ui = CV.ui, A = CV.academic, S = CV.store;

  const me = () => { const c = CV.auth.current(); return c && c.kind === "student" ? c.user : null; };

  /** Lấy hồ sơ của chính người đang đăng nhập. Không nhận tham số id từ URL. */
  function myProfile() {
    const m = me();
    return m ? A.profileOf(m.id) : null;
  }

  /**
   * Lớp có thể có Cố vấn học tập và Giáo viên chủ nhiệm là hai người khác nhau
   * (Quyết định 758/QĐ-ĐHXDMT, Điều 2.3), nên trả về cả hai.
   */
  function staffOf(p) {
    const cv = p.klass && p.klass.advisorId ? S.get("advisors", p.klass.advisorId) : null;
    const gv = p.klass && p.klass.gvcnId ? S.get("advisors", p.klass.gvcnId) : cv;
    return { cvht: cv, gvcn: gv, same: !p.klass || !p.klass.gvcnId || p.klass.gvcnId === p.klass.advisorId };
  }

  function contactCard(person, role) {
    return el("div", {}, [
      el("h3", { text: role, style: "margin:0 0 .4rem;font-size:.9rem;color:var(--muted)" }),
      el("dl", { class: "kv" }, [
        el("dt", { text: "Họ tên" }),
        el("dd", { text: `${person.title ? person.title + " " : ""}${person.name}` }),
        el("dt", { text: "Email" }), el("dd", { text: person.email || "—" }),
        el("dt", { text: "Điện thoại" }), el("dd", { text: person.phone || "—" })
      ])
    ]);
  }

  /* ---------- buộc đổi mã PIN lần đầu ---------- */
  function forceChangePin() {
    const m = me();
    if (!m) return;
    const f = ui.form([
      { name: "pin", label: "Mã PIN mới (6 chữ số)", type: "password", required: true, full: true,
        inputmode: "numeric", validate: (v) => A.validate.pin(v) },
      { name: "pin2", label: "Nhập lại mã PIN mới", type: "password", required: true, full: true,
        inputmode: "numeric" }
    ]);
    const m2 = ui.modal({
      title: "Đổi mã PIN lần đầu",
      dismissable: false,
      body: [
        ui.note("Mã PIN hiện tại do giảng viên cố vấn cấp. Hãy đổi sang mã riêng của em và không cho ai biết.", "warn"),
        f.node
      ],
      actions: [{ label: "Đổi mã PIN", class: "btn-primary", onClick: (close) => {
        const d = f.validate();
        if (!d) return;
        if (d.pin !== d.pin2) { ui.toast("Hai ô mã PIN chưa giống nhau.", "err"); return; }
        S.put("students", { id: m.id, secret: U.makeSecret(d.pin), mustChangeSecret: false });
        ui.toast("Đã đổi mã PIN.", "ok");
        close();
        CV.app.render();
      } }]
    });
    return m2;
  }

  /* ---------- 1. Trang chính ---------- */
  function home(host) {
    const p = myProfile();
    if (!p) return;
    const st = p.student;
    const staff = staffOf(p);

    host.appendChild(ui.card3d([
      el("div", { class: "lift-1", style: "display:flex;gap:1rem;align-items:center;flex-wrap:wrap" }, [
        el("span", { class: "avatar lift-2", style: "width:56px;height:56px;font-size:1.2rem",
          text: U.initials(st.name) }),
        el("div", {}, [
          el("h2", { style: "margin:0", text: st.name }),
          el("p", { style: "margin:0;color:var(--muted);font-size:.88rem",
            text: `${st.mssv}${p.klass ? " · " + p.klass.code : ""}${st.cadreRole ? " · " + st.cadreRole : ""}` })
        ]),
        el("div", { class: "row row-end" }, ui.badge(p.warning.level, p.warning.label))
      ])
    ]));

    host.appendChild(el("div", { class: "deck", style: "margin-top:1rem" }, [
      ui.stat({ label: "GPA tích luỹ", value: U.num(p.stats.gpa4), icon: "score",
        note: `Hệ 10: ${U.num(p.stats.gpa10)} · ${p.learning.label}` }),
      ui.stat({ label: "Tín chỉ tích luỹ", value: String(p.stats.earnedCredits), icon: "class",
        note: `${p.stats.subjects} học phần đã có điểm` }),
      ui.stat({ label: "Tín chỉ còn nợ", value: String(p.stats.debtCredits), icon: "note",
        tone: p.stats.debtCredits ? "warn" : "ok",
        note: p.stats.debtCredits ? "Cần đăng ký học lại" : "Không nợ học phần nào" }),
      ui.stat({ label: "Điểm rèn luyện", value: U.num(p.stats.conductAvg, 1), icon: "users",
        note: p.conduct.label })
    ]));

    // tình trạng học vụ nói thẳng bằng chữ
    const tone = p.warning.level === "critical" ? "danger"
      : p.warning.level === "warn" || p.warning.level === "watch" ? "warn" : "info";
    host.appendChild(ui.card("Tình trạng học vụ của em", [
      ui.note(`<strong>${U.esc(p.warning.label)}</strong> — ${U.esc(p.warning.reasons.join("; "))}`, tone),
      el("p", { class: "card-sub", text: A.warningRuleText().join(" ") }),
      p.stats.debtSubjects.length
        ? el("div", {}, [
            el("h3", { text: "Học phần chưa đạt", style: "margin-top:1rem" }),
            el("div", { class: "pill-row" }, p.stats.debtSubjects.map((sc) =>
              el("span", { class: "badge badge-critical",
                text: `${sc.subjectName || sc.subjectCode} (${sc.credits} TC)` })))
          ])
        : null
    ]));

    if (p.stats.terms.length) {
      host.appendChild(ui.card("Kết quả học kỳ chính thức", [
        ui.table([
          { key: "sem", label: "Học kỳ", render: (r) => (r.semester || {}).name || (r.semester || {}).code || "—" },
          { key: "g10", label: "TBC hệ 10", num: true, render: (r) => U.num(r.gpa10) },
          { key: "g4", label: "TBC hệ 4", num: true, render: (r) => U.num(r.gpa4) },
          { key: "cum", label: "TBC tích luỹ", num: true, render: (r) => U.num(r.cumGpa4) },
          { key: "cr", label: "TC tích luỹ", num: true, render: (r) => r.credits === null ? "—" : String(r.credits) },
          { key: "rank", label: "Xếp loại", render: (r) => r.rank || "—" }
        ], p.stats.terms, {})
      ], { sub: "Số liệu do Phòng Đào tạo gửi về, cập nhật sau mỗi học kỳ." }));
    }

    if (p.stats.bySemester.length) {
      const ch = el("div");
      host.appendChild(ui.card("GPA của em qua các học kỳ", [ch]));
      CV.charts.line(ch, p.stats.bySemester.map((x) => ({
        label: x.semester.name || x.semester.code, short: x.semester.code, y: x.gpa4,
        note: `${x.credits} tín chỉ`
      })), { ariaLabel: "GPA qua các học kỳ" });
    }

    const staffBody = !staff.cvht
      ? [ui.empty("Lớp chưa có giảng viên phụ trách", "")]
      : staff.same
        ? [contactCard(staff.cvht, "Cố vấn học tập kiêm Giáo viên chủ nhiệm")]
        : [el("div", { class: "grid-2" }, [
            contactCard(staff.cvht, "Cố vấn học tập"),
            staff.gvcn ? contactCard(staff.gvcn, "Giáo viên chủ nhiệm") : null
          ].filter(Boolean))];

    // Đăng ký học phần của học kỳ sắp tới
    const sems = U.sortBy(S.all("semesters"), (x) => x.code);
    const nextSem = sems.length ? sems[sems.length - 1] : null;
    if (nextSem) {
      const reg = A.registrationOf(st.id, nextSem.id);
      const state = A.registrationState(reg);
      const tone = state.key === "confirmed" ? "info" : state.key === "none" ? "danger" : "warn";
      host.appendChild(ui.card("Đăng ký học phần " + (nextSem.name || nextSem.code), [
        ui.note(`<strong>${U.esc(state.label)}</strong>` +
          (state.credits ? ` — đã đăng ký ${state.credits} tín chỉ.` : ".") +
          (reg && reg.note ? `<br>Cố vấn nhắn: ${U.esc(reg.note)}` : ""), tone),
        el("dl", { class: "kv" }, [
          el("dt", { text: "Thời gian đăng ký" }),
          el("dd", { text: nextSem.regStart || nextSem.regEnd
            ? `${U.dmy(nextSem.regStart)} – ${U.dmy(nextSem.regEnd)}` : "Chưa có thông báo" }),
          el("dt", { text: "Cố vấn xác nhận trước" }),
          el("dd", { text: U.dmy(nextSem.regDeadline) })
        ]),
        ui.note("Sinh viên đăng ký trực tuyến tại cổng thông tin của Trường. " +
          "Ô này chỉ để em và cố vấn cùng theo dõi kết quả.", "info")
      ]));
    }

    host.appendChild(ui.card("Giảng viên phụ trách lớp của em", staffBody,
      { actions: [el("button", { class: "btn btn-primary btn-sm", text: "Đặt lịch gặp",
        onclick: () => requestAppointment() })] }));

    // ghi chú cố vấn mà sinh viên được xem
    const notes = S.find("notes", (n) => n.studentId === st.id && !n.privateNote)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    if (notes.length) {
      host.appendChild(ui.card("Lời nhắn từ cố vấn", [
        el("ul", { class: "timeline" }, notes.map((n) => el("li", {}, [
          el("span", { class: "dot" }),
          el("div", { class: "tl-body" }, [
            el("div", { text: n.body }),
            el("small", { text: U.dmyhm(n.createdAt) })
          ])
        ])))
      ]));
    }
  }

  /* ---------- 2. Bảng điểm ---------- */
  function scores(host) {
    const p = myProfile();
    if (!p) return;
    const rows = S.find("scores", (r) => r.studentId === p.student.id);
    const counted = new Set(A.bestAttempts(rows.filter((r) => !isNaN(U.parseNum(r.score10)))).map((r) => r.id));

    if (!rows.length) {
      host.appendChild(ui.card("Bảng điểm", [
        ui.empty("Chưa có điểm nào", "Giảng viên cố vấn sẽ cập nhật sau khi có kết quả học kỳ.")
      ]));
      return;
    }

    // nhóm theo học kỳ
    const groups = U.groupBy(rows, (r) => r.semesterId || "");
    const order = U.sortBy(Array.from(groups.keys()), (id) => (S.get("semesters", id) || {}).code || "zzz");

    order.forEach((semId) => {
      const sem = S.get("semesters", semId);
      const list = groups.get(semId);
      const g = A.gpaOf(list);
      const conduct = S.first("conduct", (c) => c.studentId === p.student.id && c.semesterId === semId);
      host.appendChild(ui.card(sem ? (sem.name || sem.code) : "Chưa xếp học kỳ", [
        ui.table([
          { key: "code", label: "Học phần", render: (r) => el("div", { class: "t-name" }, [
              el("strong", { text: r.subjectName || r.subjectCode || "—" }),
              el("small", { text: r.subjectCode || "" })]) },
          { key: "cr", label: "TC", num: true, render: (r) => String(r.credits) },
          { key: "s", label: "Hệ 10", num: true, render: (r) => U.num(r.score10, 1) },
          { key: "g", label: "Điểm chữ", render: (r) => {
              const gr = A.toGrade(r.score10);
              return gr ? el("span", { class: "grade", "data-pass": gr.passed ? "1" : "0", text: gr.letter }) : "—"; } },
          { key: "g4", label: "Hệ 4", num: true, render: (r) => {
              const gr = A.toGrade(r.score10); return gr ? U.num(gr.gpa4, 1) : "—"; } },
          { key: "u", label: "Tính GPA", render: (r) => counted.has(r.id)
              ? el("span", { class: "badge badge-ok", text: "Có" })
              : el("span", { class: "badge badge-info", text: "Lần học cũ" }) }
        ], U.sortBy(list, (r) => r.subjectCode || ""), {})
      ], { sub: `GPA học kỳ: ${U.num(g.gpa4)} · ${g.credits} tín chỉ` +
        (conduct ? ` · Rèn luyện: ${U.num(conduct.score, 0)} (${A.classifyConduct(conduct.score).label})` : "") }));
    });

    host.appendChild(ui.card("Tổng kết", [
      el("dl", { class: "kv" }, [
        el("dt", { text: "GPA tích luỹ (hệ 4)" }), el("dd", { text: U.num(p.stats.gpa4) }),
        el("dt", { text: "GPA tích luỹ (hệ 10)" }), el("dd", { text: U.num(p.stats.gpa10) }),
        el("dt", { text: "Tín chỉ tích luỹ" }), el("dd", { text: String(p.stats.earnedCredits) }),
        el("dt", { text: "Tín chỉ nợ" }), el("dd", { text: String(p.stats.debtCredits) }),
        el("dt", { text: "Học lực" }), el("dd", { text: p.learning.label })
      ]),
      el("p", { class: "card-sub", style: "margin-top:.8rem", text: `Thang điểm áp dụng: ${A.scaleSummary()}` })
    ], { actions: [el("button", { class: "btn btn-ghost btn-sm", text: "In bảng điểm", onclick: () => {
      const doc = el("div");
      doc.appendChild(el("h2", { text: `Bảng điểm — ${p.student.name} (${p.student.mssv})` }));
      doc.appendChild(el("p", { text: `Lớp: ${p.klass ? p.klass.code : "—"}` }));
      doc.appendChild(ui.table([
        { key: "sem", label: "Học kỳ", render: (r) => (S.get("semesters", r.semesterId) || {}).code || "—" },
        { key: "code", label: "Mã HP", render: (r) => r.subjectCode || "" },
        { key: "name", label: "Tên học phần", render: (r) => r.subjectName || "" },
        { key: "cr", label: "TC", num: true, render: (r) => String(r.credits) },
        { key: "s", label: "Hệ 10", num: true, render: (r) => U.num(r.score10, 1) },
        { key: "g", label: "Chữ", render: (r) => (A.toGrade(r.score10) || {}).letter || "" }
      ], rows, {}));
      doc.appendChild(el("p", { text: `GPA tích luỹ: ${U.num(p.stats.gpa4)} · Tín chỉ tích luỹ: ${p.stats.earnedCredits} · Tín chỉ nợ: ${p.stats.debtCredits}` }));
      CV.io.print("Bảng điểm sinh viên", doc);
    } })] }));
  }

  /* ---------- 3. Lịch tư vấn ---------- */
  function requestAppointment() {
    const m = me();
    if (!m) return;
    ui.formModal({
      title: "Xin gặp giảng viên cố vấn",
      intro: "Yêu cầu sẽ chuyển tới giảng viên cố vấn của lớp để duyệt.",
      fields: [
        { name: "date", label: "Ngày mong muốn", type: "date", required: true, value: U.todayISO() },
        { name: "time", label: "Giờ mong muốn", placeholder: "14:00" },
        { name: "topic", label: "Nội dung cần trao đổi", type: "textarea", required: true, full: true,
          rows: 4, placeholder: "Ví dụ: xin tư vấn đăng ký học lại học phần Sức bền vật liệu." }
      ],
      check: (d) => d.date < U.todayISO() ? "Không đặt lịch cho ngày đã qua." : null
    }).then((d) => {
      if (!d) return;
      const p = myProfile();
      S.put("appointments", {
        studentId: m.id, advisorId: p.klass ? p.klass.advisorId : "",
        date: d.date, time: d.time, topic: d.topic,
        status: "Chờ duyệt", createdBy: "student"
      });
      ui.toast("Đã gửi yêu cầu. Chờ giảng viên cố vấn duyệt.", "ok");
      CV.app.render();
    });
  }

  function appointments(host) {
    const m = me();
    if (!m) return;
    const rows = S.find("appointments", (a) => a.studentId === m.id)
      .sort((a, b) => String(b.date + (b.time || "")).localeCompare(String(a.date + (a.time || ""))));

    host.appendChild(ui.card(`Lịch tư vấn của em (${rows.length})`, [
      ui.table([
        { key: "d", label: "Thời gian", render: (r) => `${U.dmy(r.date)} ${r.time || ""}` },
        { key: "t", label: "Nội dung", render: (r) => r.topic || "—" },
        { key: "p", label: "Nơi gặp", render: (r) => r.place || "Cố vấn sẽ báo sau" },
        { key: "s", label: "Trạng thái", render: (r) => {
            const s = r.status || "Chờ duyệt";
            const cls = s === "Đã huỷ" ? "badge-critical" : s === "Chờ duyệt" ? "badge-watch"
              : s === "Đã gặp" ? "badge-ok" : "badge-info";
            return el("span", { class: `badge ${cls}`, text: s }); } },
        { key: "act", label: "", render: (r) => ["Chờ duyệt", "Đã duyệt"].includes(r.status || "Chờ duyệt")
            ? el("button", { class: "btn btn-ghost btn-sm", text: "Huỷ", onclick: async () => {
                if (!(await ui.confirm({ title: "Huỷ lịch hẹn", danger: true,
                  message: "Huỷ yêu cầu gặp này?" }))) return;
                S.put("appointments", { id: r.id, status: "Đã huỷ" });
                ui.toast("Đã huỷ.", "ok"); CV.app.render();
              } })
            : null }
      ], rows, { emptyTitle: "Chưa có lịch hẹn nào",
        emptyText: "Bấm “Xin gặp cố vấn” để gửi yêu cầu." })
    ], { actions: [el("button", { class: "btn btn-primary btn-sm", text: "Xin gặp cố vấn",
      onclick: requestAppointment })] }));
  }

  /* ---------- 4. Hồ sơ cá nhân ---------- */
  function profile(host) {
    const p = myProfile();
    if (!p) return;
    const st = p.student;

    host.appendChild(ui.card("Thông tin của em", [
      el("dl", { class: "kv" }, [
        el("dt", { text: "Họ và tên" }), el("dd", { text: st.name }),
        el("dt", { text: "Mã số sinh viên" }), el("dd", { text: st.mssv }),
        el("dt", { text: "Lớp" }), el("dd", { text: p.klass ? `${p.klass.code} — ${p.klass.name}` : "—" }),
        el("dt", { text: "Ngày sinh" }), el("dd", { text: U.dmy(st.dob) }),
        el("dt", { text: "Giới tính" }), el("dd", { text: st.gender || "—" }),
        el("dt", { text: "Điện thoại" }), el("dd", { text: st.phone || "—" }),
        el("dt", { text: "Zalo" }), el("dd", { text: st.zalo || "—" }),
        el("dt", { text: "Email" }), el("dd", { text: st.email || "—" }),
        el("dt", { text: "Địa chỉ" }), el("dd", { text: st.address || "—" }),
        el("dt", { text: "Trạng thái" }), el("dd", { text: st.status || "Đang học" })
      ]),
      ui.note("Muốn sửa họ tên, ngày sinh hay lớp thì báo giảng viên cố vấn. " +
        "Em tự sửa được điện thoại, Zalo, email và địa chỉ.", "info")
    ], { actions: [el("button", { class: "btn btn-ghost btn-sm", text: "Sửa liên hệ", onclick: () => {
      ui.formModal({
        title: "Cập nhật thông tin liên hệ",
        values: st,
        fields: [
          { name: "phone", label: "Điện thoại", type: "tel", validate: (v) => A.validate.phone(v) },
          { name: "zalo", label: "Số Zalo", type: "tel", validate: (v) => A.validate.phone(v),
            hint: "Để trống nếu dùng chung số điện thoại ở trên." },
          { name: "email", label: "Email", type: "email", validate: (v) => A.validate.email(v), full: true },
          { name: "address", label: "Địa chỉ", full: true },
          { name: "contactNote", label: "Ghi chú liên hệ", type: "textarea", full: true, rows: 2,
            placeholder: "Ví dụ: chỉ gọi được buổi tối, hoặc nhắn Zalo tiện hơn." }
        ]
      }).then((d) => {
        if (!d) return;
        S.put("students", Object.assign({ id: st.id }, d, { contactChangedAt: new Date().toISOString() }));
        ui.toast("Đã cập nhật. Nhớ gửi phiếu cập nhật cho cố vấn.", "ok", 5000);
        CV.app.render();
      });
    } })] }));

    /* Đồng bộ tự động nếu cố vấn đã bật */
    if (CV.sync.isOn()) {
      host.appendChild(ui.card("Đồng bộ với cố vấn", [
        ui.note("Máy này nối thẳng với máy của giảng viên cố vấn. Em sửa số điện thoại, Zalo " +
          "hay đặt lịch gặp là thầy cô nhận được, không phải gửi tệp.", "info"),
        el("p", { class: "card-sub", text: CV.sync.status().text }),
        el("button", { class: "btn btn-primary btn-sm", text: "Đồng bộ ngay", onclick: async (ev) => {
          ev.target.disabled = true;
          const r = await CV.sync.run();
          ev.target.disabled = false;
          if (!r.ok) { ui.toast("Chưa đồng bộ được: " + r.error, "err", 8000); return; }
          ui.toast("Đã đồng bộ xong.", "ok");
          CV.app.render();
        } })
      ]));
    }

    /* Chiều ngược khi không có máy chủ: gửi tệp cập nhật */
    if (st.linkToken && !CV.sync.isOn()) {
      const daNhan = st.contactChangedAt && (!st.updateSentAt || st.updateSentAt < st.contactChangedAt);
      host.appendChild(ui.card("Gửi cập nhật cho cố vấn", [
        ui.note(daNhan
          ? "Em vừa sửa thông tin liên hệ. Hãy gửi phiếu cập nhật để cố vấn có số mới."
          : "Sửa xong thông tin liên hệ hoặc đặt lịch gặp thì gửi phiếu này cho cố vấn.",
          daNhan ? "warn" : "info"),
        el("p", { class: "card-sub", text: st.updateSentAt
          ? "Lần gửi gần nhất: " + U.dmyhm(st.updateSentAt) : "Chưa gửi lần nào." }),
        el("button", { class: "btn btn-primary btn-sm", text: "Tạo phiếu cập nhật", onclick: sendUpdate })
      ]));
    }

    if (CV.pack.isStudentDevice()) {
      host.appendChild(ui.card("Dữ liệu trên máy này", [
        ui.note("Máy này chỉ giữ hồ sơ của riêng em, do cố vấn gửi trong một tệp dữ liệu. " +
          "Không có hồ sơ của bạn nào khác.", "info"),
        el("p", { class: "card-sub", text: "Nạp lúc " + U.dmyhm(S.settings().installedAt) }),
        el("button", { class: "btn btn-danger btn-sm", text: "Xoá dữ liệu khỏi máy này",
          onclick: async () => {
            if (!(await ui.confirm({ title: "Xoá dữ liệu", danger: true,
              message: "Xoá toàn bộ hồ sơ của em khỏi máy này?",
              detail: "Dùng khi em mượn máy người khác. Muốn xem lại thì nạp lại tệp cố vấn đã gửi.",
              okText: "Xoá" }))) return;
            S.reset();
            CV.auth.logout();
            ui.toast("Đã xoá dữ liệu khỏi máy này.", "ok");
            location.hash = "";
            CV.app.render();
          } })
      ]));
    }

    if (S.settings().studentLogin !== "dob") {
      host.appendChild(ui.card("Bảo mật", [
        ui.note("Mã PIN là chìa khoá vào hồ sơ của riêng em. Không đưa cho bạn bè, không dùng ngày sinh làm mã.", "warn"),
        el("button", { class: "btn btn-primary btn-sm", text: "Đổi mã PIN", onclick: () => {
          ui.formModal({
            title: "Đổi mã PIN",
            fields: [
              { name: "old", label: "Mã PIN hiện tại", type: "password", required: true, full: true,
                inputmode: "numeric" },
              { name: "pin", label: "Mã PIN mới (6 chữ số)", type: "password", required: true, full: true,
                inputmode: "numeric", validate: (v) => A.validate.pin(v) },
              { name: "pin2", label: "Nhập lại mã PIN mới", type: "password", required: true, full: true,
                inputmode: "numeric" }
            ],
            check: (d) => d.pin !== d.pin2 ? "Hai ô mã PIN mới chưa giống nhau." : null
          }).then((d) => {
            if (!d) return;
            if (!U.checkSecret(d.old, st.secret)) { ui.toast("Mã PIN hiện tại không đúng.", "err"); return; }
            S.put("students", { id: st.id, secret: U.makeSecret(d.pin), mustChangeSecret: false });
            ui.toast("Đã đổi mã PIN.", "ok");
          });
        } })
      ]));
    }
  }

  /** Tạo tệp cập nhật gửi ngược cho cố vấn. */
  async function sendUpdate() {
    const m = me();
    if (!m) return;
    const built = CV.pack.buildUpdate(m.id);
    if (!built.ok) { ui.toast(built.error, "err", 6000); return; }
    let file;
    try { file = await CV.pack.encryptUpdate(built.data); }
    catch (e) { file = built.data; }
    CV.io.download(`cap-nhat-${m.mssv}.json`, JSON.stringify(file), "application/json;charset=utf-8");
    S.put("students", { id: m.id, updateSentAt: new Date().toISOString() });
    ui.modal({
      title: "Đã tạo phiếu cập nhật",
      body: [
        ui.note("Gửi tệp vừa tải về cho giảng viên cố vấn qua Zalo hoặc email. " +
          "Cố vấn mở tệp là thông tin của em được cập nhật bên máy thầy cô.", "info"),
        el("h3", { text: "Trong phiếu có gì", style: "margin-top:.8rem" }),
        el("ul", { style: "margin:0;padding-left:1.1rem;font-size:.88rem" },
          CV.pack.STUDENT_FIELDS.map((f) => el("li", { text: `${f.label}: ${built.data.fields[f.key] || "(trống)"}` }))
            .concat(built.data.appointments.length
              ? [el("li", { text: `${built.data.appointments.length} lịch hẹn em đã đặt` })] : []))
      ],
      actions: [{ label: "Xong", class: "btn-primary", onClick: (c) => { c(); CV.app.render(); } }]
    });
  }

  const routes = {
    "student/home":         { title: "Trang của em", icon: "home", nav: "Tổng quan", render: home },
    "student/scores":       { title: "Bảng điểm", icon: "score", nav: "Bảng điểm", render: scores },
    "student/appointments": { title: "Lịch tư vấn", icon: "cal", nav: "Lịch hẹn", render: appointments },
    "student/profile":      { title: "Hồ sơ của em", icon: "user", nav: "Hồ sơ", render: profile }
  };

  return { routes, forceChangePin, me };
})();
