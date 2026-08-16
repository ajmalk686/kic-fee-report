// Turns the raw gviz table into a clean array of student records.

function getCellText(cell) {
  if (!cell) return '';
  if (cell.f !== undefined && cell.f !== null) return String(cell.f);
  if (cell.v !== undefined && cell.v !== null) return String(cell.v);
  return '';
}

function getCellNumber(cell) {
  if (!cell) return 0;
  if (typeof cell.v === 'number') return cell.v;
  const text = getCellText(cell).replace(/[^0-9.-]/g, '');
  const n = parseFloat(text);
  return Number.isFinite(n) ? n : 0;
}

function extractMobiles(rawText) {
  if (!rawText) return [];
  return rawText
    .split(/[\n,/]/)
    .map((s) => s.replace(/\D/g, ''))
    .filter((s) => s.length >= 7);
}

function normalizeClass(rawText) {
  return (rawText || '').trim().replace(/\s+/g, '').toUpperCase();
}

const SORTED_CLASS_ORDER = [...CONFIG.CLASS_ORDER].sort((a, b) => b.length - a.length);

function classSortKey(normalizedClass) {
  const index = SORTED_CLASS_ORDER.findIndex((token) => normalizedClass.startsWith(token));
  return index === -1 ? CONFIG.CLASS_ORDER.length : CONFIG.CLASS_ORDER.indexOf(SORTED_CLASS_ORDER[index]);
}

function parseGvizDate(raw) {
  if (typeof raw !== 'string') return null;
  const match = raw.match(/^Date\((\d+),(\d+),(\d+)/);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m), Number(d));
}

function parseMonthCell(dateCell, feeCell, monthDef) {
  const amount = getCellNumber(feeCell);
  const rawValue = dateCell ? dateCell.v : undefined;
  const displayText = getCellText(dateCell).trim();

  const paidDate = parseGvizDate(rawValue);
  const isLeave = !paidDate && /^leave$/i.test(displayText);
  const isPaid = isLeave || paidDate !== null || amount > 0;

  return {
    key: monthDef.key,
    label: monthDef.label,
    dueDate: monthDef.dueDate,
    isLeave,
    paidDate,
    amount,
    isPaid,
    rawText: displayText,
  };
}

// When merging multiple tabs, the same admission number appearing twice
// would break per-student lookups (mobile overrides, the edit-number modal)
// since they key off adNo. Surfaced as a non-blocking warning, not silently
// deduped, since dropping a row could hide a real student.
function findDuplicateAdNos(students) {
  const seen = new Set();
  const dupes = new Set();
  students.forEach((s) => {
    if (seen.has(s.adNo)) dupes.add(s.adNo);
    seen.add(s.adNo);
  });
  return [...dupes];
}

function parseSheetTable(table) {
  const cols = CONFIG.COLS;
  const students = [];

  (table.rows || []).forEach((row) => {
    const c = row.c || [];
    const slCell = c[cols.SL];
    const adNoText = getCellText(c[cols.AD_NO]).trim();

    // Skip blank rows and the bottom summary/formula block: real student rows
    // always have a numeric SL and a non-empty admission number.
    if (!slCell || typeof slCell.v !== 'number' || !adNoText) return;

    const name = getCellText(c[cols.NAME]).trim();
    if (!name) return;

    const mobileText = getCellText(c[cols.MOBILE]);
    const months = CONFIG.ACADEMIC_MONTHS.map((monthDef) =>
      parseMonthCell(c[monthDef.dateCol], c[monthDef.feeCol], monthDef)
    );

    const rawClass = getCellText(c[cols.CLASS]);
    const klass = normalizeClass(rawClass);

    students.push({
      sl: slCell.v,
      adNo: adNoText,
      name,
      mobiles: extractMobiles(mobileText),
      class: klass,
      classSortKey: classSortKey(klass),
      mFee: getCellNumber(c[cols.M_FEE]),
      legacyDue: getCellNumber(c[cols.DUE]),
      obAdPaid: getCellNumber(c[cols.OB_AD_PAID]),
      months,
      examAmount: getCellNumber(c[cols.EXAM_AMOUNT]),
      total: getCellNumber(c[cols.TOTAL]),
      notes: getCellText(c[cols.NOTES]).trim(),
    });
  });

  return students;
}
