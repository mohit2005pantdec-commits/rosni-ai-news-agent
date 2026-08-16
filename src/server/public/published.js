let publishedItems = [];

document.addEventListener('DOMContentLoaded', () => {
  fetchPublishedArticles();
});

async function fetchPublishedArticles() {
  const container = document.getElementById('news-container');
  const badge = document.getElementById('published-count');

  try {
    const response = await fetch('/api/published');
    publishedItems = await response.json();

    if (publishedItems.error) throw new Error(publishedItems.error);

    const publishedCount = publishedItems.filter(i => i.status === 'published').length;
    badge.textContent = `${publishedCount} Published`;

    if (publishedItems.length === 0) {
      container.innerHTML = `
        <div class="loading-state">
          <h2>No Published Articles</h2>
          <p style="margin-top: 1rem;">Approved articles will appear here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    publishedItems.forEach(item => {
      container.appendChild(createNewsCard(item));
    });

  } catch (error) {
    console.error('Error:', error);
    container.innerHTML = `<div class="loading-state" style="color: var(--danger)">Error loading articles. Check console.</div>`;
  }
}

function createNewsCard(item) {
  const card = document.createElement('div');
  card.className = 'news-card';

  const sourceName = item.raw_articles?.sources?.name || 'Unknown Source';
  const originalUrl = item.raw_articles?.original_url || '#';
  
  const imageHtml = item.image_url 
    ? `<img src="${item.image_url}" alt="AI Generated Image" class="card-image" />`
    : '';

  card.innerHTML = `
    ${imageHtml}
    <div class="card-header">
      <div class="source-meta">
        <span>Source: <strong>${sourceName}</strong></span>
        <a href="${originalUrl}" target="_blank" rel="noopener noreferrer">View Original ↗</a>
      </div>
      <p style="font-size: 0.875rem; color: var(--text-muted);">
        ${item.status === 'published' ? `Published: ${new Date(item.published_at).toLocaleString()}` : `Approved - Ready to Publish`}
      </p>
    </div>

    <div class="field-group">
      <div class="headline-readonly">${escapeHtml(item.hindi_headline)}</div>
      <div class="subline-readonly">${escapeHtml(item.hindi_subline)}</div>
    </div>

    <div class="field-group">
      <label>Lead</label>
      <div class="readonly-text" style="font-weight: 600;">${escapeHtml(item.lead_sentence)}</div>
    </div>

    <div class="field-group">
      <label>Body</label>
      <div class="readonly-text">${escapeHtml(item.body_paragraph)}</div>
    </div>

    <div class="field-group">
      <div class="tags-container">
        ${(item.state_tags || []).map(t => `<span class="tag" style="border-bottom: 2px solid #38bdf8">${escapeHtml(t)}</span>`).join('')}
        ${(item.interest_tags || []).map(t => `<span class="tag" style="border-bottom: 2px solid #10b981">${escapeHtml(t)}</span>`).join('')}
      </div>
    </div>
    
    ${item.status === 'approved' ? `
    <div class="card-actions">
      <button class="btn btn-approve" onclick="publishItem('${item.id}')">🚀 Publish Now</button>
    </div>
    ` : `
    <div class="card-actions" style="border-top: none; padding-top: 0; margin-top: 1rem;">
      <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399; border-color: rgba(52, 211, 153, 0.3);">✅ Published</span>
    </div>
    `}
  `;

  return card;
}

async function publishItem(id) {
  try {
    const res = await fetch(`/api/publish/${id}`, {
      method: 'POST'
    });
    
    if (res.ok) {
      alert('Article published successfully!');
      fetchPublishedArticles();
    } else {
      const errorData = await res.json();
      alert('Error publishing: ' + errorData.error);
    }
  } catch (err) {
    console.error(err);
    alert('Error publishing item');
  }
}

function exportJSON() {
  const publishedOnly = publishedItems.filter(i => i.status === 'published');
  const dataStr = JSON.stringify(publishedOnly, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
  const exportFileDefaultName = 'published_news.json';
  
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
}

function exportCSV() {
  const publishedOnly = publishedItems.filter(i => i.status === 'published');
  if (publishedOnly.length === 0) return;
  
  // Basic CSV conversion
  const headers = ['id', 'headline', 'subline', 'lead', 'body', 'image_url', 'source', 'published_at'];
  let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n";
  
  publishedOnly.forEach(item => {
    const row = [
      item.id,
      escapeCsv(item.hindi_headline),
      escapeCsv(item.hindi_subline),
      escapeCsv(item.lead_sentence),
      escapeCsv(item.body_paragraph),
      item.image_url || '',
      item.raw_articles?.sources?.name || '',
      item.published_at || ''
    ];
    csvContent += row.join(",") + "\n";
  });
  
  const encodedUri = encodeURI(csvContent);
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', encodedUri);
  linkElement.setAttribute('download', 'published_news.csv');
  linkElement.click();
}

function escapeCsv(text) {
  if (!text) return '""';
  // Escape quotes and wrap in quotes
  return `"${text.toString().replace(/"/g, '""')}"`;
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
