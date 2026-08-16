// Fetches the Google Sheet's data live via the gviz/tq JSON endpoint using a
// JSONP <script> tag. This deliberately avoids fetch()/XHR: a plain static
// page (even one opened straight from disk, no server) can load a <script>
// from any origin, so this works with zero backend and no API key as long as
// the sheet is shared as "Anyone with the link can view".
let jsonpCounter = 0;

function fetchSheetTableForGid(gid) {
  return new Promise((resolve, reject) => {
    const callbackName = `__gvizCallback_${Date.now()}_${jsonpCounter++}`;
    const script = document.createElement('script');

    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };

    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out contacting Google Sheets. Check your internet connection.'));
    }, 20000);

    window[callbackName] = (response) => {
      clearTimeout(timeoutId);
      cleanup();
      if (!response || response.status === 'error') {
        const detail = response && response.errors && response.errors[0] && response.errors[0].detailed_message;
        reject(new Error(detail || 'Google Sheets returned an error. Confirm the sheet is shared as "Anyone with the link can view".'));
        return;
      }
      resolve(response.table);
    };

    script.onerror = () => {
      clearTimeout(timeoutId);
      cleanup();
      reject(new Error('Could not reach Google Sheets. Check your internet connection.'));
    };

    const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/gviz/tq`
      + `?gid=${encodeURIComponent(gid)}`
      + `&tqx=out:json;responseHandler:${callbackName}`
      + `&_=${Date.now()}`; // cache-bust so Refresh always gets the latest edit

    script.src = url;
    document.head.appendChild(script);
  });
}

// Fetches every tab listed in CONFIG.SHEET_TABS in parallel. A single failed
// tab (typo'd gid, tab deleted, etc.) doesn't take down the whole refresh -
// whatever tabs did load are still returned, alongside which ones failed.
async function fetchAllSheetTables() {
  const settled = await Promise.allSettled(
    CONFIG.SHEET_TABS.map((tab) => fetchSheetTableForGid(tab.gid))
  );

  const tables = [];
  const failures = [];
  settled.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      tables.push(result.value);
    } else {
      failures.push({ label: CONFIG.SHEET_TABS[i].label, error: result.reason });
    }
  });

  if (tables.length === 0) {
    const detail = failures.map((f) => `${f.label}: ${f.error.message}`).join(' | ');
    throw new Error(`Could not load any sheet tab. ${detail}`);
  }

  return { tables, failures };
}
