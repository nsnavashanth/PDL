/**
 * CubeSec Prototype - Security Logs Controller
 * Displays persistent audit trails backed by SQLite and allows log inspection.
 */

const SecurityLogs = {
  logs: [],

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const btnRefresh = document.getElementById('btnRefreshLogs');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => this.loadLogs());
    }

    const btnClear = document.getElementById('btnClearLogs');
    if (btnClear) {
      btnClear.addEventListener('click', () => this.clearAllLogs());
    }

    const filterEvent = document.getElementById('logFilterEvent');
    if (filterEvent) {
      filterEvent.addEventListener('change', () => this.loadLogs());
    }

    const filterStatus = document.getElementById('logFilterStatus');
    if (filterStatus) {
      filterStatus.addEventListener('change', () => this.loadLogs());
    }
  },

  async loadLogs() {
    const filterEvent = document.getElementById('logFilterEvent');
    const filterStatus = document.getElementById('logFilterStatus');
    const tbody = document.getElementById('securityLogsTableBody');

    const evType = filterEvent ? filterEvent.value : '';
    const stVal = filterStatus ? filterStatus.value : '';

    let url = `/api/logs?limit=100`;
    if (evType) url += `&event_type=${encodeURIComponent(evType)}`;
    if (stVal) url += `&status=${encodeURIComponent(stVal)}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      this.logs = data.logs || [];
      this.renderTable(this.logs);
    } catch (err) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--status-danger-text);">Failed to load logs: ${err.message}</td></tr>`;
      }
    }
  },

  renderTable(logs) {
    const tbody = document.getElementById('securityLogsTableBody');
    if (!tbody) return;

    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:20px;">No audit logs match current filters.</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map(log => {
      const timeStr = log.timestamp ? log.timestamp.replace('T', ' ').substring(0, 19) : '—';
      const badgeClass = log.status === 'SUCCESS' ? 'badge-success' : log.status === 'WARNING' ? 'badge-warning' : 'badge-danger';

      return `
        <tr onclick="SecurityLogs.showLogDetails(${log.id})">
          <td style="font-family:var(--font-mono); font-size:11px; white-space:nowrap;">${timeStr}</td>
          <td><span class="badge ${badgeClass}">${log.event_type}</span></td>
          <td>${log.module}</td>
          <td><span class="badge ${badgeClass}">${log.status}</span></td>
          <td style="font-family:var(--font-mono);">${log.client_ip}</td>
          <td style="font-weight:500;">${log.summary}</td>
        </tr>
      `;
    }).join('');
  },

  showLogDetails(logId) {
    const log = this.logs.find(l => l.id === logId);
    if (!log) return;

    const modal = document.getElementById('legalModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBodyText');

    if (!modal || !title || !body) return;

    title.textContent = `Audit Log #${log.id} — ${log.event_type}`;
    body.innerHTML = `
      <div style="margin-bottom:12px;">
        <div><strong>Timestamp:</strong> <code>${log.timestamp}</code></div>
        <div><strong>Module:</strong> ${log.module}</div>
        <div><strong>Client IP:</strong> <code>${log.client_ip}</code></div>
        <div><strong>Status:</strong> <span class="badge ${log.status === 'SUCCESS' ? 'badge-success' : log.status === 'WARNING' ? 'badge-warning' : 'badge-danger'}">${log.status}</span></div>
        <div><strong>Summary:</strong> ${log.summary}</div>
      </div>
      <div style="font-weight:600; margin-bottom:4px;">Structured Payload (JSON):</div>
      <pre class="code-output" style="height:200px;">${JSON.stringify(log.details, null, 2)}</pre>
    `;
    modal.classList.add('open');
  },

  async clearAllLogs() {
    if (!confirm('Are you sure you want to clear the entire security audit trail?')) return;
    try {
      await fetch('/api/logs/clear', { method: 'POST' });
      this.loadLogs();
      if (window.App) window.App.fetchOverviewLogs();
    } catch (err) {
      alert('Failed to clear logs: ' + err.message);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  SecurityLogs.init();
});

window.SecurityLogs = SecurityLogs;
