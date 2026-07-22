const VALID_USERNAME_REGEX = /^[a-zA-Z0-9_.-]{1,30}$/;
const API_BASE = '/api';
const BATCH_SIZE = 12;

let allResults = [];
let totalSites = 0;
let isSearching = false;
let searchAbortController = null;

// DOM Elements
const usernameInput = document.getElementById('usernameInput');
const searchBtn = document.getElementById('searchBtn');
const cancelBtn = document.getElementById('cancelBtn');
const uploadArea = document.getElementById('uploadArea');
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');
const imageSearchBtn = document.getElementById('imageSearchBtn');
const metaInfo = document.getElementById('metaInfo');
const validationError = document.getElementById('validationError');
const progressSection = document.getElementById('progressSection');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const resultsSection = document.getElementById('resultsSection');
const emptyState = document.getElementById('emptyState');
const foundItems = document.getElementById('foundItems');
const notFoundItems = document.getElementById('notFoundItems');
const errorItems = document.getElementById('errorItems');
const countFound = document.getElementById('countFound');
const countNotFound = document.getElementById('countNotFound');
const countError = document.getElementById('countError');
const exportControls = document.getElementById('exportControls');
const copyTextBtn = document.getElementById('copyTextBtn');
const copyJsonBtn = document.getElementById('copyJsonBtn');
const downloadBtn = document.getElementById('downloadBtn');

// Tabs
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadMeta();
  setupEventListeners();
});

function setupEventListeners() {
  searchBtn.addEventListener('click', handleSearch);
  cancelBtn.addEventListener('click', handleCancel);
  usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
  });
  usernameInput.addEventListener('input', () => {
    validationError.classList.remove('show');
  });

  // Tab switching
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${tab}`).classList.add('active');
    });
  });

  // Image upload
  uploadArea.addEventListener('click', () => imageInput.click());
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'var(--primary)';
  });
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.borderColor = 'var(--border)';
  });
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'var(--border)';
    if (e.dataTransfer.files[0]) {
      imageInput.files = e.dataTransfer.files;
      handleImageSelect();
    }
  });
  imageInput.addEventListener('change', handleImageSelect);
  imageSearchBtn.addEventListener('click', handleImageSearch);

  // Export
  copyTextBtn.addEventListener('click', () => copyExport('text'));
  copyJsonBtn.addEventListener('click', () => copyExport('json'));
  downloadBtn.addEventListener('click', downloadResults);

  // Result group toggles
  document.querySelectorAll('.result-group-header').forEach(header => {
    header.addEventListener('click', () => {
      const group = header.dataset.group;
      const items = header.nextElementSibling;
      const toggle = header.querySelector('.toggle-icon');

      items.classList.toggle('show');
      toggle.style.transform = items.classList.contains('show') ? 'rotate(0deg)' : 'rotate(-90deg)';
    });
  });
}

async function loadMeta() {
  try {
    const res = await fetch(`${API_BASE}/meta`);
    const data = await res.json();
    totalSites = data.total;

    const categoryStr = data.categories
      .map(c => `${c.count} ${c.name}`)
      .join(', ');

    metaInfo.textContent = `Ready to check ~${totalSites} sites across ${data.categories.length} categories`;
  } catch (err) {
    console.error('Failed to load metadata:', err);
    metaInfo.textContent = 'Error loading site data';
  }
}

function validateUsername(username) {
  if (!username || !VALID_USERNAME_REGEX.test(username)) {
    validationError.textContent = 'Username must be 1-30 characters (letters, numbers, ._-)';
    validationError.classList.add('show');
    return false;
  }
  validationError.classList.remove('show');
  return true;
}

async function handleSearch() {
  const username = usernameInput.value.trim();
  if (!validateUsername(username)) return;

  allResults = [];
  isSearching = true;
  searchAbortController = new AbortController();

  progressSection.style.display = 'block';
  resultsSection.style.display = 'block';
  emptyState.style.display = 'none';
  searchBtn.disabled = true;
  usernameInput.disabled = true;
  exportControls.style.display = 'none';

  let offset = 0;
  let foundCount = 0;

  while (offset < totalSites && isSearching) {
    try {
      const res = await fetch(
        `${API_BASE}/check?username=${encodeURIComponent(username)}&offset=${offset}&limit=${BATCH_SIZE}`,
        { signal: searchAbortController.signal }
      );

      if (!res.ok) {
        alert('Search failed: ' + (await res.text()));
        break;
      }

      const data = await res.json();
      allResults.push(...data.results);

      // Update UI
      foundCount = allResults.filter(r => r.status === 'found').length;
      updateResults();
      updateProgress(allResults.length, totalSites, foundCount);

      // Check if done
      if (offset + data.results.length >= totalSites) break;

      offset += BATCH_SIZE;
      // Small delay between batches to be polite
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Search cancelled');
      } else {
        console.error('Batch error:', err);
        alert('Error during search: ' + err.message);
      }
      break;
    }
  }

  isSearching = false;
  searchBtn.disabled = false;
  usernameInput.disabled = false;
  cancelBtn.style.display = 'none';
  progressSection.style.display = 'none';

  if (allResults.length > 0) {
    exportControls.style.display = 'block';
  }
}

function handleCancel() {
  isSearching = false;
  searchAbortController?.abort();
  searchBtn.disabled = false;
  usernameInput.disabled = false;
  cancelBtn.style.display = 'none';
  progressSection.style.display = 'none';
}

function updateProgress(checked, total, found) {
  const pct = Math.round((checked / total) * 100);
  progressFill.style.width = pct + '%';
  progressText.textContent = `Checked ${checked} / ${total} · ${found} found`;
  cancelBtn.style.display = 'block';
}

function updateResults() {
  const found = allResults.filter(r => r.status === 'found');
  const notFound = allResults.filter(r => r.status === 'not_found');
  const errors = allResults.filter(r => r.status === 'skipped' || r.status === 'unknown');

  countFound.textContent = found.length;
  countNotFound.textContent = notFound.length;
  countError.textContent = errors.length;

  foundItems.innerHTML = found.map(renderResult).join('');
  notFoundItems.innerHTML = notFound.map(renderResult).join('');
  errorItems.innerHTML = errors.map(renderResult).join('');

  // Show found by default, hide others
  if (found.length > 0) {
    foundItems.classList.add('show');
  }
}

function renderResult(result) {
  const reasonText = result.reason ? ` (${result.reason.replace(/_/g, ' ')})` : '';

  if (result.status === 'found') {
    return `
      <div class="result-item">
        <div class="result-info">
          <div class="result-site">${result.site}</div>
          <span class="result-category">${result.category}</span>
          ${result.responseTimeMs ? `<span class="result-reason">${result.responseTimeMs}ms</span>` : ''}
        </div>
        <div class="result-link">
          <a href="${result.url}" target="_blank" rel="noopener noreferrer">View Profile →</a>
        </div>
      </div>
    `;
  } else if (result.status === 'not_found') {
    return `
      <div class="result-item">
        <div class="result-info">
          <div class="result-site">${result.site}</div>
          <span class="result-category">${result.category}</span>
        </div>
      </div>
    `;
  } else {
    return `
      <div class="result-item">
        <div class="result-info">
          <div class="result-site">${result.site}</div>
          <span class="result-category">${result.category}</span>
          <div class="result-reason">⚠️ ${reasonText.substring(2)}</div>
        </div>
      </div>
    `;
  }
}

function handleImageSelect() {
  const file = imageInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    imagePreview.style.display = 'block';
    imageSearchBtn.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

async function handleImageSearch() {
  alert('Image search is coming soon! For now, you can manually reverse search this image on Google Images or Yandex and then search for usernames found there.');
}

function copyExport(type) {
  let text = '';

  if (type === 'text') {
    const found = allResults.filter(r => r.status === 'found');
    text = found
      .map(r => `[FOUND] ${r.site} — ${r.url}`)
      .join('\n');
    text += '\n\n[NOT FOUND]\n' +
      allResults.filter(r => r.status === 'not_found')
        .map(r => r.site)
        .join(', ');
  } else if (type === 'json') {
    text = JSON.stringify(allResults, null, 2);
  }

  navigator.clipboard.writeText(text).then(() => {
    const btn = event.target;
    const original = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(() => {
      btn.textContent = original;
    }, 2000);
  }).catch(() => {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    alert('Copied to clipboard!');
  });
}

function downloadResults() {
  const found = allResults.filter(r => r.status === 'found');
  let text = `SHERLOCK OSINT RESULTS\n`;
  text += `Username: ${usernameInput.value}\n`;
  text += `Date: ${new Date().toLocaleString()}\n`;
  text += `Total Found: ${found.length}/${allResults.length}\n\n`;

  text += `FOUND PROFILES:\n${'-'.repeat(50)}\n`;
  found.forEach(r => {
    text += `${r.site}\n${r.url}\n\n`;
  });

  text += `\nETHICAL USE DISCLAIMER\n${'-'.repeat(50)}\n`;
  text += 'This tool is for personal security research and educational purposes only.\n';
  text += 'Do not use for harassment, stalking, or illegal activities.\n';

  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sherlock-results-${usernameInput.value}-${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
