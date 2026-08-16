// Derived data shared by every view: pending balances, class/month rollups,
// and weekly payment activity. `today` is threaded through explicitly so a
// single "now" is used consistently across one render pass.

function currentYearPending(student, today) {
  return student.months.reduce((sum, month) => {
    if (month.dueDate > today) return sum; // fee not due yet this academic year
    if (month.isPaid) return sum;
    return sum + student.mFee;
  }, 0);
}

function studentPendingAmount(student, today) {
  return student.legacyDue + currentYearPending(student, today);
}

function getUnpaidMonthLabels(student, today) {
  return student.months
    .filter((month) => month.dueDate <= today && !month.isPaid)
    .map((month) => month.label);
}

function enrichStudents(students, today) {
  return students.map((s) => ({
    ...s,
    currentYearPending: currentYearPending(s, today),
    pendingAmount: studentPendingAmount(s, today),
  }));
}

function computeClassRollups(students) {
  const byClass = new Map();
  students.forEach((s) => {
    const key = s.class || 'UNASSIGNED';
    if (!byClass.has(key)) {
      byClass.set(key, { class: key, sortKey: s.classSortKey, students: [], count: 0, totalCollected: 0, totalPending: 0 });
    }
    const bucket = byClass.get(key);
    bucket.students.push(s);
    bucket.count += 1;
    bucket.totalCollected += s.total;
    bucket.totalPending += s.pendingAmount;
  });

  return [...byClass.values()]
    .map((bucket) => ({
      ...bucket,
      collectionRate: bucket.totalCollected + bucket.totalPending > 0
        ? bucket.totalCollected / (bucket.totalCollected + bucket.totalPending)
        : 1,
    }))
    .sort((a, b) => a.sortKey - b.sortKey || a.class.localeCompare(b.class));
}

function computeMonthRollups(students, today) {
  return CONFIG.ACADEMIC_MONTHS.map((monthDef) => {
    const isFuture = monthDef.dueDate > today;
    let paidCount = 0;
    let leaveCount = 0;
    let pendingCount = 0;
    let collected = 0;
    let pendingAmount = 0;

    students.forEach((s) => {
      const month = s.months.find((m) => m.key === monthDef.key);
      if (!month) return;
      collected += month.amount;
      if (month.isLeave) {
        leaveCount += 1;
      } else if (month.isPaid) {
        paidCount += 1;
      } else if (!isFuture) {
        pendingCount += 1;
        pendingAmount += s.mFee;
      }
    });

    return {
      key: monthDef.key,
      label: monthDef.label,
      dueDate: monthDef.dueDate,
      isFuture,
      paidCount,
      leaveCount,
      pendingCount,
      collected,
      pendingAmount,
      totalStudents: students.length,
    };
  });
}

function getWeekRange(referenceDate) {
  const d = new Date(referenceDate);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 7); // exclusive upper bound
  return { start, end };
}

function shiftWeek(range, deltaWeeks) {
  const start = new Date(range.start);
  start.setDate(start.getDate() + deltaWeeks * 7);
  const end = new Date(range.end);
  end.setDate(end.getDate() + deltaWeeks * 7);
  return { start, end };
}

function getPaymentsInRange(students, range) {
  const payments = [];
  students.forEach((s) => {
    s.months.forEach((month) => {
      if (month.paidDate && month.paidDate >= range.start && month.paidDate < range.end && month.amount > 0) {
        payments.push({
          student: s,
          monthLabel: month.label,
          amount: month.amount,
          paidDate: month.paidDate,
        });
      }
    });
  });
  return payments.sort((a, b) => a.paidDate - b.paidDate);
}

function computeDashboardTotals(students) {
  const totalStudents = students.length;
  const totalCollected = students.reduce((sum, s) => sum + s.total, 0);
  const totalPending = students.reduce((sum, s) => sum + s.pendingAmount, 0);
  const pendingStudents = students.filter((s) => s.pendingAmount > 0).length;
  const collectionRate = totalCollected + totalPending > 0 ? totalCollected / (totalCollected + totalPending) : 1;
  return { totalStudents, totalCollected, totalPending, pendingStudents, collectionRate };
}

function getRecentPayments(students, limit) {
  const all = [];
  students.forEach((s) => {
    s.months.forEach((month) => {
      if (month.paidDate && month.amount > 0) {
        all.push({ student: s, monthLabel: month.label, amount: month.amount, paidDate: month.paidDate });
      }
    });
  });
  return all.sort((a, b) => b.paidDate - a.paidDate).slice(0, limit);
}

/* ---------- formatting helpers ---------- */

function formatCurrency(amount) {
  return `${CONFIG.CURRENCY} ${Math.round(amount).toLocaleString()}`;
}

function formatDate(date) {
  if (!date) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateRange(range) {
  const lastDay = new Date(range.end);
  lastDay.setDate(lastDay.getDate() - 1);
  const startStr = range.start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  const endStr = lastDay.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${startStr} – ${endStr}`;
}
