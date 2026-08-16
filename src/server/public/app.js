document.addEventListener('DOMContentLoaded', () => {
  fetchPendingArticles();
});

async function fetchPendingArticles() {
  const container = document.getElementById('news-container');
  const badge = document.getElementById('pending-count');

  try {
    const response = await fetch('/api/pending');
    const items = await response.json();

    if (items.error) throw new Error(items.error);

    badge.textContent = `${items.length} Pending`;

    if (items.length === 0) {
      container.innerHTML = `
        <div class="loading-state">
          <h2>🎉 All caught up!</h2>
          <p style="margin-top: 1rem;">No pending articles to review.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    items.forEach(item => {
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
  card.id = `card-${item.id}`;

  const sourceName = item.raw_articles?.sources?.name || 'Unknown Source';
  const originalUrl = item.raw_articles?.original_url || '#';
  const rawTitle = item.raw_articles?.raw_title || 'No Original Title';
  
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
      <p style="font-size: 0.875rem; color: var(--text-muted);">Original: ${rawTitle}</p>
    </div>

    <div class="field-group">
      <label>Hindi Headline</label>
      <input type="text" class="editable-field" id="headline-${item.id}" value="${escapeHtml(item.hindi_headline)}">
    </div>

    <div class="field-group">
      <label>Hindi Subline</label>
      <input type="text" class="editable-field" id="subline-${item.id}" value="${escapeHtml(item.hindi_subline)}" style="font-size: 1rem; font-weight: normal;">
    </div>

    <div class="field-group">
      <label>Lead Sentence</label>
      <textarea class="editable-field" id="lead-${item.id}" rows="2">${escapeHtml(item.lead_sentence)}</textarea>
    </div>

    <div class="field-group">
      <label>Body Paragraph</label>
      <textarea class="editable-field" id="body-${item.id}" rows="4">${escapeHtml(item.body_paragraph)}</textarea>
    </div>

    <div class="field-group">
      <label>Image Prompt & Tags</label>
      <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
        <textarea class="editable-field" id="prompt-${item.id}" rows="2" style="font-size: 0.875rem;">${escapeHtml(item.image_prompt)}</textarea>
        <button class="btn" style="background: rgba(255,255,255,0.1); border: 1px solid var(--glass-border); color: white; flex: 0 0 auto; padding: 0 1rem; font-size: 0.875rem;" onclick="regenerateImage('${item.id}')">🔄 Regenerate</button>
      </div>
      <div class="tags-container">
        ${(item.state_tags || []).map(t => `<span class="tag" style="border-bottom: 2px solid #38bdf8">${escapeHtml(t)}</span>`).join('')}
        ${(item.interest_tags || []).map(t => `<span class="tag" style="border-bottom: 2px solid #10b981">${escapeHtml(t)}</span>`).join('')}
      </div>
    </div>

    <div class="card-actions">
      <button class="btn btn-reject" onclick="rejectArticle('${item.id}')">
        ✖ Reject
      </button>
      <button class="btn btn-approve" onclick="approveArticle('${item.id}')">
        ✔ Approve
      </button>
    </div>
  `;

  return card;
}

async function approveArticle(id) {
  const headline = document.getElementById(`headline-${id}`).value;
  const subline = document.getElementById(`subline-${id}`).value;
  const lead = document.getElementById(`lead-${id}`).value;
  const body = document.getElementById(`body-${id}`).value;

  try {
    const res = await fetch(`/api/approve/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hindi_headline: headline,
        hindi_subline: subline,
        lead_sentence: lead,
        body_paragraph: body
      })
    });
    
    if (res.ok) {
      removeCard(id);
      showToast('Article Approved! 🌿');
      updateCount();
    }
  } catch (error) {
    console.error(error);
    showToast('Error approving article', true);
  }
}

async function rejectArticle(id) {
  if(!confirm('Are you sure you want to reject this article?')) return;

  try {
    const res = await fetch(`/api/reject/${id}`, { method: 'POST' });
    if (res.ok) {
      removeCard(id);
      showToast('Article Rejected 🗑️');
      updateCount();
    }
  } catch (error) {
    console.error(error);
    showToast('Error rejecting article', true);
  }
}

async function regenerateImage(id) {
  const prompt = document.getElementById(`prompt-${id}`).value;
  const cardImg = document.querySelector(`#card-${id} .card-image`);
  const btn = document.querySelector(`#card-${id} button[onclick="regenerateImage('${id}')"]`);
  
  if (cardImg) cardImg.style.opacity = '0.5';
  const origText = btn.innerHTML;
  btn.innerHTML = '⏳...';
  btn.disabled = true;

  try {
    const res = await fetch(`/api/regenerate-image/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_prompt: prompt })
    });
    const result = await res.json();
    
    if (result.success && result.image_url) {
      if (cardImg) {
        cardImg.src = result.image_url;
        cardImg.style.opacity = '1';
      } else {
        const newImg = document.createElement('img');
        newImg.src = result.image_url;
        newImg.className = 'card-image';
        document.getElementById(`card-${id}`).prepend(newImg);
      }
      showToast('Image regenerated! 🎨');
    } else {
      showToast('Error regenerating image', true);
      if (cardImg) cardImg.style.opacity = '1';
    }
  } catch(e) {
    console.error(e);
    showToast('Error regenerating image', true);
    if (cardImg) cardImg.style.opacity = '1';
  } finally {
    btn.innerHTML = origText;
    btn.disabled = false;
  }
}

function removeCard(id) {
  const card = document.getElementById(`card-${id}`);
  card.style.transform = 'scale(0.95)';
  card.style.opacity = '0';
  setTimeout(() => card.remove(), 200);
}

function updateCount() {
  const badge = document.getElementById('pending-count');
  let current = parseInt(badge.textContent);
  if (!isNaN(current) && current > 0) {
    current--;
    badge.textContent = `${current} Pending`;
    if (current === 0) fetchPendingArticles(); // Show empty state
  }
}

function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.borderLeftColor = isError ? 'var(--danger)' : 'var(--primary)';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
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
