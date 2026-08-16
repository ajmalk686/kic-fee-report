// The Google Sheet is read-only from this app (no Google auth/backend), so a
// missing mobile number can't be written back to the sheet itself. Instead,
// numbers added here are kept in this browser's localStorage, keyed by
// admission number, and merged on top of the sheet's data every time it
// loads. This only persists on the device/browser where it was added - for a
// permanent fix, also add the number in the Google Sheet.

const MOBILE_OVERRIDES_KEY = 'feeReport.mobileOverrides.v1';

function loadMobileOverrides() {
  try {
    return JSON.parse(localStorage.getItem(MOBILE_OVERRIDES_KEY) || '{}');
  } catch (err) {
    return {};
  }
}

function saveMobileOverrides(overrides) {
  localStorage.setItem(MOBILE_OVERRIDES_KEY, JSON.stringify(overrides));
}

function addMobileOverride(adNo, mobile) {
  const overrides = loadMobileOverrides();
  const clean = String(mobile).replace(/\D/g, '');
  if (!clean) return;
  const list = overrides[adNo] || [];
  if (!list.includes(clean)) list.push(clean);
  overrides[adNo] = list;
  saveMobileOverrides(overrides);
}

function removeMobileOverride(adNo, mobile) {
  const overrides = loadMobileOverrides();
  overrides[adNo] = (overrides[adNo] || []).filter((m) => m !== mobile);
  saveMobileOverrides(overrides);
}

function applyMobileOverrides(students) {
  const overrides = loadMobileOverrides();
  return students.map((s) => {
    const localMobiles = overrides[s.adNo] || [];
    const mobiles = [...s.mobiles];
    localMobiles.forEach((m) => { if (!mobiles.includes(m)) mobiles.push(m); });
    return { ...s, sheetMobiles: s.mobiles, mobiles, localMobiles };
  });
}
