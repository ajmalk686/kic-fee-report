// Two modals: editing a student's mobile numbers, and a "reminder queue"
// (all pending students, or one class's pending students) for the bulk/
// class-wise reminder buttons. WhatsApp has no bulk-send API, so the queue
// is a checklist the admin clicks through one Remind button at a time.

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach((el) => el.classList.add('hidden'));
}

function openMobileModal(adNo) {
  const student = AppState.students.find((s) => s.adNo === adNo);
  if (!student) return;

  document.getElementById('mobileModalTitle').textContent = `${student.name} — Mobile numbers`;

  const sheetNumbers = student.sheetMobiles || student.mobiles;
  const sheetHtml = sheetNumbers.length
    ? sheetNumbers.map((m) => `<span class="mobile-chip">+${CONFIG.COUNTRY_CODE} ${esc(m)}</span>`).join('')
    : '<span class="student-meta">No number in the sheet.</span>';
  document.getElementById('mobileModalSheetNumbers').innerHTML = `
    <div class="student-meta" style="margin-bottom:6px">From the Google Sheet</div>
    <div class="mobile-chip-row">${sheetHtml}</div>
  `;

  const localNumbers = student.localMobiles || [];
  const localHtml = localNumbers.length
    ? localNumbers.map((m) => `
        <span class="mobile-chip mobile-chip--local">+${CONFIG.COUNTRY_CODE} ${esc(m)}
          <button type="button" class="mobile-chip__remove" data-ad-no="${esc(adNo)}" data-mobile="${esc(m)}" title="Remove">&times;</button>
        </span>
      `).join('')
    : '<span class="student-meta">None added yet.</span>';
  document.getElementById('mobileModalLocalNumbers').innerHTML = `
    <div class="student-meta" style="margin:12px 0 6px">Added on this device</div>
    <div class="mobile-chip-row">${localHtml}</div>
  `;

  const form = document.getElementById('mobileAddForm');
  form.dataset.adNo = adNo;
  document.getElementById('mobileAddInput').value = '';
  document.getElementById('mobileModalOverlay').classList.remove('hidden');
  document.getElementById('mobileAddInput').focus();
}

function reminderRowHtml(student) {
  return `
    <tr>
      <td>
        <div class="student-name">${esc(student.name)}</div>
        <div class="student-meta">${esc(student.class)} &middot; ${esc(mobilesLabel(student))}</div>
      </td>
      <td class="num">${esc(formatCurrency(student.pendingAmount))}</td>
      <td>${renderWhatsAppButtons(student)}</td>
    </tr>
  `;
}

function openReminderQueue(title, students) {
  document.getElementById('reminderModalTitle').textContent = `${title} (${students.length})`;
  const rows = students.length
    ? students.map(reminderRowHtml).join('')
    : emptyRowHtml(3, 'No pending students in this scope.');
  document.getElementById('reminderQueueTable').innerHTML = `
    <thead><tr><th>Student</th><th>Pending</th><th>Reminder</th></tr></thead>
    <tbody>${rows}</tbody>
  `;
  document.getElementById('reminderModalOverlay').classList.remove('hidden');
}

function getPendingStudents(classId) {
  return AppState.students
    .filter((s) => (classId ? s.class === classId : true) && s.pendingAmount > 0)
    .sort((a, b) => b.pendingAmount - a.pendingAmount);
}

function openReminderQueueAll() {
  AppState.activeReminderScope = { type: 'all' };
  openReminderQueue('Remind All Pending Students', getPendingStudents());
}

function openReminderQueueForClass(classId) {
  AppState.activeReminderScope = { type: 'class', classId };
  openReminderQueue(`Remind Class ${classId}`, getPendingStudents(classId));
}

// Called after the underlying data changes (e.g. a mobile number was added)
// so an already-open reminder queue reflects it instead of going stale.
function refreshOpenReminderQueue() {
  const overlay = document.getElementById('reminderModalOverlay');
  if (overlay.classList.contains('hidden') || !AppState.activeReminderScope) return;
  if (AppState.activeReminderScope.type === 'class') {
    openReminderQueueForClass(AppState.activeReminderScope.classId);
  } else {
    openReminderQueueAll();
  }
}

function wireModalDismissals() {
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
  });
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => btn.closest('.modal-overlay').classList.add('hidden'));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
  });
}
