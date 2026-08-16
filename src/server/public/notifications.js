document.addEventListener('DOMContentLoaded', () => {
  fetchLogs();
});

async function fetchLogs() {
  const container = document.getElementById('logs-container');

  try {
    const response = await fetch('/api/notifications');
    const logs = await response.json();

    if (logs.error) throw new Error(logs.error);

    if (logs.length === 0) {
      container.innerHTML = `<p style="color: var(--text-muted); padding: 2rem 0; text-align: center;">No notifications sent yet.</p>`;
      return;
    }

    let html = `
      <table class="log-table">
        <thead>
          <tr>
            <th>Time Sent</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
    `;

    logs.forEach(log => {
      html += `
        <tr>
          <td style="white-space: nowrap; color: var(--text-muted); font-size: 0.875rem;">
            ${new Date(log.sent_at).toLocaleString()}
          </td>
          <td style="font-weight: 500;">
            ${escapeHtml(log.message)}
          </td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;

  } catch (error) {
    console.error('Error:', error);
    container.innerHTML = `<div style="color: var(--danger); padding: 2rem;">Error loading logs. Check console.</div>`;
  }
}

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
