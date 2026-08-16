// Builds click-to-chat WhatsApp links (wa.me) for pending-fee reminders.
// These only prefill a message in WhatsApp - the parent's device/WhatsApp Web
// still requires a manual tap to actually send it, since wa.me has no
// programmatic "send" API.

function buildWhatsAppUrl(mobile, message) {
  return `https://wa.me/${CONFIG.COUNTRY_CODE}${mobile}?text=${encodeURIComponent(message)}`;
}

function editMobileButtonHtml(adNo) {
  return `<button type="button" class="btn-icon edit-mobile-btn" data-ad-no="${adNo}" title="Add or edit mobile numbers">&#9998;</button>`;
}

function renderWhatsAppButtons(student) {
  const editBtn = editMobileButtonHtml(student.adNo);

  if (student.pendingAmount <= 0) {
    return `<div class="wa-cell"><span class="badge badge--success">No dues</span>${editBtn}</div>`;
  }
  if (!student.mobiles.length) {
    return `<div class="wa-cell"><span class="badge badge--muted">No mobile</span>${editBtn}</div>`;
  }

  const unpaidMonths = getUnpaidMonthLabels(student, AppState.today);
  const message = CONFIG.buildReminderMessage(student, student.pendingAmount, unpaidMonths);
  const links = student.mobiles.map((mobile, index) => {
    const url = buildWhatsAppUrl(mobile, message);
    const label = student.mobiles.length > 1 ? `Remind ${index + 1}` : 'Remind';
    return `<a class="btn btn--whatsapp" href="${url}" target="_blank" rel="noopener noreferrer" title="Send WhatsApp reminder to +${CONFIG.COUNTRY_CODE}${mobile}">${label}</a>`;
  });
  return `<div class="wa-cell">${links.join('')}${editBtn}</div>`;
}
