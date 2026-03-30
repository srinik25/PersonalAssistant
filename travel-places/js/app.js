// Travel Places — continent tabs, country → state → city → items
// Firestore: travel_places collection

var CONTINENTS  = ['africa','north-america','mexico-ca','south-america','asia','europe','middle_east','oceania'];
var CONT_LABELS = {
  'africa':        'Africa',
  'north-america': 'N. America',
  'mexico-ca':     'Mexico & C. America',
  'south-america': 'S. America & Caribbean',
  'asia':          'Asia',
  'europe':        'Europe',
  'middle_east':   'Middle East',
  'oceania':       'Oceania'
};
var activeTab = 'europe';
var allItems  = {};
var filters   = {};

var NA_STRICT     = new Set(['usa','canada']);
var MEXICO_CA     = new Set(['mexico','guatemala','belize','honduras','el salvador','nicaragua','costa rica','panama']);

function itemTab(item) {
  var c = (item.continent || '').toLowerCase();
  if (c === 'americas' || c === 'north-america') {
    var country = (item.country || '').toLowerCase();
    if (NA_STRICT.has(country))  return 'north-america';
    if (MEXICO_CA.has(country))  return 'mexico-ca';
    return 'south-america';
  }
  if (c === 'mexico-ca') return 'mexico-ca';
  return c;
}

// ── Firestore ──────────────────────────────────────────────────────────────

var visitedCountries = {}; // id → {country, region, addedAt}

function load() {
  db.collection('travel_places').onSnapshot(function(snap) {
    allItems = {};
    snap.forEach(function(doc) { allItems[doc.id] = Object.assign({ id: doc.id }, doc.data()); });
    renderAll();
    refreshDatalists();
    if (searchInput.value.trim()) doSearch(searchInput.value);
  });
  db.collection('visited_countries').onSnapshot(function(snap) {
    visitedCountries = {};
    snap.forEach(function(doc) { visitedCountries[doc.id] = Object.assign({ id: doc.id }, doc.data()); });
    renderVisitedCountries();
  });
}

function addItem(item)          { return db.collection('travel_places').add(item); }
function deleteItem(id)         { db.collection('travel_places').doc(id).delete(); }
function updateItem(id, data)   { return db.collection('travel_places').doc(id).update(data); }
function toggleVisited(id, cur) { db.collection('travel_places').doc(id).update({ visited: !cur }); }

// ── Types ──────────────────────────────────────────────────────────────────

var TYPE_ICON  = { food:'🍽', experience:'✨', place:'📍', accommodation:'🏨', other:'🔖' };
var TYPE_TYPES = ['place','food','experience','accommodation','other'];
var FILTER_LABELS = {
  all:'All', place:'📍 Places', food:'🍽 Food', experience:'✨ Experiences',
  accommodation:'🏨 Stays', other:'🔖 Other', visited:'✓ Visited'
};

// ── Render ─────────────────────────────────────────────────────────────────

function renderAll() {
  CONTINENTS.forEach(function(tab) {
    var items = Object.values(allItems).filter(function(i) { return itemTab(i) === tab; });

    var tcnt = document.getElementById('tcnt-' + tab);
    if (tcnt) tcnt.textContent = items.length || '';

    var panel = document.getElementById('panel-' + tab);
    if (!panel) return;
    if (items.length === 0) {
      panel.innerHTML = '<p class="empty">Nothing added yet.</p>';
      return;
    }

    // Count by type + visited
    var counts = { all: items.length, place:0, food:0, experience:0, accommodation:0, other:0, visited:0 };
    items.forEach(function(i) {
      var t = i.type || 'place';
      if (counts[t] !== undefined) counts[t]++;
      else counts.other++;
      if (i.visited) counts.visited++;
    });

    // Filter bar
    var activeFilter = filters[tab] || 'all';
    var filterHtml = '<div class="filter-bar">';
    ['all','place','food','experience','accommodation','other','visited'].forEach(function(f) {
      var cnt = f === 'all' ? counts.all : (counts[f] || 0);
      if (f !== 'all' && f !== 'visited' && cnt === 0) return;
      if (f === 'visited' && cnt === 0) return;
      var cls = 'filter-btn' + (f === activeFilter ? ' active' : '') + (f === 'visited' ? ' visited-filter' : '');
      filterHtml += '<button class="' + cls + '" data-cont="' + tab + '" data-filter="' + f + '">' +
        FILTER_LABELS[f] + ' <span class="filter-cnt">' + cnt + '</span></button>';
    });
    filterHtml += '</div>';

    // Apply filter
    var filtered;
    if (activeFilter === 'all')          filtered = items;
    else if (activeFilter === 'visited') filtered = items.filter(function(i) { return !!i.visited; });
    else filtered = items.filter(function(i) { return (i.type || 'place') === activeFilter; });

    if (filtered.length === 0) {
      panel.innerHTML = filterHtml + '<p class="empty">None here yet.</p>';
      bindFilterBtns();
      return;
    }

    // Group by country → state → city
    var byCountry = {};
    filtered.forEach(function(item) {
      var c = item.country || 'Unknown';
      if (!byCountry[c]) byCountry[c] = {};
      var s = item.state || '';
      if (!byCountry[c][s]) byCountry[c][s] = {};
      var city = item.city || 'General';
      if (!byCountry[c][s][city]) byCountry[c][s][city] = [];
      byCountry[c][s][city].push(item);
    });

    var html = filterHtml;
    Object.keys(byCountry).sort().forEach(function(country) {
      var countryTotal = 0;
      Object.values(byCountry[country]).forEach(function(sm) {
        Object.values(sm).forEach(function(arr) { countryTotal += arr.length; });
      });
      html += '<div class="country-section">' +
        '<div class="country-header">' + esc(country) +
        ' <span class="section-cnt">' + countryTotal + '</span>' +
        '<button class="btn-del-country" data-country="' + esc(country) + '" data-cont="' + esc(tab) + '">🗑</button></div>';

      var stateKeys = Object.keys(byCountry[country]).sort(function(a, b) {
        if (a === '' && b !== '') return -1;
        if (a !== '' && b === '') return 1;
        return a.localeCompare(b);
      });

      stateKeys.forEach(function(state) {
        var hasState = state !== '';
        if (hasState) {
          var stateTotal = Object.values(byCountry[country][state]).reduce(function(n,a){ return n+a.length; },0);
          html += '<div class="state-section"><div class="state-header">' + esc(state) +
            ' <span class="section-cnt">' + stateTotal + '</span></div>';
        }
        Object.keys(byCountry[country][state]).sort().forEach(function(city) {
          var cityItems = byCountry[country][state][city];
          html += '<div class="city-section"><div class="city-header">' + esc(city) +
            ' <span class="section-cnt">' + cityItems.length + '</span></div>';
          cityItems.sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); })
            .forEach(function(item) { html += renderCard(item); });
          html += '</div>';
        });
        if (hasState) html += '</div>';
      });
      html += '</div>';
    });

    panel.innerHTML = html;
    bindFilterBtns();
  });
  bindActions();
}

function mapsUrl(item) {
  var q = [item.name, item.city, item.state, item.country].filter(Boolean).join(' ');
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
}

function googleUrl(item) {
  var q = [item.name, item.city, item.state, item.country].filter(Boolean).join(' ');
  return 'https://www.google.com/search?q=' + encodeURIComponent(q);
}

function renderCard(item, breadcrumb) {
  var icon = TYPE_ICON[item.type] || '📍';
  var isVisited = !!item.visited;
  return '<div class="card' + (isVisited ? ' visited-card' : '') + '" data-id="' + esc(item.id) + '">' +
    '<div class="card-body">' +
      (breadcrumb ? '<div class="search-breadcrumb">' + esc(breadcrumb) + '</div>' : '') +
      '<div class="card-title"><span class="type-icon">' + icon + '</span>' +
        '<span class="item-name">' + esc(item.name) + '</span></div>' +
      (item.description ? '<div class="card-desc">' + esc(item.description) + '</div>' : '') +
    '</div>' +
    '<div class="card-actions">' +
      '<a class="btn-maps" href="' + mapsUrl(item) + '" target="_blank" rel="noopener">Maps</a>' +
      '<a class="btn-google" href="' + googleUrl(item) + '" target="_blank" rel="noopener">Google</a>' +
      '<button class="btn-visit' + (isVisited ? ' visited' : '') + '" data-id="' + esc(item.id) + '" data-visited="' + isVisited + '">' + (isVisited ? '✓' : '☐') + '</button>' +
      '<button class="btn-edit" data-id="' + esc(item.id) + '">✎</button>' +
      '<button class="btn-delete" data-id="' + esc(item.id) + '">🗑</button>' +
    '</div>' +
  '</div>';
}

function bindActions() {
  document.querySelectorAll('.btn-delete').forEach(function(b) {
    b.onclick = function() { deleteItem(this.dataset.id); };
  });
  document.querySelectorAll('.btn-edit').forEach(function(b) {
    b.onclick = function() { openEditModal(this.dataset.id); };
  });
  document.querySelectorAll('.btn-visit').forEach(function(b) {
    b.onclick = function() { toggleVisited(this.dataset.id, this.dataset.visited === 'true'); };
  });
  document.querySelectorAll('.btn-del-country').forEach(function(b) {
    b.onclick = function(e) {
      e.stopPropagation();
      var country = this.dataset.country, tab = this.dataset.cont;
      Object.values(allItems).filter(function(i) {
        return i.country === country && itemTab(i) === tab;
      }).forEach(function(i) { deleteItem(i.id); });
    };
  });
  document.querySelectorAll('.city-header').forEach(function(h) {
    h.onclick = function() { this.parentElement.classList.toggle('collapsed'); };
  });
}

function bindFilterBtns() {
  document.querySelectorAll('.filter-btn').forEach(function(b) {
    b.onclick = function() {
      filters[this.dataset.cont] = this.dataset.filter;
      renderAll();
    };
  });
}

// ── Search ─────────────────────────────────────────────────────────────────

var searchInput = document.getElementById('search-input');
var searchClear = document.getElementById('search-clear');
var searchPanel = document.getElementById('search-panel');
var tabsEl      = document.getElementById('tabs');

function doSearch(q) {
  q = q.trim();
  if (!q) { clearSearch(); return; }
  searchClear.style.display = '';

  CONTINENTS.forEach(function(c) { document.getElementById('panel-' + c).style.display = 'none'; });
  document.getElementById('panel-bulk').style.display = 'none';
  document.getElementById('panel-visited-countries').style.display = 'none';
  tabsEl.style.opacity = '0.35';
  tabsEl.style.pointerEvents = 'none';
  searchPanel.style.display = '';

  var ql = q.toLowerCase();
  var results = Object.values(allItems).filter(function(i) {
    return (i.name||'').toLowerCase().includes(ql) ||
           (i.description||'').toLowerCase().includes(ql) ||
           (i.country||'').toLowerCase().includes(ql) ||
           (i.city||'').toLowerCase().includes(ql) ||
           (i.state||'').toLowerCase().includes(ql);
  }).sort(function(a,b) {
    var an = (a.name||'').toLowerCase().startsWith(ql) ? 0 : 1;
    var bn = (b.name||'').toLowerCase().startsWith(ql) ? 0 : 1;
    return an - bn || (a.name||'').localeCompare(b.name||'');
  });

  if (results.length === 0) {
    searchPanel.innerHTML = '<p class="empty">No results for "' + esc(q) + '"</p>';
    return;
  }

  searchPanel.innerHTML = '<p class="search-count">' + results.length + ' result' + (results.length !== 1 ? 's' : '') + '</p>' +
    results.map(function(item) {
      var tab   = itemTab(item);
      var parts = [CONT_LABELS[tab] || tab, item.country];
      if (item.state) parts.push(item.state);
      parts.push(item.city);
      return renderCard(item, parts.filter(Boolean).join(' › '));
    }).join('');

  searchPanel.querySelectorAll('.btn-delete').forEach(function(b) { b.onclick = function() { deleteItem(this.dataset.id); }; });
  searchPanel.querySelectorAll('.btn-edit').forEach(function(b)   { b.onclick = function() { openEditModal(this.dataset.id); }; });
  searchPanel.querySelectorAll('.btn-visit').forEach(function(b)  { b.onclick = function() { toggleVisited(this.dataset.id, this.dataset.visited === 'true'); }; });
}

function clearSearch() {
  searchInput.value = '';
  searchClear.style.display = 'none';
  searchPanel.style.display = 'none';
  tabsEl.style.opacity = '';
  tabsEl.style.pointerEvents = '';
  CONTINENTS.forEach(function(c) {
    document.getElementById('panel-' + c).style.display = (c === activeTab) ? '' : 'none';
  });
  document.getElementById('panel-bulk').style.display = (activeTab === 'bulk') ? '' : 'none';
  document.getElementById('panel-visited-countries').style.display = (activeTab === 'visited-countries') ? '' : 'none';
}

searchInput.addEventListener('input', function() { doSearch(this.value); });
searchInput.addEventListener('keydown', function(e) { if (e.key === 'Escape') clearSearch(); });
searchClear.addEventListener('click', clearSearch);
document.addEventListener('keydown', function(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchInput.focus(); searchInput.select(); }
});

// ── Tabs ───────────────────────────────────────────────────────────────────

document.querySelectorAll('.tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    clearSearch();
    activeTab = this.dataset.tab;
    document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
    this.classList.add('active');
    CONTINENTS.forEach(function(c) {
      document.getElementById('panel-' + c).style.display = (c === activeTab) ? '' : 'none';
    });
    document.getElementById('panel-bulk').style.display = (activeTab === 'bulk') ? '' : 'none';
    document.getElementById('panel-visited-countries').style.display = (activeTab === 'visited-countries') ? '' : 'none';
  });
});

// ── Datalists ──────────────────────────────────────────────────────────────

function refreshDatalists() {
  var countriesByTab = {};
  var statesByCountry = {};
  var citiesByCountry = {};
  CONTINENTS.forEach(function(c) { countriesByTab[c] = new Set(); });

  Object.values(allItems).forEach(function(item) {
    var tab = itemTab(item);
    if (countriesByTab[tab]) countriesByTab[tab].add(item.country);
    if (item.country) {
      if (!statesByCountry[item.country]) statesByCountry[item.country] = new Set();
      if (item.state) statesByCountry[item.country].add(item.state);
      if (!citiesByCountry[item.country]) citiesByCountry[item.country] = new Set();
      if (item.city) citiesByCountry[item.country].add(item.city);
    }
  });

  CONTINENTS.forEach(function(c) {
    var dl = document.getElementById('dl-countries-' + c);
    if (dl) dl.innerHTML = Array.from(countriesByTab[c]).sort().map(function(v) {
      return '<option value="' + esc(v) + '">';
    }).join('');
  });
  window._statesByCountry = statesByCountry;
  window._citiesByCountry = citiesByCountry;
}

function updateStateDatalist(country) {
  var dl = document.getElementById('dl-states');
  if (dl) dl.innerHTML = Array.from((window._statesByCountry||{})[country]||new Set()).sort()
    .map(function(v){ return '<option value="'+esc(v)+'">'; }).join('');
}
function updateCityDatalist(country) {
  var dl = document.getElementById('dl-cities');
  if (dl) dl.innerHTML = Array.from((window._citiesByCountry||{})[country]||new Set()).sort()
    .map(function(v){ return '<option value="'+esc(v)+'">'; }).join('');
}

// ── Add Modal ──────────────────────────────────────────────────────────────

var modal      = document.getElementById('modal');
var statusEl   = document.getElementById('modal-status');
var confirmBtn = document.getElementById('confirm-add');
var fContinent = document.getElementById('f-continent');
var fCountry   = document.getElementById('f-country');
var fState     = document.getElementById('f-state');
var fCity      = document.getElementById('f-city');
var fName      = document.getElementById('f-name');
var fType      = document.getElementById('f-type');
var fDesc      = document.getElementById('f-desc');

document.getElementById('open-modal').onclick = function() {
  var tab = activeTab;
  fContinent.value = CONTINENTS.includes(tab) ? tab : 'europe';
  fCountry.value = ''; fState.value = ''; fCity.value = ''; fName.value = ''; fDesc.value = '';
  fType.value = 'place';
  statusEl.textContent = ''; confirmBtn.disabled = false;
  modal.classList.add('open');
  setTimeout(function() { fCountry.focus(); }, 80);
};
document.getElementById('close-modal').onclick = closeModal;
modal.addEventListener('click', function(e) { if (e.target === modal) closeModal(); });
fCountry.addEventListener('input', function() {
  updateCityDatalist(this.value.trim());
  updateStateDatalist(this.value.trim());
});
fContinent.addEventListener('change', function() {
  fCountry.setAttribute('list', 'dl-countries-' + this.value);
});

function closeModal() { modal.classList.remove('open'); }

confirmBtn.onclick = function() {
  var continent = fContinent.value.trim(), country = fCountry.value.trim(), state = fState.value.trim();
  var city = fCity.value.trim(), name = fName.value.trim(), type = fType.value, desc = fDesc.value.trim();
  if (!continent || !country || !name) { statusEl.textContent = 'Continent, country and name are required.'; return; }
  confirmBtn.disabled = true;
  addItem({ continent: continent, country, state: state||'', city: city||'General', name, type, description: desc, visited: false, addedAt: new Date().toISOString() })
    .then(function() {
      closeModal();
      var tabBtn = document.querySelector('.tab[data-tab="' + continent + '"]');
      if (tabBtn) tabBtn.click();
    })
    .catch(function(err) { statusEl.textContent = 'Error: ' + err.message; confirmBtn.disabled = false; });
};

// ── Edit Modal ─────────────────────────────────────────────────────────────

var editModal   = document.getElementById('edit-modal');
var eName       = document.getElementById('e-name');
var eType       = document.getElementById('e-type');
var eDesc       = document.getElementById('e-desc');
var eCountry    = document.getElementById('e-country');
var eState      = document.getElementById('e-state');
var eCity       = document.getElementById('e-city');
var eContinent  = document.getElementById('e-continent');
var editSaveBtn = document.getElementById('edit-save');
var editingId   = null;

document.getElementById('edit-close').onclick = function() { editModal.classList.remove('open'); };
editModal.addEventListener('click', function(e) { if (e.target === editModal) editModal.classList.remove('open'); });

function openEditModal(id) {
  var item = allItems[id];
  if (!item) return;
  editingId = id;
  eName.value    = item.name || '';
  eType.value    = item.type || 'place';
  eDesc.value    = item.description || '';
  eCountry.value = item.country || '';
  eState.value   = item.state || '';
  eCity.value    = item.city || '';
  // Map stored continent to tab value for the dropdown
  var cont = itemTab(item);
  eContinent.value = cont;
  document.getElementById('edit-status').textContent = '';
  editModal.classList.add('open');
  setTimeout(function() { eName.focus(); }, 80);
}

editSaveBtn.onclick = function() {
  if (!editingId) return;
  var name = eName.value.trim();
  if (!name) { document.getElementById('edit-status').textContent = 'Name required.'; return; }
  editSaveBtn.disabled = true;
  updateItem(editingId, {
    name: name, type: eType.value, description: eDesc.value.trim(),
    country: eCountry.value.trim(), state: eState.value.trim(), city: eCity.value.trim(),
    continent: eContinent.value
  }).then(function() { editModal.classList.remove('open'); editSaveBtn.disabled = false; })
    .catch(function(err) { document.getElementById('edit-status').textContent = 'Error: ' + err.message; editSaveBtn.disabled = false; });
};

// ── Bulk Entry ─────────────────────────────────────────────────────────────

var CITY_GEO = {
  'new york':       {country:'USA', state:'New York',           continent:'north-america'},
  'nyc':            {country:'USA', state:'New York',           continent:'north-america'},
  'jersey city':    {country:'USA', state:'New Jersey',         continent:'north-america'},
  'santa fe':       {country:'USA', state:'New Mexico',         continent:'north-america'},
  'albuquerque':    {country:'USA', state:'New Mexico',         continent:'north-america'},
  'chicago':        {country:'USA', state:'Illinois',           continent:'north-america'},
  'los angeles':    {country:'USA', state:'California',         continent:'north-america'},
  'san francisco':  {country:'USA', state:'California',         continent:'north-america'},
  'seattle':        {country:'USA', state:'Washington',         continent:'north-america'},
  'miami':          {country:'USA', state:'Florida',            continent:'north-america'},
  'boston':         {country:'USA', state:'Massachusetts',      continent:'north-america'},
  'washington dc':  {country:'USA', state:'District of Columbia', continent:'north-america'},
  'dc':             {country:'USA', state:'District of Columbia', continent:'north-america'},
  'washington':     {country:'USA', state:'District of Columbia', continent:'north-america'},
  'philadelphia':   {country:'USA', state:'Pennsylvania',       continent:'north-america'},
  'philly':         {country:'USA', state:'Pennsylvania',       continent:'north-america'},
  'baltimore':      {country:'USA', state:'Maryland',           continent:'north-america'},
  'atlanta':        {country:'USA', state:'Georgia',            continent:'north-america'},
  'denver':         {country:'USA', state:'Colorado',           continent:'north-america'},
  'nashville':      {country:'USA', state:'Tennessee',          continent:'north-america'},
  'austin':         {country:'USA', state:'Texas',              continent:'north-america'},
  'houston':        {country:'USA', state:'Texas',              continent:'north-america'},
  'honolulu':       {country:'USA', state:'Hawaii',             continent:'north-america'},
  'portland':       {country:'USA', state:'Oregon',             continent:'north-america'},
  'kansas city':    {country:'USA', state:'Missouri',           continent:'north-america'},
  'st. louis':      {country:'USA', state:'Missouri',           continent:'north-america'},
  'st louis':       {country:'USA', state:'Missouri',           continent:'north-america'},
  'new orleans':    {country:'USA', state:'Louisiana',          continent:'north-america'},
  'pittsburgh':     {country:'USA', state:'Pennsylvania',       continent:'north-america'},
  'richmond':       {country:'USA', state:'Virginia',           continent:'north-america'},
  'charlottesville':{country:'USA', state:'Virginia',           continent:'north-america'},
  'minneapolis':    {country:'USA', state:'Minnesota',          continent:'north-america'},
  'detroit':        {country:'USA', state:'Michigan',           continent:'north-america'},
  'phoenix':        {country:'USA', state:'Arizona',            continent:'north-america'},
  'san diego':      {country:'USA', state:'California',         continent:'north-america'},
  'toronto':        {country:'Canada', state:'Ontario',         continent:'north-america'},
  'montreal':       {country:'Canada', state:'Quebec',          continent:'north-america'},
  'vancouver':      {country:'Canada', state:'British Columbia',continent:'north-america'},
  'mexico city':    {country:'Mexico', state:'',                continent:'mexico-ca'},
  'oaxaca':         {country:'Mexico', state:'',                continent:'mexico-ca'},
  'havana':         {country:'Cuba',   state:'',                continent:'south-america'},
  'bogota':         {country:'Colombia', state:'',              continent:'south-america'},
  'medellin':       {country:'Colombia', state:'',              continent:'south-america'},
  'cartagena':      {country:'Colombia', state:'',              continent:'south-america'},
  'lima':           {country:'Peru',     state:'',              continent:'south-america'},
  'buenos aires':   {country:'Argentina',state:'',              continent:'south-america'},
  'rio de janeiro': {country:'Brazil',   state:'',              continent:'south-america'},
  'sao paulo':      {country:'Brazil',   state:'',              continent:'south-america'},
  'port of spain':  {country:'Trinidad and Tobago', state:'',   continent:'south-america'},
  'marrakesh':      {country:'Morocco',  state:'',              continent:'africa'},
  'marrakech':      {country:'Morocco',  state:'',              continent:'africa'},
  'cairo':          {country:'Egypt',    state:'',              continent:'africa'},
  'nairobi':        {country:'Kenya',    state:'',              continent:'africa'},
  'cape town':      {country:'South Africa', state:'',          continent:'africa'},
  'paris':          {country:'France',   state:'',              continent:'europe'},
  'london':         {country:'United Kingdom', state:'England', continent:'europe'},
  'york':           {country:'United Kingdom', state:'England', continent:'europe'},
  'rome':           {country:'Italy',    state:'',              continent:'europe'},
  'florence':       {country:'Italy',    state:'',              continent:'europe'},
  'venice':         {country:'Italy',    state:'',              continent:'europe'},
  'barcelona':      {country:'Spain',    state:'',              continent:'europe'},
  'madrid':         {country:'Spain',    state:'',              continent:'europe'},
  'amsterdam':      {country:'Netherlands', state:'',           continent:'europe'},
  'berlin':         {country:'Germany',  state:'',              continent:'europe'},
  'prague':         {country:'Czech Republic', state:'',        continent:'europe'},
  'vienna':         {country:'Austria',  state:'',              continent:'europe'},
  'lisbon':         {country:'Portugal', state:'',              continent:'europe'},
  'athens':         {country:'Greece',   state:'',              continent:'europe'},
  'edinburgh':      {country:'United Kingdom', state:'Scotland',continent:'europe'},
  'tokyo':          {country:'Japan',    state:'',              continent:'asia'},
  'kyoto':          {country:'Japan',    state:'',              continent:'asia'},
  'osaka':          {country:'Japan',    state:'',              continent:'asia'},
  'bangkok':        {country:'Thailand', state:'',              continent:'asia'},
  'singapore':      {country:'Singapore', state:'',             continent:'asia'},
  'bali':           {country:'Indonesia', state:'',             continent:'asia'},
  'mumbai':         {country:'India',    state:'',              continent:'asia'},
  'delhi':          {country:'India',    state:'',              continent:'asia'},
  'new delhi':      {country:'India',    state:'',              continent:'asia'},
  'hanoi':          {country:'Vietnam',  state:'',              continent:'asia'},
  'dubai':          {country:'UAE',      state:'',              continent:'middle_east'},
  'abu dhabi':      {country:'UAE',      state:'',              continent:'middle_east'},
  'tel aviv':       {country:'Israel',   state:'',              continent:'middle_east'},
  'amman':          {country:'Jordan',   state:'',              continent:'middle_east'},
  'sydney':         {country:'Australia',state:'New South Wales',continent:'oceania'},
  'melbourne':      {country:'Australia',state:'Victoria',      continent:'oceania'},
  'auckland':       {country:'New Zealand', state:'',           continent:'oceania'},
};

// Country name → geo (for "Birding in Colombia" style entries with no city)
var COUNTRY_GEO = {
  // Americas
  'canada':              {country:'Canada',           continent:'north-america'},
  'usa':                 {country:'USA',              continent:'north-america'},
  'mexico':              {country:'Mexico',           continent:'mexico-ca'},
  'guatemala':           {country:'Guatemala',        continent:'mexico-ca'},
  'belize':              {country:'Belize',           continent:'mexico-ca'},
  'costa rica':          {country:'Costa Rica',       continent:'mexico-ca'},
  'panama':              {country:'Panama',           continent:'mexico-ca'},
  'cuba':                {country:'Cuba',             continent:'south-america'},
  'jamaica':             {country:'Jamaica',          continent:'south-america'},
  'colombia':            {country:'Colombia',         continent:'south-america'},
  'peru':                {country:'Peru',             continent:'south-america'},
  'brazil':              {country:'Brazil',           continent:'south-america'},
  'argentina':           {country:'Argentina',        continent:'south-america'},
  'chile':               {country:'Chile',            continent:'south-america'},
  'ecuador':             {country:'Ecuador',          continent:'south-america'},
  'bolivia':             {country:'Bolivia',          continent:'south-america'},
  'uruguay':             {country:'Uruguay',          continent:'south-america'},
  'trinidad':            {country:'Trinidad and Tobago', continent:'south-america'},
  'trinidad and tobago': {country:'Trinidad and Tobago', continent:'south-america'},
  // Europe
  'france':              {country:'France',           continent:'europe'},
  'italy':               {country:'Italy',            continent:'europe'},
  'spain':               {country:'Spain',            continent:'europe'},
  'germany':             {country:'Germany',          continent:'europe'},
  'portugal':            {country:'Portugal',         continent:'europe'},
  'greece':              {country:'Greece',           continent:'europe'},
  'netherlands':         {country:'Netherlands',      continent:'europe'},
  'belgium':             {country:'Belgium',          continent:'europe'},
  'switzerland':         {country:'Switzerland',      continent:'europe'},
  'austria':             {country:'Austria',          continent:'europe'},
  'sweden':              {country:'Sweden',           continent:'europe'},
  'denmark':             {country:'Denmark',          continent:'europe'},
  'norway':              {country:'Norway',           continent:'europe'},
  'finland':             {country:'Finland',          continent:'europe'},
  'iceland':             {country:'Iceland',          continent:'europe'},
  'ireland':             {country:'Ireland',          continent:'europe'},
  'united kingdom':      {country:'United Kingdom',   continent:'europe'},
  'uk':                  {country:'United Kingdom',   continent:'europe'},
  'poland':              {country:'Poland',           continent:'europe'},
  'czechia':             {country:'Czechia',          continent:'europe'},
  'hungary':             {country:'Hungary',          continent:'europe'},
  'croatia':             {country:'Croatia',          continent:'europe'},
  'romania':             {country:'Romania',          continent:'europe'},
  // Africa
  'morocco':             {country:'Morocco',          continent:'africa'},
  'egypt':               {country:'Egypt',            continent:'africa'},
  'kenya':               {country:'Kenya',            continent:'africa'},
  'south africa':        {country:'South Africa',     continent:'africa'},
  'tanzania':            {country:'Tanzania',         continent:'africa'},
  'ethiopia':            {country:'Ethiopia',         continent:'africa'},
  'ghana':               {country:'Ghana',            continent:'africa'},
  'senegal':             {country:'Senegal',          continent:'africa'},
  'rwanda':              {country:'Rwanda',           continent:'africa'},
  'namibia':             {country:'Namibia',          continent:'africa'},
  'botswana':            {country:'Botswana',         continent:'africa'},
  'zambia':              {country:'Zambia',           continent:'africa'},
  'zimbabwe':            {country:'Zimbabwe',         continent:'africa'},
  // Asia
  'japan':               {country:'Japan',            continent:'asia'},
  'india':               {country:'India',            continent:'asia'},
  'thailand':            {country:'Thailand',         continent:'asia'},
  'vietnam':             {country:'Vietnam',          continent:'asia'},
  'indonesia':           {country:'Indonesia',        continent:'asia'},
  'china':               {country:'China',            continent:'asia'},
  'nepal':               {country:'Nepal',            continent:'asia'},
  'sri lanka':           {country:'Sri Lanka',        continent:'asia'},
  'malaysia':            {country:'Malaysia',         continent:'asia'},
  'singapore':           {country:'Singapore',        continent:'asia'},
  'philippines':         {country:'Philippines',      continent:'asia'},
  'cambodia':            {country:'Cambodia',         continent:'asia'},
  'laos':                {country:'Laos',             continent:'asia'},
  'myanmar':             {country:'Myanmar',          continent:'asia'},
  'south korea':         {country:'South Korea',      continent:'asia'},
  'taiwan':              {country:'Taiwan',           continent:'asia'},
  'georgia':             {country:'Georgia',          continent:'asia'},
  'turkey':              {country:'Turkey',           continent:'asia'},
  // Middle East
  'uae':                 {country:'UAE',              continent:'middle_east'},
  'qatar':               {country:'Qatar',            continent:'middle_east'},
  'jordan':              {country:'Jordan',           continent:'middle_east'},
  'israel':              {country:'Israel',           continent:'middle_east'},
  'lebanon':             {country:'Lebanon',          continent:'middle_east'},
  'oman':                {country:'Oman',             continent:'middle_east'},
  'saudi arabia':        {country:'Saudi Arabia',     continent:'middle_east'},
  // Oceania
  'australia':           {country:'Australia',        continent:'oceania'},
  'new zealand':         {country:'New Zealand',      continent:'oceania'},
};

function autoClassify(name) {
  var n = name.toLowerCase();
  var foodKw = ['pizza','cafe','café','coffee','restaurant','bakery','bar','diner','brewery','kitchen','tapas','grill','ramen','noodle','sushi','bagel','donut','gelato','ice cream','taco','burrito','wine','brew','roaster','bistro','brasserie','pastry','bread','pub','tavern','cantina','trattoria','eatery','roti','hummus','falafel','kabob','kebab','bahn mi','bánh mì','tea room'];
  var accKw  = ['hotel','inn','hostel','riad','guesthouse','guest house','resort','lodge','motel','b&b','pension','auberge','suites','airbnb'];
  var expKw  = ['hike','trail','festival','concert','tour','class','workshop','jamboree','birding','kayak','ski','climb','safari','cruise','show','market','fair','boat','raft','diving','snorkel','bike','drive in','drive-in'];
  if (foodKw.some(function(w){return n.includes(w);})) return 'food';
  if (accKw.some(function(w){return n.includes(w);}))  return 'accommodation';
  if (expKw.some(function(w){return n.includes(w);}))  return 'experience';
  return 'place';
}

function parseBulkLine(line) {
  line = line.replace(/^\d+[\.\)]\s*/, '').trim();
  if (!line) return null;

  // Type hint at end: " -- accommodation" or " -- classify this item under other"
  var typeHint = null;
  var dashM = line.match(/\s*--\s*(.+?)\s*$/);
  if (dashM) {
    var hint = dashM[1].toLowerCase().trim();
    var found = TYPE_TYPES.find(function(t) { return hint.includes(t); });
    typeHint = found || 'other';
    line = line.slice(0, dashM.index).trim();
  }

  var parts = line.split(',').map(function(p){ return p.trim(); });
  var name = parts[0];
  var city = parts[1] || '';
  var countryOverride = parts[2] || '';

  var geo = city ? (CITY_GEO[city.toLowerCase()] || {}) : {};

  // If CITY_GEO lookup failed, check whether the value is actually a country name
  if (!geo.country && city) {
    var asCountry = COUNTRY_GEO[city.toLowerCase()];
    if (asCountry) {
      geo  = asCountry;
      city = '';  // was a country, not a city — clear it
    }
  }

  // Try to find country name in the item name itself (no city or country given)
  if (!geo.country && !city) {
    var nl = name.toLowerCase();
    for (var ck in COUNTRY_GEO) {
      if (nl.includes(ck)) { geo = COUNTRY_GEO[ck]; break; }
    }
  }

  if (countryOverride) { geo = Object.assign({}, geo, {country: countryOverride}); }

  return {
    name: name,
    city: city,
    country: geo.country || '',
    state: geo.state || '',
    continent: geo.continent || '',
    type: typeHint || autoClassify(name),
    description: ''
  };
}

var bulkParsed = [];

document.getElementById('bulk-parse').onclick = function() {
  var raw = document.getElementById('bulk-textarea').value;
  bulkParsed = raw.split('\n').map(parseBulkLine).filter(Boolean);
  renderBulkPreview();
};

function typeSelect(current, idx, cls) {
  return '<select class="' + cls + '" data-i="' + idx + '">' +
    TYPE_TYPES.map(function(t) {
      return '<option value="' + t + '"' + (t === current ? ' selected' : '') + '>' + TYPE_ICON[t] + ' ' + t.charAt(0).toUpperCase() + t.slice(1) + '</option>';
    }).join('') + '</select>';
}

function contSelect(current, idx, cls) {
  var opts = [
    {v:'north-america', l:'N. America (USA & Canada)'},
    {v:'mexico-ca',     l:'Mexico & Central America'},
    {v:'south-america', l:'S. America & Caribbean'},
    {v:'africa',        l:'Africa'},
    {v:'asia',          l:'Asia'},
    {v:'europe',        l:'Europe'},
    {v:'middle_east',   l:'Middle East'},
    {v:'oceania',       l:'Oceania'},
  ];
  return '<select class="' + cls + '" data-i="' + idx + '">' +
    opts.map(function(o) {
      return '<option value="' + o.v + '"' + (o.v === (current||'europe') ? ' selected' : '') + '>' + o.l + '</option>';
    }).join('') + '</select>';
}

function renderBulkPreview() {
  var el = document.getElementById('bulk-preview');
  if (!bulkParsed.length) { el.innerHTML = '<p class="empty">Paste items and click Parse.</p>'; return; }

  var rows = bulkParsed.map(function(item, i) {
    return '<tr>' +
      '<td><input class="bulk-name" data-i="' + i + '" value="' + esc(item.name) + '"></td>' +
      '<td><input class="bulk-city" data-i="' + i + '" value="' + esc(item.city) + '" placeholder="City"></td>' +
      '<td><input class="bulk-country" data-i="' + i + '" value="' + esc(item.country) + '" placeholder="Country"></td>' +
      '<td>' + typeSelect(item.type, i, 'bulk-type') + '</td>' +
      '<td>' + contSelect(item.continent, i, 'bulk-cont') + '</td>' +
      '<td><button class="bulk-row-del" data-i="' + i + '">✕</button></td>' +
    '</tr>';
  }).join('');

  el.innerHTML = '<p class="bulk-count">' + bulkParsed.length + ' items parsed</p>' +
    '<div style="overflow-x:auto">' +
    '<table class="bulk-table"><thead><tr><th>Name</th><th>City</th><th>Country</th><th>Type</th><th>Region</th><th></th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table></div>' +
    '<button id="bulk-import" class="bulk-import-btn">Import ' + bulkParsed.length + ' items →</button>' +
    '<div id="bulk-status" class="bulk-status"></div>';

  el.querySelectorAll('.bulk-name').forEach(function(inp) { inp.oninput = function() { bulkParsed[+this.dataset.i].name = this.value; }; });
  el.querySelectorAll('.bulk-city').forEach(function(inp) { inp.oninput = function() { bulkParsed[+this.dataset.i].city = this.value; }; });
  el.querySelectorAll('.bulk-country').forEach(function(inp) { inp.oninput = function() { bulkParsed[+this.dataset.i].country = this.value; }; });
  el.querySelectorAll('.bulk-type').forEach(function(sel) { sel.onchange = function() { bulkParsed[+this.dataset.i].type = this.value; }; });
  el.querySelectorAll('.bulk-cont').forEach(function(sel) { sel.onchange = function() { bulkParsed[+this.dataset.i].continent = this.value; }; });
  el.querySelectorAll('.bulk-row-del').forEach(function(btn) {
    btn.onclick = function() { bulkParsed.splice(+this.dataset.i, 1); renderBulkPreview(); };
  });
  document.getElementById('bulk-import').onclick = importBulk;
}

function importBulk() {
  var btn      = document.getElementById('bulk-import');
  var statusEl = document.getElementById('bulk-status');
  if (!bulkParsed.length) return;
  btn.disabled = true;
  statusEl.textContent = 'Importing…';

  var valid   = bulkParsed.filter(function(item) { return item.name && item.country; });
  var skipped = bulkParsed.length - valid.length;

  Promise.all(valid.map(function(item) {
    return addItem({
      continent:   item.continent || 'europe',
      country:     item.country,
      state:       item.state || '',
      city:        item.city  || 'General',
      name:        item.name,
      type:        item.type,
      description: item.description || '',
      visited:     false,
      addedAt:     new Date().toISOString()
    });
  })).then(function() {
    statusEl.textContent = valid.length + ' imported!' + (skipped ? ' ' + skipped + ' skipped (missing name or country).' : '');
    bulkParsed = [];
    document.getElementById('bulk-textarea').value = '';
    setTimeout(function() { renderBulkPreview(); statusEl.textContent = ''; }, 2500);
    btn.disabled = false;
  }).catch(function(err) {
    statusEl.textContent = 'Error: ' + err.message;
    btn.disabled = false;
  });
}

// ── Visited Countries ──────────────────────────────────────────────────────

var REGION_ORDER = ['North America','Caribbean','South America','Europe','Asia & Pacific','Middle East','Africa','Oceania'];

function renderVisitedCountries() {
  var panel = document.getElementById('panel-visited-countries');
  if (!panel) return;

  var items = Object.values(visitedCountries);
  var total = items.length;

  // Update tab badge
  var tcnt = document.getElementById('tcnt-visited-countries');
  if (tcnt) tcnt.textContent = total || '';

  // Group by region
  var byRegion = {};
  REGION_ORDER.forEach(function(r) { byRegion[r] = []; });
  items.forEach(function(item) {
    var r = item.region || 'Other';
    if (!byRegion[r]) byRegion[r] = [];
    byRegion[r].push(item);
  });

  // Sort each region alphabetically
  Object.keys(byRegion).forEach(function(r) {
    byRegion[r].sort(function(a,b){ return (a.country||'').localeCompare(b.country||''); });
  });

  var html = '<div class="vc-header">' +
    '<div class="vc-total">' + total + '<span>countries visited</span></div>' +
    '<button class="vc-add-btn" id="vc-open">+ Add Country</button>' +
  '</div>';

  REGION_ORDER.forEach(function(region) {
    var chips = byRegion[region] || [];
    if (!chips.length) return;
    html += '<div class="vc-region">' +
      '<div class="vc-region-title">' + esc(region) +
        ' <span class="vc-region-cnt">' + chips.length + '</span>' +
      '</div>' +
      '<div class="vc-chips">' +
        chips.map(function(item) {
          return '<div class="vc-chip">' + esc(item.country) +
            '<button class="vc-chip-del" data-id="' + esc(item.id) + '" title="Remove">✕</button>' +
          '</div>';
        }).join('') +
      '</div></div>';
  });

  panel.innerHTML = html;

  // Bind delete buttons
  panel.querySelectorAll('.vc-chip-del').forEach(function(b) {
    b.onclick = function() { db.collection('visited_countries').doc(this.dataset.id).delete(); };
  });

  // Bind add button
  var openBtn = document.getElementById('vc-open');
  if (openBtn) openBtn.onclick = openVcModal;
}

// Add Country modal
var vcModal   = document.getElementById('vc-modal');
var vcCountry = document.getElementById('vc-country');
var vcRegion  = document.getElementById('vc-region');
var vcStatus  = document.getElementById('vc-status');
var vcSaveBtn = document.getElementById('vc-save');

function openVcModal() {
  vcCountry.value = ''; vcStatus.textContent = ''; vcSaveBtn.disabled = false;
  vcModal.classList.add('open');
  setTimeout(function() { vcCountry.focus(); }, 80);
}

document.getElementById('vc-close').onclick = function() { vcModal.classList.remove('open'); };
vcModal.addEventListener('click', function(e) { if (e.target === vcModal) vcModal.classList.remove('open'); });

vcSaveBtn.onclick = function() {
  var country = vcCountry.value.trim();
  var region  = vcRegion.value;
  if (!country) { vcStatus.textContent = 'Country name required.'; return; }
  vcSaveBtn.disabled = true;
  db.collection('visited_countries').add({
    country: country, region: region, addedAt: new Date().toISOString()
  }).then(function() {
    vcModal.classList.remove('open');
    vcSaveBtn.disabled = false;
  }).catch(function(err) {
    vcStatus.textContent = 'Error: ' + err.message;
    vcSaveBtn.disabled = false;
  });
};

// ── Helpers ────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init ───────────────────────────────────────────────────────────────────

load();
