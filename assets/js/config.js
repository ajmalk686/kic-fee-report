// All the tunables for this app live here. Edit this file to point the app
// at a different spreadsheet/tab/year, change the WhatsApp message, etc.
const CONFIG = {
  SPREADSHEET_ID: '1-o5eCckC9PfUqTcFIvHTRa0t9IfetYHdZW0z03p78mg',

  // One entry per worksheet tab to read and merge into a single report.
  // To add a new tab (e.g. another batch of students in the same column
  // layout): open that tab in Google Sheets, copy the number after "gid="
  // in the browser's address bar, and add a row below with a short label.
  // Every tab must use the exact same column layout described in COLS /
  // ACADEMIC_MONTHS below, and admission numbers (Ad no) must be unique
  // across all tabs.
  SHEET_TABS: [
    { gid: '1622171635', label: 'Main' },
  ],

  SCHOOL_NAME: 'Kerala Islamic Centre - AL Wakra',
  CURRENCY: 'QR',
  COUNTRY_CODE: '974', // Qatar - prepended to the 8-digit mobile numbers for WhatsApp links
  QUERY_CONTACT: '71271342',

  // Shown at the end of every reminder message.
  ONLINE_PAYMENT_NOTE:
    'For Online Payments:\n' +
    'Fawran : QIB (IBAN)\n' +
    'QA33QISB000000000150594410013\n' +
    '(Corporate)\n' +
    'Ben.Name: AL NABET GLOBAL EDUCATION CENTER\n\n' +
    "If the fee is paid, please send a screenshot to this mobile number. It's for issuing the receipt.\n" +
    'For queries, contact 71271342.',

  // Column layout of the sheet (0-indexed against each row's cell array).
  COLS: {
    SL: 0,
    AD_NO: 1,
    NAME: 2,
    MOBILE: 3,
    CLASS: 4,
    M_FEE: 5,
    DUE: 6,
    OB_AD_PAID: 7,
    EXAM_DATE: 28,
    EXAM_AMOUNT: 29,
    TOTAL: 30,
    NOTES: 31,
  },

  // One date+amount column pair per academic month, in sheet order, with the
  // real calendar date each month "starts" (used to decide whether a month's
  // fee is due yet). April 2026 - March 2027, skipping the Jul/Aug break.
  ACADEMIC_MONTHS: [
    { key: 'april', label: 'April',    dateCol: 8,  feeCol: 9,  dueDate: new Date(2026, 3, 1) },
    { key: 'may',   label: 'May',      dateCol: 10, feeCol: 11, dueDate: new Date(2026, 4, 1) },
    { key: 'june',  label: 'June',     dateCol: 12, feeCol: 13, dueDate: new Date(2026, 5, 1) },
    { key: 'sep',   label: 'Sep',      dateCol: 14, feeCol: 15, dueDate: new Date(2026, 8, 1) },
    { key: 'oct',   label: 'Oct',      dateCol: 16, feeCol: 17, dueDate: new Date(2026, 9, 1) },
    { key: 'nov',   label: 'Nov',      dateCol: 18, feeCol: 19, dueDate: new Date(2026, 10, 1) },
    { key: 'dec',   label: 'Dec',      dateCol: 20, feeCol: 21, dueDate: new Date(2026, 11, 1) },
    { key: 'jan',   label: 'Jan',      dateCol: 22, feeCol: 23, dueDate: new Date(2027, 0, 1) },
    { key: 'feb',   label: 'Feb',      dateCol: 24, feeCol: 25, dueDate: new Date(2027, 1, 1) },
    { key: 'march', label: 'March',    dateCol: 26, feeCol: 27, dueDate: new Date(2027, 2, 1) },
  ],

  // Known grade tokens in academic order, used to sort/group the (inconsistently
  // spaced) Class column. The longest matching prefix of a normalized class
  // string is used as its sort key.
  CLASS_ORDER: [
    'I', 'IA', 'IB', 'IC', 'IIA', 'IIB', 'IIC', 'II', 'IIIA', 'IIIB', 'III',
    'IVA', 'IVB', 'IV', 'VA', 'VB', 'V', 'VIA', 'VIB', 'VI', 'VIIA', 'VIIB', 'VII',
    'VIIIA', 'VIIIB', 'VIII', 'IXA', 'IXB', 'IX', 'XA', 'XB', 'X', 'XI', 'XII',
  ],

  // WhatsApp reminder message. Receives the student record, their total
  // pending amount (legacy DUE + unpaid months so far), and the list of
  // this-academic-year month labels that are still unpaid.
  buildReminderMessage(student, pendingAmount, unpaidMonthLabels) {
    const lines = [
      'Assalamu Alaikum Wa Rahmathullah,',
      '',
      `Dear Parent, this is a reminder from ${CONFIG.SCHOOL_NAME} that the school fee for *${student.name}* (Class: ${student.class}) has a pending balance of *${CONFIG.CURRENCY} ${pendingAmount.toLocaleString()}*.`,
    ];

    if (unpaidMonthLabels && unpaidMonthLabels.length) {
      lines.push(`Pending months (this year): ${unpaidMonthLabels.join(', ')}`);
    }
    if (student.legacyDue > 0) {
      lines.push(`Includes previous session due: ${CONFIG.CURRENCY} ${student.legacyDue.toLocaleString()}`);
    }

    lines.push(
      '',
      'Kindly clear the dues at your earliest convenience.',
      '',
      CONFIG.ONLINE_PAYMENT_NOTE,
      '',
      `- ${CONFIG.SCHOOL_NAME}`
    );

    return lines.join('\n');
  },
};
