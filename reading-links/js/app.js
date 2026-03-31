// Reading List app — 8 categories + archive
// Firestore: reading_links | classify via Cloud Function (no key in browser)

var CLASSIFY_URL = 'https://us-central1-nutrition-198dd.cloudfunctions.net/classifyArticle';

var TABS = [
  'physics_cosmos','biology_life','technology','artificial_intelligence',
  'human_stories','health_wellness','exercises','philosophy','personal_growth',
  'economics_society','travel','personal_finance','links','other','suggested','archive','favorites'
];

var activeTab = 'physics_cosmos';
var allItems  = {};

// ── Firestore ──────────────────────────────────────────────────────────────

function load() {
  db.collection('reading_links').onSnapshot(function(snap) {
    allItems = {};
    snap.forEach(function(doc) { allItems[doc.id] = Object.assign({ id: doc.id }, doc.data()); });
    renderAll();
  });
}

function addItem(item)      { return db.collection('reading_links').add(item); }
function updateTitle(id, title)    { db.collection('reading_links').doc(id).update({ title: title }); }
function moveItem(id, category)    { db.collection('reading_links').doc(id).update({ category: category, favorited: false }); }
function keepSuggestion(id) { db.collection('reading_links').doc(id).update({ status: 'active' }); }
function markRead(id)       { db.collection('reading_links').doc(id).delete(); }
function markArchive(id)    { db.collection('reading_links').doc(id).update({ status: 'archived' }); }
function markRestore(id)    { db.collection('reading_links').doc(id).update({ status: 'active' }); }
function deleteItem(id)     { db.collection('reading_links').doc(id).delete(); }
function toggleFavorite(id, isFav) { db.collection('reading_links').doc(id).update({ favorited: !isFav }); }

// ── Render ─────────────────────────────────────────────────────────────────

function renderAll() {
  var byTab = {};
  TABS.forEach(function(t) { byTab[t] = []; });

  Object.values(allItems).forEach(function(item) {
    if (item.status === 'suggested') {
      byTab.suggested.push(item);
    } else if (item.status === 'archived') {
      byTab.archive.push(item);
    } else if (item.favorited) {
      byTab.favorites.push(item);
    } else {
      var cat = item.category || 'economics_society';
      if (!byTab[cat]) cat = 'economics_society';
      byTab[cat].push(item);
    }
  });

  TABS.forEach(function(tab) {
    byTab[tab].sort(function(a, b) { return (b.addedAt || '') > (a.addedAt || '') ? 1 : -1; });
    document.getElementById('cnt-' + tab).textContent = byTab[tab].length;
    var panel = document.getElementById('panel-' + tab);
    panel.innerHTML = byTab[tab].length === 0
      ? '<p class="empty">Nothing here yet.</p>'
      : byTab[tab].map(renderCard).join('');
  });

  bindActions();
}

function renderCard(item) {
  var domain = '';
  try { domain = new URL(item.url).hostname.replace('www.', ''); } catch(e) {}
  var date = (item.addedAt || '').split('T')[0];
  var archived = item.status === 'archived';

  var suggested = item.status === 'suggested';
  var isFav = !!item.favorited;
  var actions = suggested
    ? '<button class="btn-keep"    data-id="' + esc(item.id) + '">✓ Keep</button>' +
      '<button class="btn-delete"  data-id="' + esc(item.id) + '">Dismiss</button>'
    : archived
    ? '<button class="btn-edit"    data-id="' + esc(item.id) + '" data-title="' + esc(item.title) + '">✎</button>' +
      '<button class="btn-restore" data-id="' + esc(item.id) + '">↩ Restore</button>' +
      '<button class="btn-delete"  data-id="' + esc(item.id) + '">Delete</button>'
    : '<button class="btn-edit"    data-id="' + esc(item.id) + '" data-title="' + esc(item.title) + '">✎</button>' +
      '<button class="btn-move"    data-id="' + esc(item.id) + '">Move</button>' +
      '<button class="btn-fav' + (isFav ? ' active' : '') + '" data-id="' + esc(item.id) + '" data-fav="' + isFav + '">' + (isFav ? '★' : '☆') + '</button>' +
      '<button class="btn-read"    data-id="' + esc(item.id) + '" title="Delete">🗑</button>' +
      '<button class="btn-archive" data-id="' + esc(item.id) + '">Archive</button>'
    ;

  return '<div class="card" data-id="' + esc(item.id) + '">' +
    '<div class="card-body">' +
      '<div class="card-title"><a href="' + esc(item.url) + '" target="_blank" rel="noopener">' + esc(item.title) + '</a></div>' +
      '<div class="card-meta">' + esc(domain) + (date ? ' · ' + date : '') + '</div>' +
    '</div>' +
    '<div class="card-actions">' + actions + '</div>' +
  '</div>';
}

function bindActions() {
  document.querySelectorAll('.btn-keep').forEach(function(b)    { b.onclick = function() { keepSuggestion(this.dataset.id); }; });
  document.querySelectorAll('.btn-read').forEach(function(b)    { b.onclick = function() { markRead(this.dataset.id); }; });
  document.querySelectorAll('.btn-archive').forEach(function(b) { b.onclick = function() { markArchive(this.dataset.id); }; });
  document.querySelectorAll('.btn-restore').forEach(function(b) { b.onclick = function() { markRestore(this.dataset.id); }; });
  document.querySelectorAll('.btn-delete').forEach(function(b)  { b.onclick = function() { deleteItem(this.dataset.id); }; });
  document.querySelectorAll('.btn-fav').forEach(function(b) {
    b.onclick = function() { toggleFavorite(this.dataset.id, this.dataset.fav === 'true'); };
  });
  document.querySelectorAll('.btn-move').forEach(function(b) {
    b.onclick = function(e) {
      e.stopPropagation();
      // Remove any existing picker
      var existing = document.querySelector('.move-picker');
      if (existing) { existing.remove(); if (existing.dataset.for === this.dataset.id) return; }
      var id = this.dataset.id;
      var CAT_LABELS = {
        physics_cosmos: 'Physics & Cosmos', biology_life: 'Biology & Life',
        technology: 'Technology', artificial_intelligence: 'AI',
        human_stories: 'Human Stories', health_wellness: 'Health',
        exercises: 'Exercises', philosophy: 'Philosophy',
        personal_growth: 'Personal Growth', economics_society: 'Economics',
        travel: 'Travel', personal_finance: 'Personal Finance', links: 'Links', other: 'Other'
      };
      var picker = document.createElement('div');
      picker.className = 'move-picker';
      picker.dataset.for = id;
      picker.innerHTML = Object.entries(CAT_LABELS).map(function(e) {
        return '<button data-cat="' + e[0] + '">' + e[1] + '</button>';
      }).join('');
      this.parentNode.insertBefore(picker, this.nextSibling);
      picker.querySelectorAll('button').forEach(function(btn) {
        btn.onclick = function(e) { e.stopPropagation(); moveItem(id, this.dataset.cat); };
      });
    };
  });
  document.querySelectorAll('.btn-edit').forEach(function(b) {
    b.onclick = function() {
      var id = this.dataset.id;
      var card = document.querySelector('.card[data-id="' + id + '"]');
      var titleEl = card.querySelector('.card-title');
      titleEl.style.overflow = 'visible';
      titleEl.style.whiteSpace = 'normal';
      var currentTitle = allItems[id] ? allItems[id].title : this.dataset.title;
      titleEl.innerHTML =
        '<input class="title-edit-input" value="' + esc(currentTitle) + '" style="width:100%;font-size:0.88rem;font-weight:600;border:1px solid #d4a373;border-radius:4px;padding:2px 6px;outline:none;">' +
        '<button class="title-save-btn" data-id="' + esc(id) + '" style="margin-left:6px;background:#1e1e1e;color:white;border:none;padding:2px 10px;border-radius:4px;font-size:0.72rem;cursor:pointer;">Save</button>' +
        '<button class="title-cancel-btn" style="margin-left:4px;background:none;border:1px solid #ccc;color:#666;padding:2px 8px;border-radius:4px;font-size:0.72rem;cursor:pointer;">Cancel</button>';
      var input = titleEl.querySelector('.title-edit-input');
      input.focus();
      input.select();
      titleEl.querySelector('.title-save-btn').onclick = function() {
        var newTitle = input.value.trim();
        if (newTitle) updateTitle(id, newTitle);
      };
      titleEl.querySelector('.title-cancel-btn').onclick = function() {
        renderAll();
      };
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { var t = input.value.trim(); if (t) updateTitle(id, t); }
        if (e.key === 'Escape') renderAll();
      });
    };
  });
}

// ── Tabs ───────────────────────────────────────────────────────────────────

document.querySelectorAll('.tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    activeTab = this.dataset.tab;
    document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
    this.classList.add('active');
    TABS.forEach(function(t) {
      document.getElementById('panel-' + t).style.display = (t === activeTab) ? '' : 'none';
    });
  });
});

// ── Add Link Modal ─────────────────────────────────────────────────────────

var modal       = document.getElementById('modal');
var urlInput    = document.getElementById('url-input');
var titleInput  = document.getElementById('title-input');
var statusEl    = document.getElementById('modal-status');
var confirmBtn  = document.getElementById('confirm-add');

document.getElementById('open-modal').onclick = function() {
  urlInput.value = ''; titleInput.value = '';
  statusEl.textContent = ''; statusEl.className = 'modal-status';
  confirmBtn.disabled = false;
  modal.classList.add('open');
  setTimeout(function() { urlInput.focus(); }, 80);
};
document.getElementById('close-modal').onclick = closeModal;
modal.addEventListener('click', function(e) { if (e.target === modal) closeModal(); });
urlInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') confirmBtn.click(); });

function closeModal() { modal.classList.remove('open'); }

confirmBtn.onclick = function() {
  var url = urlInput.value.trim();
  if (!url || !url.startsWith('http')) {
    statusEl.textContent = 'Please enter a valid URL.';
    statusEl.className = 'modal-status error';
    return;
  }
  var existing = Object.values(allItems).find(function(item) { return item.url === url; });
  if (existing) {
    statusEl.textContent = 'Already in your list: ' + (existing.title || url);
    statusEl.className = 'modal-status error';
    return;
  }
  confirmBtn.disabled = true;
  statusEl.innerHTML = '<span class="spinner"></span>Classifying…';
  statusEl.className = 'modal-status';

  fetch(CLASSIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url })
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (data.error) throw new Error(data.error);
    var manualTitle = titleInput.value.trim();
    return addItem({
      url: data.url || url, title: manualTitle || data.title, description: data.description,
      category: data.category, status: 'active',
      addedAt: new Date().toISOString()
    });
  })
  .then(closeModal)
  .catch(function(err) {
    statusEl.textContent = 'Error: ' + err.message;
    statusEl.className = 'modal-status error';
    confirmBtn.disabled = false;
  });
};

// ── Helpers ────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Close move picker on outside click ────────────────────────────────────

document.addEventListener('click', function() {
  var p = document.querySelector('.move-picker');
  if (p) p.remove();
});

// ── Init ───────────────────────────────────────────────────────────────────

load();
