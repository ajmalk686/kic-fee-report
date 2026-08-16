// Small dependency-free SVG bar charts. No chart library is used so the app
// stays 100% self-contained (works fully offline once loaded, no CDN risk).

function escapeXml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderVerticalBarChart(container, items, options) {
  const opts = Object.assign({ colorVar: '--primary', valueFormatter: (v) => String(v), height: 220 }, options);
  if (!items.length) {
    container.innerHTML = '<div class="chart-empty">No data yet</div>';
    return;
  }

  const width = 640;
  const height = opts.height;
  const paddingLeft = 8;
  const paddingBottom = 34;
  const paddingTop = 22;
  const plotHeight = height - paddingBottom - paddingTop;
  const maxValue = Math.max(1, ...items.map((i) => i.value));
  const barSlot = (width - paddingLeft) / items.length;
  const barWidth = Math.min(46, barSlot * 0.55);

  const bars = items.map((item, i) => {
    const barHeight = (item.value / maxValue) * plotHeight;
    const x = paddingLeft + i * barSlot + (barSlot - barWidth) / 2;
    const y = paddingTop + (plotHeight - barHeight);
    return `
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${Math.max(0, barHeight).toFixed(1)}"
            rx="4" style="fill:var(${opts.colorVar})" opacity="${item.isFuture ? 0.35 : 1}">
        <title>${escapeXml(item.label)}: ${escapeXml(opts.valueFormatter(item.value))}</title>
      </rect>
      <text x="${(x + barWidth / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" class="chart-value-label">${escapeXml(opts.valueFormatter(item.value))}</text>
      <text x="${(x + barWidth / 2).toFixed(1)}" y="${height - paddingBottom + 16}" text-anchor="middle" class="chart-bar-label">${escapeXml(item.label)}</text>
    `;
  }).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMinYMin meet" role="img">
      <line x1="${paddingLeft}" y1="${height - paddingBottom}" x2="${width}" y2="${height - paddingBottom}" class="chart-axis" />
      ${bars}
    </svg>
  `;
}

function renderHorizontalBarChart(container, items, options) {
  const opts = Object.assign({ colorVar: '--danger', valueFormatter: (v) => String(v), rowHeight: 28 }, options);
  if (!items.length) {
    container.innerHTML = '<div class="chart-empty">No data yet</div>';
    return;
  }

  const width = 640;
  const labelWidth = 110;
  const rowHeight = opts.rowHeight;
  const height = items.length * rowHeight + 10;
  const plotWidth = width - labelWidth - 70;
  const maxValue = Math.max(1, ...items.map((i) => i.value));

  const rows = items.map((item, i) => {
    const y = i * rowHeight + 6;
    const barWidth = Math.max(2, (item.value / maxValue) * plotWidth);
    return `
      <text x="${labelWidth - 10}" y="${y + rowHeight / 2 + 4}" text-anchor="end" class="chart-bar-label">${escapeXml(item.label)}</text>
      <rect x="${labelWidth}" y="${y}" width="${barWidth.toFixed(1)}" height="${rowHeight - 10}" rx="4" style="fill:var(${opts.colorVar})">
        <title>${escapeXml(item.label)}: ${escapeXml(opts.valueFormatter(item.value))}</title>
      </rect>
      <text x="${labelWidth + barWidth + 8}" y="${y + rowHeight / 2 + 4}" class="chart-value-label">${escapeXml(opts.valueFormatter(item.value))}</text>
    `;
  }).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMinYMin meet" role="img">
      ${rows}
    </svg>
  `;
}
