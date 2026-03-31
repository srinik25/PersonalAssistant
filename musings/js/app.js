// Musings — Quotes, Systems, Guidelines
// Firestore: musings_items

var activeTab = 'quotes';
var items = {};
var editingId = null;

// ── Firestore ──────────────────────────────────────────────────────────────
function load() {
  db.collection('musings_items').onSnapshot(function(snap) {
    items = {};
    snap.forEach(function(doc) { items[doc.id] = Object.assign({ id: doc.id }, doc.data()); });
    render();
  });
}

function addItem(data)      { return db.collection('musings_items').add(Object.assign({ createdAt: new Date().toISOString() }, data)); }
function saveItem(id, data) { return db.collection('musings_items').doc(id).update(Object.assign({ updatedAt: new Date().toISOString() }, data)); }
function removeItem(id)     { return db.collection('musings_items').doc(id).delete(); }

// ── Helpers ────────────────────────────────────────────────────────────────
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function tabItems(tab) {
  return Object.values(items)
    .filter(function(i) { return i.tab === tab; })
    .sort(function(a, b) { return (a.createdAt||'').localeCompare(b.createdAt||''); });
}

// ── Render ─────────────────────────────────────────────────────────────────
function render() {
  // Tab active state
  document.querySelectorAll('.tab-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.tab === activeTab);
  });

  var list = tabItems(activeTab);
  var el = document.getElementById('main-content');

  var labelMap = { quotes: 'Favorite Quotes', systems: 'Systems', guidelines: 'Guidelines' };
  var meta = '<div class="section-meta">' +
    '<span class="section-label">' + labelMap[activeTab] + '</span>' +
    (list.length ? '<span class="section-count">' + list.length + '</span>' : '') +
    '</div>';

  if (!list.length) {
    el.innerHTML = meta + emptyHTML();
    return;
  }

  var content = activeTab === 'quotes' ? renderQuotes(list) : renderItems(list);
  el.innerHTML = meta + content;
  bindCards();
}

function emptyHTML() {
  var icons = { quotes: '"', systems: '⚙', guidelines: '📐' };
  var hints = { quotes: 'Add a quote that inspires you.', systems: 'Document a system that works for you.', guidelines: 'Write a principle you live by.' };
  return '<div class="empty-state"><div class="empty-icon">' + icons[activeTab] + '</div><p>' + hints[activeTab] + '</p></div>';
}

function renderQuotes(list) {
  return '<div class="quotes-grid">' +
    list.map(function(item) {
      return '<div class="quote-card" data-id="' + esc(item.id) + '">' +
        '<div class="card-actions">' +
          '<button class="btn-card-action btn-edit" data-id="' + esc(item.id) + '">Edit</button>' +
          '<button class="btn-card-action del btn-del" data-id="' + esc(item.id) + '">Delete</button>' +
        '</div>' +
        '<div class="quote-text">' + esc(item.content) + '</div>' +
        (item.author ? '<div class="quote-author">' + esc(item.author) + '</div>' : '') +
      '</div>';
    }).join('') +
  '</div>';
}

function renderItems(list) {
  return '<div class="items-list">' +
    list.map(function(item, i) {
      return '<div class="item-card" data-id="' + esc(item.id) + '">' +
        '<div class="item-number">' + (i + 1) + '</div>' +
        '<div class="item-body">' +
          '<div class="item-title">' + esc(item.title || item.content) + '</div>' +
          (item.title && item.content ? '<div class="item-content">' + esc(item.content) + '</div>' : '') +
        '</div>' +
        '<div class="card-actions">' +
          '<button class="btn-card-action btn-edit" data-id="' + esc(item.id) + '">Edit</button>' +
          '<button class="btn-card-action del btn-del" data-id="' + esc(item.id) + '">Delete</button>' +
        '</div>' +
      '</div>';
    }).join('') +
  '</div>';
}

function bindCards() {
  document.querySelectorAll('.btn-edit').forEach(function(b) {
    b.onclick = function(e) { e.stopPropagation(); openModal('edit', this.dataset.id); };
  });
  document.querySelectorAll('.btn-del').forEach(function(b) {
    b.onclick = function(e) {
      e.stopPropagation();
      if (!confirm('Delete this entry?')) return;
      removeItem(this.dataset.id);
    };
  });
}

// ── Tabs ───────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(function(b) {
  b.onclick = function() { activeTab = this.dataset.tab; render(); };
});

// ── Modal ──────────────────────────────────────────────────────────────────
var modal       = document.getElementById('modal');
var fTitle      = document.getElementById('f-title');
var fContent    = document.getElementById('f-content');
var fAuthor     = document.getElementById('f-author');
var rowTitle    = document.getElementById('row-title');
var rowAuthor   = document.getElementById('row-author');
var contentLabel= document.getElementById('content-label');
var modalStatus = document.getElementById('modal-status');

function openModal(mode, id) {
  modalStatus.textContent = '';
  var isQuote = activeTab === 'quotes';

  // Show/hide fields per tab
  rowTitle.style.display  = isQuote ? 'none' : '';
  rowAuthor.style.display = isQuote ? '' : 'none';
  contentLabel.textContent = isQuote ? 'Quote' : 'Description (optional)';
  fContent.placeholder = isQuote ? 'Enter the quote…' : 'Details, context, or explanation…';

  var titles = { quotes: 'Quote', systems: 'System', guidelines: 'Guideline' };
  if (mode === 'edit') {
    var item = items[id];
    document.getElementById('modal-title').textContent = 'Edit ' + titles[activeTab];
    fTitle.value   = item.title   || '';
    fContent.value = item.content || '';
    fAuthor.value  = item.author  || '';
    editingId = id;
  } else {
    document.getElementById('modal-title').textContent = 'Add ' + titles[activeTab];
    fTitle.value = ''; fContent.value = ''; fAuthor.value = '';
    editingId = null;
  }

  modal.classList.add('open');
  setTimeout(function() { (isQuote ? fContent : fTitle).focus(); }, 60);
}

document.getElementById('btn-add').onclick = function() { openModal('add'); };
document.getElementById('modal-cancel').onclick = function() { modal.classList.remove('open'); };
modal.addEventListener('click', function(e) { if (e.target === modal) modal.classList.remove('open'); });

document.getElementById('modal-save').onclick = function() {
  var content = fContent.value.trim();
  var isQuote = activeTab === 'quotes';
  if (!content && isQuote) { modalStatus.textContent = 'Quote text is required.'; return; }
  if (!fTitle.value.trim() && !isQuote) { modalStatus.textContent = 'Title is required.'; return; }

  this.disabled = true;
  var data = {
    tab:     activeTab,
    title:   fTitle.value.trim()   || null,
    content: content,
    author:  fAuthor.value.trim()  || null
  };

  var p = editingId ? saveItem(editingId, data) : addItem(data);
  p.then(function() {
    modal.classList.remove('open');
    document.getElementById('modal-save').disabled = false;
  }).catch(function(err) {
    modalStatus.textContent = 'Error: ' + err.message;
    document.getElementById('modal-save').disabled = false;
  });
};

// ── Init ───────────────────────────────────────────────────────────────────
load();
