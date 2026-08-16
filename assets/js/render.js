// Pure(ish) rendering functions. Every render* function reads from the
// global AppState (defined in app.js) and rewrites one part of the DOM.

function esc(value) {
  return escapeXml(value == null ? '' : value);
}

function mobilesLabel(student) {
  if (!student.mobiles.length) return 'No mobile on file';
  return student.mobiles.map((m) => `+${CONFIG.COUNTRY_CODE} ${m}`).join(', ');
}

function pendingCellHtml(student) {
  return student.pendingAmount > 0
    ? `<span class="amount-pending">${esc(formatCurrency(student.pendingAmount))}</span>`
    : `<span class="amount-paid">Fully paid</span>`;
}

function studentRowHtml(student, opts) {
  const showClass = !opts || opts.showClass !== false;
  return `
    <tr>
      <td>${esc(student.adNo)}</td>
      <td>
        <div class="student-name">${esc(student.name)}</div>
        <div class="student-meta">${esc(mobilesLabel(student))}</div>
      </td>
      ${showClass ? `<td><span class="class-pill">${esc(student.class)}</span></td>` : ''}
      <td class="num">${esc(formatCurrency(student.total))}</td>
      <td class="num">${pendingCellHtml(student)}</td>
      <td>${renderWhatsAppButtons(student)}</td>
    </tr>
  `;
}

function emptyRowHtml(colSpan, message) {
  return `<tr class="empty-row"><td colspan="${colSpan}">${esc(message)}</td></tr>`;
}

function fillClassOptions(selectEl, classRollups, includeAll) {
  const previous = selectEl.value;
  const options = [];
  if (includeAll) options.push('<option value="all">All classes</option>');
  classRollups.forEach((c) => options.push(`<option value="${esc(c.class)}">${esc(c.class)} (${c.count})</option>`));
  selectEl.innerHTML = options.join('');
  if ([...selectEl.options].some((o) => o.value === previous)) selectEl.value = previous;
}

/* ---------- Dashboard ---------- */

function renderDashboard() {
  const totals = computeDashboardTotals(AppState.students);

  document.getElementById('kpiGrid').innerHTML = `
    <div class="kpi-card">
      <div class="kpi-card__label">Total Students</div>
      <div class="kpi-card__value">${totals.totalStudents}</div>
      <div class="kpi-card__sub">${totals.pendingStudents} with pending dues</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-card__label">Total Collected</div>
      <div class="kpi-card__value is-success">${esc(formatCurrency(totals.totalCollected))}</div>
      <div class="kpi-card__sub">Since April 2026</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-card__label">Total Pending</div>
      <div class="kpi-card__value is-danger">${esc(formatCurrency(totals.totalPending))}</div>
      <div class="kpi-card__sub">Legacy dues + unpaid months so far</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-card__label">Collection Rate</div>
      <div class="kpi-card__value">${Math.round(totals.collectionRate * 100)}%</div>
      <div class="kpi-card__sub">Collected vs. total owed</div>
    </div>
  `;

  renderVerticalBarChart(
    document.getElementById('monthChart'),
    AppState.monthRollups.map((m) => ({ label: m.label, value: m.collected, isFuture: m.isFuture })),
    { colorVar: '--primary', valueFormatter: (v) => formatCurrency(v) }
  );

  const topPendingClasses = [...AppState.classRollups]
    .filter((c) => c.totalPending > 0)
    .sort((a, b) => b.totalPending - a.totalPending)
    .slice(0, 8)
    .map((c) => ({ label: c.class, value: c.totalPending }));

  renderHorizontalBarChart(
    document.getElementById('classChart'),
    topPendingClasses,
    { colorVar: '--danger', valueFormatter: (v) => formatCurrency(v) }
  );

  const recent = getRecentPayments(AppState.students, 15);
  const rows = recent.length
    ? recent.map((p) => `
        <tr>
          <td>${esc(formatDate(p.paidDate))}</td>
          <td>${esc(p.student.name)}</td>
          <td><span class="class-pill">${esc(p.student.class)}</span></td>
          <td>${esc(p.monthLabel)}</td>
          <td class="num">${esc(formatCurrency(p.amount))}</td>
        </tr>
      `).join('')
    : emptyRowHtml(5, 'No payments recorded yet');

  document.getElementById('recentPaymentsTable').innerHTML = `
    <thead><tr><th>Date</th><th>Student</th><th>Class</th><th>Month</th><th>Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  `;
}

/* ---------- Class-wise ---------- */

function getFilteredClassStudents() {
  const f = AppState.filters.classwise;
  const term = f.search.trim().toLowerCase();
  return AppState.students.filter((s) => {
    if (f.classId !== 'all' && s.class !== f.classId) return false;
    if (f.status === 'pending' && s.pendingAmount <= 0) return false;
    if (f.status === 'paid' && s.pendingAmount > 0) return false;
    if (term) {
      const haystack = `${s.name} ${s.adNo} ${s.mobiles.join(' ')}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  }).sort((a, b) => b.pendingAmount - a.pendingAmount);
}

function renderClassWise() {
  fillClassOptions(document.getElementById('classSelect'), AppState.classRollups, true);

  const f = AppState.filters.classwise;
  document.getElementById('classSelect').value = f.classId;
  document.getElementById('classSearch').value = f.search;
  document.getElementById('classStatusFilter').value = f.status;

  const rollup = f.classId === 'all' ? null : AppState.classRollups.find((c) => c.class === f.classId);
  const summarySource = rollup || {
    count: AppState.students.length,
    totalCollected: AppState.students.reduce((s, x) => s + x.total, 0),
    totalPending: AppState.students.reduce((s, x) => s + x.pendingAmount, 0),
    collectionRate: computeDashboardTotals(AppState.students).collectionRate,
  };

  const pendingCount = (rollup ? rollup.students : AppState.students).filter((s) => s.pendingAmount > 0).length;
  const remindLabel = f.classId === 'all' ? `Remind all pending (${pendingCount})` : `Remind class (${pendingCount})`;
  const remindScope = f.classId === 'all' ? 'all' : esc(f.classId);

  document.getElementById('classSummaryCard').innerHTML = `
    <div class="card__header-row">
      <h2 class="card__title">${f.classId === 'all' ? 'All Classes' : `Class ${esc(f.classId)}`} Summary</h2>
      <button type="button" class="btn btn--whatsapp" data-remind-class="${remindScope}" ${pendingCount === 0 ? 'disabled' : ''}>${remindLabel}</button>
    </div>
    <div class="kpi-grid kpi-grid--compact" style="margin-bottom:0">
      <div class="kpi-card"><div class="kpi-card__label">Students</div><div class="kpi-card__value">${summarySource.count}</div></div>
      <div class="kpi-card"><div class="kpi-card__label">Collected</div><div class="kpi-card__value is-success">${esc(formatCurrency(summarySource.totalCollected))}</div></div>
      <div class="kpi-card"><div class="kpi-card__label">Pending</div><div class="kpi-card__value is-danger">${esc(formatCurrency(summarySource.totalPending))}</div></div>
    </div>
  `;

  const students = getFilteredClassStudents();
  const rows = students.length
    ? students.map((s) => studentRowHtml(s, { showClass: f.classId === 'all' })).join('')
    : emptyRowHtml(6, 'No students match this filter');

  document.getElementById('classStudentsTable').innerHTML = `
    <thead><tr><th>Ad No</th><th>Student</th>${f.classId === 'all' ? '<th>Class</th>' : ''}<th>Collected</th><th>Pending</th><th>Reminder</th></tr></thead>
    <tbody>${rows}</tbody>
  `;
}

/* ---------- Month-wise ---------- */

function renderMonthWise() {
  const rows = AppState.monthRollups.map((m) => `
    <tr>
      <td>${esc(m.label)}${m.isFuture ? ' <span class="badge badge--muted">Upcoming</span>' : ''}</td>
      <td class="num">${m.paidCount}</td>
      <td class="num">${m.pendingCount}</td>
      <td class="num">${m.leaveCount}</td>
      <td class="num">${esc(formatCurrency(m.collected))}</td>
      <td class="num">${m.pendingAmount > 0 ? `<span class="amount-pending">${esc(formatCurrency(m.pendingAmount))}</span>` : '—'}</td>
    </tr>
  `).join('');

  document.getElementById('monthSummaryTable').innerHTML = `
    <thead><tr><th>Month</th><th>Paid</th><th>Pending</th><th>Leave</th><th>Collected</th><th>Pending Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  `;

  const monthSelect = document.getElementById('monthSelect');
  const f = AppState.filters.monthwise;
  if (!monthSelect.options.length) {
    monthSelect.innerHTML = CONFIG.ACADEMIC_MONTHS.map((m) => `<option value="${m.key}">${esc(m.label)}</option>`).join('');
  }
  monthSelect.value = f.monthKey;
  document.getElementById('monthStatusFilter').value = f.status;
  fillClassOptions(document.getElementById('monthClassFilter'), AppState.classRollups, true);
  document.getElementById('monthClassFilter').value = f.classId;

  const monthDef = AppState.monthRollups.find((m) => m.key === f.monthKey);
  const matches = AppState.students
    .map((s) => ({ student: s, month: s.months.find((m) => m.key === f.monthKey) }))
    .filter(({ student, month }) => {
      if (!month) return false;
      if (f.classId !== 'all' && student.class !== f.classId) return false;
      if (f.status === 'leave') return month.isLeave;
      if (f.status === 'paid') return !month.isLeave && month.isPaid;
      return !month.isLeave && !month.isPaid && !monthDef.isFuture; // pending
    })
    .sort((a, b) => a.student.name.localeCompare(b.student.name));

  const rows2 = matches.length
    ? matches.map(({ student, month }) => `
        <tr>
          <td>${esc(student.adNo)}</td>
          <td>
            <div class="student-name">${esc(student.name)}</div>
            <div class="student-meta">${esc(mobilesLabel(student))}</div>
          </td>
          <td><span class="class-pill">${esc(student.class)}</span></td>
          <td>${month.isLeave ? '<span class="badge badge--muted">Leave</span>' : month.isPaid ? `<span class="badge badge--success">Paid ${esc(formatDate(month.paidDate))}</span>` : '<span class="badge badge--danger">Pending</span>'}</td>
          <td class="num">${month.amount > 0 ? esc(formatCurrency(month.amount)) : '—'}</td>
          <td>${renderWhatsAppButtons(student)}</td>
        </tr>
      `).join('')
    : emptyRowHtml(6, monthDef && monthDef.isFuture ? 'This month has not started yet' : 'No students match this filter');

  document.getElementById('monthDetailTable').innerHTML = `
    <thead><tr><th>Ad No</th><th>Student</th><th>Class</th><th>Status</th><th>Amount</th><th>Reminder</th></tr></thead>
    <tbody>${rows2}</tbody>
  `;
}

/* ---------- Weekly ---------- */

function renderWeekly() {
  document.getElementById('weekRangeLabel').textContent = formatDateRange(AppState.week);

  const payments = getPaymentsInRange(AppState.students, AppState.week);
  const totalAmount = payments.reduce((s, p) => s + p.amount, 0);
  const distinctStudents = new Set(payments.map((p) => p.student.adNo)).size;

  document.getElementById('weekKpiGrid').innerHTML = `
    <div class="kpi-card"><div class="kpi-card__label">Payments Received</div><div class="kpi-card__value">${payments.length}</div></div>
    <div class="kpi-card"><div class="kpi-card__label">Amount Collected</div><div class="kpi-card__value is-success">${esc(formatCurrency(totalAmount))}</div></div>
    <div class="kpi-card"><div class="kpi-card__label">Students Paid</div><div class="kpi-card__value">${distinctStudents}</div></div>
  `;

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayTotals = dayLabels.map((label, i) => {
    const dayStart = new Date(AppState.week.start);
    dayStart.setDate(dayStart.getDate() + i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const amount = payments
      .filter((p) => p.paidDate >= dayStart && p.paidDate < dayEnd)
      .reduce((s, p) => s + p.amount, 0);
    return { label, value: amount };
  });
  renderVerticalBarChart(document.getElementById('weekChart'), dayTotals, { colorVar: '--primary', valueFormatter: (v) => formatCurrency(v), height: 200 });

  const rows = payments.length
    ? payments.slice().reverse().map((p) => `
        <tr>
          <td>${esc(formatDate(p.paidDate))}</td>
          <td>${esc(p.student.name)}</td>
          <td><span class="class-pill">${esc(p.student.class)}</span></td>
          <td>${esc(p.monthLabel)}</td>
          <td class="num">${esc(formatCurrency(p.amount))}</td>
        </tr>
      `).join('')
    : emptyRowHtml(5, 'No payments recorded in this week');

  document.getElementById('weekTable').innerHTML = `
    <thead><tr><th>Date</th><th>Student</th><th>Class</th><th>Month</th><th>Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  `;
}

/* ---------- All Students ---------- */

function getFilteredAllStudents() {
  const f = AppState.filters.students;
  const term = f.search.trim().toLowerCase();
  return AppState.students.filter((s) => {
    if (f.classId !== 'all' && s.class !== f.classId) return false;
    if (f.status === 'pending' && s.pendingAmount <= 0) return false;
    if (f.status === 'paid' && s.pendingAmount > 0) return false;
    if (term) {
      const haystack = `${s.name} ${s.adNo} ${s.class} ${s.mobiles.join(' ')}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  }).sort((a, b) => b.pendingAmount - a.pendingAmount || a.name.localeCompare(b.name));
}

function renderAllStudents() {
  fillClassOptions(document.getElementById('studentClassFilter'), AppState.classRollups, true);
  const f = AppState.filters.students;
  document.getElementById('studentSearch').value = f.search;
  document.getElementById('studentClassFilter').value = f.classId;
  document.getElementById('studentStatusFilter').value = f.status;

  const students = getFilteredAllStudents();
  const rows = students.length
    ? students.map((s) => studentRowHtml(s, { showClass: true })).join('')
    : emptyRowHtml(6, 'No students match this filter');

  document.getElementById('allStudentsTable').innerHTML = `
    <thead><tr><th>Ad No</th><th>Student</th><th>Class</th><th>Collected</th><th>Pending</th><th>Reminder</th></tr></thead>
    <tbody>${rows}</tbody>
  `;
}

/* ---------- Dispatcher ---------- */

const TAB_RENDERERS = {
  dashboard: renderDashboard,
  classwise: renderClassWise,
  monthwise: renderMonthWise,
  weekly: renderWeekly,
  students: renderAllStudents,
};

function renderActiveTab() {
  const renderer = TAB_RENDERERS[AppState.currentTab];
  if (renderer) renderer();
}

function renderAll() {
  Object.values(TAB_RENDERERS).forEach((renderer) => renderer());
}
