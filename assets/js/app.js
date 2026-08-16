// Bootstraps the app: fetch -> parse -> compute -> render, and wires up all
// the interactive controls (tabs, filters, week navigation, refresh button).

const AppState = {
  rawStudents: [],
  students: [],
  classRollups: [],
  monthRollups: [],
  today: new Date(),
  currentTab: 'dashboard',
  week: getWeekRange(new Date()),
  activeReminderScope: null,
  filters: {
    classwise: { classId: 'all', search: '', status: 'all' },
    monthwise: { monthKey: CONFIG.ACADEMIC_MONTHS[0].key, status: 'pending', classId: 'all' },
    students: { search: '', classId: 'all', status: 'all' },
  },
};

function setStatus(mode, text) {
  const pill = document.getElementById('statusPill');
  pill.className = `status-pill status-pill--${mode}`;
  pill.textContent = text;
}

function showError(message) {
  const banner = document.getElementById('errorBanner');
  if (!message) {
    banner.classList.add('hidden');
    banner.textContent = '';
    return;
  }
  banner.textContent = message;
  banner.classList.remove('hidden');
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.remove('is-visible');
    setTimeout(() => toast.classList.add('hidden'), 250);
  }, 2500);
}

// Re-derives students/classRollups/monthRollups from AppState.rawStudents +
// whatever's currently in the mobile-number overrides, then re-renders.
// Cheap enough to call on every override change without re-fetching the sheet.
function recomputeDerivedState() {
  AppState.students = enrichStudents(applyMobileOverrides(AppState.rawStudents), AppState.today);
  AppState.classRollups = computeClassRollups(AppState.students);
  AppState.monthRollups = computeMonthRollups(AppState.students, AppState.today);
  renderAll();
  refreshOpenReminderQueue();
}

async function loadData(isManualRefresh) {
  const refreshBtn = document.getElementById('refreshBtn');
  refreshBtn.disabled = true;
  refreshBtn.classList.add('is-spinning');
  setStatus('loading', 'Loading…');
  showError(null);

  try {
    const { tables, failures } = await fetchAllSheetTables();
    AppState.rawStudents = tables.flatMap(parseSheetTable);
    AppState.today = new Date();
    recomputeDerivedState();

    setStatus('live', 'Live');
    document.getElementById('lastRefreshed').textContent = `Last refreshed at ${AppState.today.toLocaleTimeString()}`;

    const warnings = [];
    if (failures.length) {
      warnings.push(`Couldn't load tab(s): ${failures.map((f) => f.label).join(', ')}. Other tabs loaded fine.`);
    }
    const dupes = findDuplicateAdNos(AppState.rawStudents);
    if (dupes.length) {
      warnings.push(`Duplicate admission number(s) found - please fix in the sheet, otherwise reminders/edits for these students may target the wrong row: ${dupes.join(', ')}.`);
    }
    showError(warnings.length ? warnings.join(' ') : null);

    if (isManualRefresh) showToast('Report refreshed from Google Sheets');
  } catch (err) {
    console.error(err);
    setStatus('error', 'Error');
    showError(err.message || 'Something went wrong while loading the sheet.');
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.classList.remove('is-spinning');
  }
}

function switchTab(tabId) {
  AppState.currentTab = tabId;
  document.querySelectorAll('.tab-nav__item').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('is-active', panel.id === `tab-${tabId}`);
  });
  renderActiveTab();
}

function wireTabs() {
  document.getElementById('tabNav').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-nav__item');
    if (btn) switchTab(btn.dataset.tab);
  });
}

function wireRefreshButton() {
  document.getElementById('refreshBtn').addEventListener('click', () => loadData(true));
}

function wireClassWiseControls() {
  document.getElementById('classSelect').addEventListener('change', (e) => {
    AppState.filters.classwise.classId = e.target.value;
    renderClassWise();
  });
  document.getElementById('classSearch').addEventListener('input', (e) => {
    AppState.filters.classwise.search = e.target.value;
    renderClassWise();
  });
  document.getElementById('classStatusFilter').addEventListener('change', (e) => {
    AppState.filters.classwise.status = e.target.value;
    renderClassWise();
  });
}

function wireMonthWiseControls() {
  document.getElementById('monthSelect').addEventListener('change', (e) => {
    AppState.filters.monthwise.monthKey = e.target.value;
    renderMonthWise();
  });
  document.getElementById('monthStatusFilter').addEventListener('change', (e) => {
    AppState.filters.monthwise.status = e.target.value;
    renderMonthWise();
  });
  document.getElementById('monthClassFilter').addEventListener('change', (e) => {
    AppState.filters.monthwise.classId = e.target.value;
    renderMonthWise();
  });
}

function wireWeeklyControls() {
  document.getElementById('weekPrevBtn').addEventListener('click', () => {
    AppState.week = shiftWeek(AppState.week, -1);
    renderWeekly();
  });
  document.getElementById('weekNextBtn').addEventListener('click', () => {
    AppState.week = shiftWeek(AppState.week, 1);
    renderWeekly();
  });
  document.getElementById('weekTodayBtn').addEventListener('click', () => {
    AppState.week = getWeekRange(new Date());
    renderWeekly();
  });
}

function wireAllStudentsControls() {
  document.getElementById('studentSearch').addEventListener('input', (e) => {
    AppState.filters.students.search = e.target.value;
    renderAllStudents();
  });
  document.getElementById('studentClassFilter').addEventListener('change', (e) => {
    AppState.filters.students.classId = e.target.value;
    renderAllStudents();
  });
  document.getElementById('studentStatusFilter').addEventListener('change', (e) => {
    AppState.filters.students.status = e.target.value;
    renderAllStudents();
  });
}

function wireRemindAllButton() {
  document.getElementById('remindAllBtn').addEventListener('click', openReminderQueueAll);
}

// Delegated (rows are re-rendered constantly, so listeners can't be attached
// to individual buttons): the mobile-edit pencil, the mobile-chip remove (x),
// and the class-wise/all "Remind" buttons.
function wireDelegatedClicks() {
  document.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-mobile-btn');
    if (editBtn) {
      openMobileModal(editBtn.dataset.adNo);
      return;
    }
    const removeBtn = e.target.closest('.mobile-chip__remove');
    if (removeBtn) {
      removeMobileOverride(removeBtn.dataset.adNo, removeBtn.dataset.mobile);
      recomputeDerivedState();
      openMobileModal(removeBtn.dataset.adNo);
      return;
    }
    const remindBtn = e.target.closest('[data-remind-class]');
    if (remindBtn) {
      const classId = remindBtn.dataset.remindClass;
      if (classId === 'all') openReminderQueueAll();
      else openReminderQueueForClass(classId);
    }
  });
}

function wireMobileAddForm() {
  document.getElementById('mobileAddForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const adNo = e.target.dataset.adNo;
    const input = document.getElementById('mobileAddInput');
    const value = input.value.trim();
    if (!value) return;
    addMobileOverride(adNo, value);
    recomputeDerivedState();
    openMobileModal(adNo);
  });
}

function init() {
  document.getElementById('schoolNameLabel').textContent = CONFIG.SCHOOL_NAME;
  wireTabs();
  wireRefreshButton();
  wireRemindAllButton();
  wireClassWiseControls();
  wireMonthWiseControls();
  wireWeeklyControls();
  wireAllStudentsControls();
  wireDelegatedClicks();
  wireMobileAddForm();
  wireModalDismissals();
  loadData(false);
}

document.addEventListener('DOMContentLoaded', init);
