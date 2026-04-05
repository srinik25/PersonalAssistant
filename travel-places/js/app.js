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
var activeTab    = 'europe';
var allItems     = {};
var filters      = {};
var collapseState = {}; // key → true=collapsed, false=expanded; default collapsed

var NA_STRICT     = new Set(['usa','canada','united states','united states of america','u.s.','u.s.a.','us']);
var MEXICO_CA     = new Set(['mexico','guatemala','belize','honduras','el salvador','nicaragua','costa rica','panama']);

// Canonical country names — maps alternate spellings to stored canonical form
var COUNTRY_ALIASES = {
  'united states of america': 'USA',
  'united states':            'USA',
  'u.s.a.':                   'USA',
  'u.s.':                     'USA',
  'us':                       'USA',
  'great britain':            'United Kingdom',
  'gb':                       'United Kingdom',
  'england':                  'United Kingdom',
  'uae':                      'UAE',
  'united arab emirates':     'UAE',
};

function normalizeCountry(name) {
  if (!name) return name;
  var lower = name.trim().toLowerCase();
  return COUNTRY_ALIASES[lower] || name.trim();
}

function itemTab(item) {
  var c = (item.continent || '').toLowerCase();
  if (c === 'americas' || c === 'north-america') {
    var country = (item.country || '').toLowerCase();
    if (NA_STRICT.has(country))  return 'north-america';
    if (MEXICO_CA.has(country))  return 'mexico-ca';
    // Fall back to COUNTRY_GEO if available
    var geoEntry = COUNTRY_GEO[country];
    if (geoEntry) return geoEntry.continent;
    return 'south-america';
  }
  if (c === 'mexico-ca') return 'mexico-ca';
  // If continent is missing or unrecognized, try COUNTRY_GEO
  if (!c || c === 'unknown') {
    var geo = COUNTRY_GEO[(item.country || '').toLowerCase()];
    if (geo) return geo.continent;
  }
  return c;
}

// ── Firestore ──────────────────────────────────────────────────────────────

var visitedCountries = {}; // id → {country, region, addedAt}
var bucketList       = {}; // id → {country, region, items[]}

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
  db.collection('bucket_list').onSnapshot(function(snap) {
    bucketList = {};
    snap.forEach(function(doc) { bucketList[doc.id] = Object.assign({ id: doc.id }, doc.data()); });
    renderBucketList();
  });
}

function addItem(item)               { return db.collection('travel_places').add(item); }
function deleteItem(id)              { db.collection('travel_places').doc(id).delete(); }
function updateItem(id, data)        { return db.collection('travel_places').doc(id).update(data); }
function toggleVisited(id, cur)      { db.collection('travel_places').doc(id).update({ visited: !cur }); }
function toggleHighlight(id, cur)    { db.collection('travel_places').doc(id).update({ highlighted: !cur }); }

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
      var ckCountry = 'c:' + tab + ':' + country;
      var countryCls = collapseState[ckCountry] === false ? '' : ' collapsed';
      html += '<div class="country-section' + countryCls + '" data-ckey="' + esc(ckCountry) + '">' +
        '<div class="country-header">' + esc(country) +
        ' <span class="section-cnt">' + countryTotal + '</span>' +
        '<button class="btn-quick-add" data-cont="' + esc(tab) + '" data-country="' + esc(country) + '" data-state="" data-city="" data-focus="state" title="Add city / place">+</button>' +
        '<button class="btn-export-country" data-country="' + esc(country) + '" data-cont="' + esc(tab) + '" title="Export for Claude">↓ txt</button>' +
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
          var ckState = 's:' + tab + ':' + country + ':' + state;
          var stateCls = collapseState[ckState] === false ? '' : ' collapsed';
          html += '<div class="state-section' + stateCls + '" data-ckey="' + esc(ckState) + '"><div class="state-header">' + esc(state) +
            ' <span class="section-cnt">' + stateTotal + '</span>' +
            '<button class="btn-quick-add" data-cont="' + esc(tab) + '" data-country="' + esc(country) + '" data-state="' + esc(state) + '" data-city="" data-focus="city" title="Add city / place">+</button>' +
            '</div>';
        }
        Object.keys(byCountry[country][state]).sort().forEach(function(city) {
          var cityItems = byCountry[country][state][city];
          var ckCity = 'v:' + tab + ':' + country + ':' + state + ':' + city;
          var cityCls = collapseState[ckCity] === false ? '' : ' collapsed';
          html += '<div class="city-section' + cityCls + '" data-ckey="' + esc(ckCity) + '"><div class="city-header">' +
            '<span class="city-name-text" data-city="' + esc(city) + '" data-country="' + esc(country) + '" data-state="' + esc(state) + '">' + esc(city) + '</span>' +
            ' <span class="section-cnt">' + cityItems.length + '</span>' +
            '<button class="btn-quick-add" data-cont="' + esc(tab) + '" data-country="' + esc(country) + '" data-state="' + esc(state) + '" data-city="' + esc(city) + '" data-focus="name" title="Add place">+</button>' +
            '</div>';
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
  var icon        = TYPE_ICON[item.type] || '📍';
  var isVisited   = !!item.visited;
  var isHighlight = !!item.highlighted;
  var cardCls = 'card' + (isVisited ? ' visited-card' : '') + (isHighlight ? ' highlighted-card' : '');
  return '<div class="' + cardCls + '" data-id="' + esc(item.id) + '">' +
    '<div class="card-body">' +
      (breadcrumb ? '<div class="search-breadcrumb">' + esc(breadcrumb) + '</div>' : '') +
      '<div class="card-title"><span class="type-icon">' + icon + '</span>' +
        '<span class="item-name">' + esc(item.name) + '</span></div>' +
      (item.description ? '<div class="card-desc">' + esc(item.description) + '</div>' : '') +
    '</div>' +
    '<div class="card-actions">' +
      '<a class="btn-maps" href="' + mapsUrl(item) + '" target="_blank" rel="noopener">Maps</a>' +
      '<a class="btn-google" href="' + googleUrl(item) + '" target="_blank" rel="noopener">Google</a>' +
      '<button class="btn-highlight' + (isHighlight ? ' on' : '') + '" data-id="' + esc(item.id) + '" data-hl="' + isHighlight + '" title="Highlight">🔴</button>' +
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
  document.querySelectorAll('.btn-highlight').forEach(function(b) {
    b.onclick = function() { toggleHighlight(this.dataset.id, this.dataset.hl === 'true'); };
  });
  document.querySelectorAll('.btn-visit').forEach(function(b) {
    b.onclick = function() { toggleVisited(this.dataset.id, this.dataset.visited === 'true'); };
  });
  document.querySelectorAll('.btn-export-country').forEach(function(b) {
    b.onclick = function(e) {
      e.stopPropagation();
      exportCountry(this.dataset.country, this.dataset.cont);
    };
  });
  document.querySelectorAll('.btn-del-country').forEach(function(b) {
    b.onclick = function(e) {
      e.stopPropagation();
      var country = this.dataset.country, tab = this.dataset.cont;
      var toDelete = Object.values(allItems).filter(function(i) {
        return i.country === country && itemTab(i) === tab;
      });
      if (!confirm('Delete all ' + toDelete.length + ' place(s) under ' + country + '? This cannot be undone.')) return;
      toDelete.forEach(function(i) { deleteItem(i.id); });
    };
  });
  // Country collapse
  document.querySelectorAll('.country-header').forEach(function(h) {
    h.onclick = function(e) {
      if (e.target.closest('.btn-quick-add, .btn-del-country, .btn-export-country')) return;
      var sec = this.parentElement;
      collapseState[sec.dataset.ckey] = sec.classList.toggle('collapsed');
    };
  });

  // State collapse
  document.querySelectorAll('.state-header').forEach(function(h) {
    h.onclick = function(e) {
      if (e.target.closest('.btn-quick-add')) return;
      var sec = this.parentElement;
      collapseState[sec.dataset.ckey] = sec.classList.toggle('collapsed');
    };
  });

  // City collapse
  document.querySelectorAll('.city-header').forEach(function(h) {
    h.onclick = function(e) {
      if (e.target.closest('.btn-quick-add')) return;
      var sec = this.parentElement;
      collapseState[sec.dataset.ckey] = sec.classList.toggle('collapsed');
    };
  });

  // Inline city rename (double-click)
  document.querySelectorAll('.city-name-text').forEach(function(span) {
    span.ondblclick = function(e) {
      e.stopPropagation();
      var oldCity = this.dataset.city;
      var country = this.dataset.country;
      var state   = this.dataset.state;
      var inp = document.createElement('input');
      inp.className = 'city-name-inp';
      inp.value = oldCity;
      var parent = this.parentNode;
      parent.replaceChild(inp, this);
      inp.focus();
      inp.select();

      function save() {
        var newCity = inp.value.trim();
        if (!newCity || newCity === oldCity) { renderAll(); return; }
        // Batch update all items in this city atomically
        var toUpdate = Object.values(allItems).filter(function(i) {
          return i.country === country && (i.state || '') === state && i.city === oldCity;
        });
        var batch = db.batch();
        toUpdate.forEach(function(i) {
          batch.update(db.collection('travel_places').doc(i.id), { city: newCity });
        });
        batch.commit().catch(function(err) { console.error('city rename error', err); });
      }
      inp.addEventListener('blur', save);
      inp.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { inp.blur(); }
        if (e.key === 'Escape') { oldCity = inp.value; inp.blur(); }
      });
    };
  });
  document.querySelectorAll('.btn-quick-add').forEach(function(b) {
    b.onclick = function(e) {
      e.stopPropagation();
      var d = this.dataset;
      fContinent.value = d.cont;
      fCountry.value   = d.country;
      fState.value     = d.state;
      fCity.value      = d.city;
      fName.value      = '';
      fDesc.value      = '';
      fType.value      = 'food';
      statusEl.textContent = '';
      confirmBtn.disabled  = false;
      updateCityDatalist(d.country);
      updateStateDatalist(d.country);
      fCountry.setAttribute('list', 'dl-countries-' + d.cont);
      modal.classList.add('open');
      var focusField = { state: fState, city: fCity, name: fName }[d.focus] || fName;
      setTimeout(function() { focusField.focus(); }, 80);
    };
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
  document.getElementById('panel-bucket-list').style.display = 'none';
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

  searchPanel.querySelectorAll('.btn-delete').forEach(function(b)    { b.onclick = function() { deleteItem(this.dataset.id); }; });
  searchPanel.querySelectorAll('.btn-edit').forEach(function(b)      { b.onclick = function() { openEditModal(this.dataset.id); }; });
  searchPanel.querySelectorAll('.btn-highlight').forEach(function(b) { b.onclick = function() { toggleHighlight(this.dataset.id, this.dataset.hl === 'true'); }; });
  searchPanel.querySelectorAll('.btn-visit').forEach(function(b)     { b.onclick = function() { toggleVisited(this.dataset.id, this.dataset.visited === 'true'); }; });
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
    document.getElementById('panel-bucket-list').style.display = (activeTab === 'bucket-list') ? '' : 'none';
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
  fType.value = 'food';
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
  country = normalizeCountry(country);
  confirmBtn.disabled = true;
  addItem({ continent: continent, country: country, state: state||'', city: city||'General', name, type, description: desc, visited: false, addedAt: new Date().toISOString() })
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
    country: normalizeCountry(eCountry.value.trim()), state: eState.value.trim(), city: eCity.value.trim(),
    continent: eContinent.value
  }).then(function() { editModal.classList.remove('open'); editSaveBtn.disabled = false; })
    .catch(function(err) { document.getElementById('edit-status').textContent = 'Error: ' + err.message; editSaveBtn.disabled = false; });
};

// ── Bucket List ────────────────────────────────────────────────────────────

var BL_REGION_ORDER = ['North America','Caribbean','South America','Europe','Asia & Pacific','Middle East','Africa','Oceania'];

function renderBucketList() {
  var panel = document.getElementById('panel-bucket-list');
  if (!panel) return;

  var items = Object.values(bucketList);

  // Group by region then sort by country within each region
  var byRegion = {};
  BL_REGION_ORDER.forEach(function(r) { byRegion[r] = []; });
  items.forEach(function(item) {
    var r = item.region || 'Other';
    if (!byRegion[r]) byRegion[r] = [];
    byRegion[r].push(item);
  });
  Object.keys(byRegion).forEach(function(r) {
    byRegion[r].sort(function(a,b){ return (a.country||'').localeCompare(b.country||''); });
  });

  var html = '<div class="bl-header">' +
    '<div class="bl-title">Bucket List</div>' +
    '<button class="bl-add-btn" id="bl-open">+ Add Country</button>' +
  '</div>';

  var hasAny = false;
  BL_REGION_ORDER.forEach(function(region) {
    var rows = byRegion[region] || [];
    if (!rows.length) return;
    hasAny = true;
    html += '<div class="vc-region"><div class="vc-region-title">' + esc(region) +
      ' <span class="vc-region-cnt">' + rows.length + '</span></div>';

    rows.forEach(function(entry) {
      var items = entry.items || [];
      var itemsHtml = items.map(function(it, idx) {
        return '<li class="bl-item">' +
          '<span class="bl-item-text">' + esc(it) + '</span>' +
          '<input class="bl-item-edit-inp" type="text" value="' + esc(it) + '" style="display:none" data-id="' + esc(entry.id) + '" data-item="' + esc(it) + '">' +
          '<button class="bl-item-edit" data-id="' + esc(entry.id) + '" data-item="' + esc(it) + '" title="Edit">✏️</button>' +
          '<button class="bl-item-save" data-id="' + esc(entry.id) + '" data-item="' + esc(it) + '" style="display:none" title="Save">💾</button>' +
          '<button class="bl-item-del" data-id="' + esc(entry.id) + '" data-item="' + esc(it) + '" title="Delete">✕</button>' +
          '</li>';
      }).join('');

      html += '<div class="bl-row">' +
        '<div class="bl-country-cell">' +
          '<div class="bl-country-name">' + esc(entry.country) + '</div>' +
          '<div class="bl-country-region">' + esc(entry.region) + '</div>' +
          '<div class="bl-country-actions">' +
            '<button class="bl-del-country" data-id="' + esc(entry.id) + '">🗑 Remove</button>' +
          '</div>' +
        '</div>' +
        '<div class="bl-items-cell">' +
          '<ul class="bl-items-list">' + (itemsHtml || '<li class="bl-item" style="color:#ccc;font-style:italic">No items yet</li>') + '</ul>' +
          '<div class="bl-add-item">' +
            '<input type="text" placeholder="Add a place or thing to do…" data-id="' + esc(entry.id) + '">' +
            '<button data-id="' + esc(entry.id) + '">Add</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    });
    html += '</div>';
  });

  if (!hasAny) html += '<p class="empty">No bucket list countries yet. Click + Add Country to start.</p>';

  panel.innerHTML = html;

  // Bind open button
  var openBtn = document.getElementById('bl-open');
  if (openBtn) openBtn.onclick = openBlModal;

  // Delete country
  panel.querySelectorAll('.bl-del-country').forEach(function(b) {
    b.onclick = function() { db.collection('bucket_list').doc(this.dataset.id).delete(); };
  });

  // Edit item — toggle inline edit mode
  panel.querySelectorAll('.bl-item-edit').forEach(function(b) {
    b.onclick = function() {
      var li = this.closest('li');
      li.querySelector('.bl-item-text').style.display = 'none';
      li.querySelector('.bl-item-edit-inp').style.display = '';
      li.querySelector('.bl-item-edit-inp').focus();
      this.style.display = 'none';
      li.querySelector('.bl-item-save').style.display = '';
    };
  });

  // Save item — replace old value with new
  panel.querySelectorAll('.bl-item-save').forEach(function(b) {
    b.onclick = function() {
      var li = this.closest('li');
      var inp = li.querySelector('.bl-item-edit-inp');
      var newVal = inp.value.trim();
      var oldVal = this.dataset.item;
      var docId = this.dataset.id;
      if (!newVal || newVal === oldVal) {
        // cancel: restore display
        li.querySelector('.bl-item-text').style.display = '';
        inp.style.display = 'none';
        li.querySelector('.bl-item-edit').style.display = '';
        this.style.display = 'none';
        return;
      }
      var ref = db.collection('bucket_list').doc(docId);
      db.runTransaction(function(t) {
        return t.get(ref).then(function(doc) {
          var items = (doc.data().items || []).filter(function(i) { return i !== oldVal; });
          if (items.indexOf(newVal) === -1) items.push(newVal);
          t.update(ref, { items: items });
        });
      });
    };
  });

  // Remove item
  panel.querySelectorAll('.bl-item-del').forEach(function(b) {
    b.onclick = function() {
      db.collection('bucket_list').doc(this.dataset.id).update({
        items: firebase.firestore.FieldValue.arrayRemove(this.dataset.item)
      });
    };
  });

  // Add item inline
  panel.querySelectorAll('.bl-add-item button').forEach(function(btn) {
    btn.onclick = function() {
      var inp = this.previousElementSibling;
      var val = inp.value.trim();
      if (!val) return;
      db.collection('bucket_list').doc(this.dataset.id).update({
        items: firebase.firestore.FieldValue.arrayUnion(val)
      }).then(function() { inp.value = ''; });
    };
  });

  // Enter key on inline input
  panel.querySelectorAll('.bl-add-item input').forEach(function(inp) {
    inp.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') this.nextElementSibling.click();
    });
  });
}

// Bucket List modal
var blModal   = document.getElementById('bl-modal');
var blCountry = document.getElementById('bl-country');
var blRegion  = document.getElementById('bl-region');
var blItems   = document.getElementById('bl-items');
var blStatus  = document.getElementById('bl-status');
var blSaveBtn = document.getElementById('bl-save');

function openBlModal() {
  blCountry.value = ''; blItems.value = ''; blStatus.textContent = ''; blSaveBtn.disabled = false;
  blModal.classList.add('open');
  setTimeout(function() { blCountry.focus(); }, 80);
}

document.getElementById('bl-close').onclick = function() { blModal.classList.remove('open'); };
blModal.addEventListener('click', function(e) { if (e.target === blModal) blModal.classList.remove('open'); });

blSaveBtn.onclick = function() {
  var country = blCountry.value.trim();
  var region  = blRegion.value;
  var items   = blItems.value.split('\n').map(function(s){ return s.trim(); }).filter(Boolean);
  if (!country) { blStatus.textContent = 'Country name required.'; return; }
  blSaveBtn.disabled = true;
  db.collection('bucket_list').add({
    country: country, region: region, items: items, addedAt: new Date().toISOString()
  }).then(function() {
    blModal.classList.remove('open');
    blSaveBtn.disabled = false;
    // Switch to bucket-list tab
    var tab = document.querySelector('.tab[data-tab="bucket-list"]');
    if (tab) tab.click();
  }).catch(function(err) {
    blStatus.textContent = 'Error: ' + err.message;
    blSaveBtn.disabled = false;
  });
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

// US state names (lowercase) for bulk-parse detection
var US_STATES = new Set([
  'alabama','alaska','arizona','arkansas','california','colorado','connecticut',
  'delaware','florida','georgia','hawaii','idaho','illinois','indiana','iowa',
  'kansas','kentucky','louisiana','maine','maryland','massachusetts','michigan',
  'minnesota','mississippi','missouri','montana','nebraska','nevada',
  'new hampshire','new jersey','new mexico','new york','north carolina',
  'north dakota','ohio','oklahoma','oregon','pennsylvania','rhode island',
  'south carolina','south dakota','tennessee','texas','utah','vermont',
  'virginia','washington','west virginia','wisconsin','wyoming',
  'district of columbia'
]);

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
  var name, city, countryOverride, stateOverride;

  if (parts.length >= 3) {
    // Work from the right: last token is country, state, or city
    var last   = parts[parts.length - 1];
    var second = parts[parts.length - 2];
    if (US_STATES.has(last.toLowerCase())) {
      // Last is a US state — e.g. "Zu Bakery, Portland, Maine"
      stateOverride = last;
      city = second;
      name = parts.slice(0, parts.length - 2).join(', ');
    } else if (COUNTRY_GEO[last.toLowerCase()]) {
      // Last is a known country — use it; second-to-last is city; rest is name
      countryOverride = last;
      city = second;
      name = parts.slice(0, parts.length - 2).join(', ');
    } else if (CITY_GEO[last.toLowerCase()]) {
      // Last is a known city — everything before is the name
      city = last;
      name = parts.slice(0, parts.length - 1).join(', ');
    } else {
      // Fallback: original behavior
      name = parts[0];
      city = parts[1];
      countryOverride = parts[2] || '';
    }
  } else {
    name = parts[0];
    city = parts[1] || '';
  }

  // Handle "Portland Maine" (no comma) — split off trailing state name
  if (city && !stateOverride) {
    var cityWords = city.split(' ');
    if (cityWords.length >= 2) {
      // Check single last word as state
      var lastWord = cityWords[cityWords.length - 1].toLowerCase();
      if (US_STATES.has(lastWord)) {
        stateOverride = cityWords[cityWords.length - 1];
        city = cityWords.slice(0, -1).join(' ');
      } else if (cityWords.length >= 3) {
        // Check last two words as state (e.g. "New Hampshire")
        var lastTwo = cityWords.slice(-2).join(' ').toLowerCase();
        if (US_STATES.has(lastTwo)) {
          stateOverride = cityWords.slice(-2).join(' ');
          city = cityWords.slice(0, -2).join(' ');
        }
      }
    }
  }

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
  if (!geo.country && !city && !stateOverride) {
    var nl = name.toLowerCase();
    for (var ck in COUNTRY_GEO) {
      if (nl.includes(ck)) { geo = COUNTRY_GEO[ck]; break; }
    }
  }

  // State override always wins (implies USA)
  if (stateOverride) { geo = Object.assign({}, geo, {country: 'USA', state: stateOverride, continent: 'north-america'}); }
  else if (countryOverride) { geo = Object.assign({}, geo, {country: countryOverride}); }

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
      '<td><input class="bulk-state" data-i="' + i + '" value="' + esc(item.state) + '" placeholder="State"></td>' +
      '<td><input class="bulk-country" data-i="' + i + '" value="' + esc(item.country) + '" placeholder="Country"></td>' +
      '<td>' + typeSelect(item.type, i, 'bulk-type') + '</td>' +
      '<td>' + contSelect(item.continent, i, 'bulk-cont') + '</td>' +
      '<td><button class="bulk-row-del" data-i="' + i + '">✕</button></td>' +
    '</tr>';
  }).join('');

  el.innerHTML = '<p class="bulk-count">' + bulkParsed.length + ' items parsed</p>' +
    '<div style="overflow-x:auto">' +
    '<table class="bulk-table"><thead><tr><th>Name</th><th>City</th><th>State</th><th>Country</th><th>Type</th><th>Region</th><th></th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table></div>' +
    '<button id="bulk-import" class="bulk-import-btn">Import ' + bulkParsed.length + ' items →</button>' +
    '<div id="bulk-status" class="bulk-status"></div>';

  el.querySelectorAll('.bulk-name').forEach(function(inp) { inp.oninput = function() { bulkParsed[+this.dataset.i].name = this.value; }; });
  el.querySelectorAll('.bulk-city').forEach(function(inp) { inp.oninput = function() { bulkParsed[+this.dataset.i].city = this.value; }; });
  el.querySelectorAll('.bulk-state').forEach(function(inp) { inp.oninput = function() { bulkParsed[+this.dataset.i].state = this.value; }; });
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

// ── Export for Claude ──────────────────────────────────────────────────────

var TYPE_LABEL = { place: '📍 Place', food: '🍽 Food & Drink', experience: '✨ Experience', accommodation: '🏨 Stay', other: '🔖 Other' };

function exportCountry(country, tab) {
  var contLabel = CONT_LABELS[tab] || tab;
  var lines = [];

  lines.push('TRAVEL NOTES: ' + country + ' (' + contLabel + ')');
  lines.push('Generated: ' + new Date().toLocaleDateString());

  // Visited status
  var isVisited = Object.values(visitedCountries).some(function(v) {
    return v.country.toLowerCase() === country.toLowerCase();
  });
  lines.push('Status: ' + (isVisited ? 'Visited ✓' : 'Not yet visited — bucket list'));
  lines.push('');

  // Bucket list
  var blEntries = Object.values(bucketList).filter(function(b) {
    return b.country.toLowerCase().indexOf(country.toLowerCase()) !== -1;
  });
  if (blEntries.length) {
    lines.push('━━━ BUCKET LIST ━━━');
    blEntries.forEach(function(entry) {
      lines.push(entry.country + ':');
      (entry.items || []).forEach(function(it) { lines.push('  • ' + it); });
    });
    lines.push('');
  }

  // Travel places grouped by state → city
  var countryItems = Object.values(allItems).filter(function(i) {
    return i.country === country;
  });

  if (countryItems.length) {
    lines.push('━━━ PLACES & NOTES ━━━');
    var byState = {};
    countryItems.forEach(function(i) {
      var s = i.state || '';
      var c = i.city || 'General';
      if (!byState[s]) byState[s] = {};
      if (!byState[s][c]) byState[s][c] = [];
      byState[s][c].push(i);
    });
    Object.keys(byState).sort().forEach(function(state) {
      if (state) lines.push('\n— ' + state + ' —');
      Object.keys(byState[state]).sort().forEach(function(city) {
        lines.push('\n' + city);
        byState[state][city].sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); }).forEach(function(item) {
          var label = TYPE_LABEL[item.type] || '📍 Place';
          var visited = item.visited ? ' [visited]' : '';
          var desc = item.description ? '\n      Notes: ' + item.description : '';
          lines.push('  ' + label + ': ' + (item.name || '') + visited + desc);
        });
      });
    });
    lines.push('');
  }

  if (!blEntries.length && !countryItems.length) {
    lines.push('No data saved yet for this country.');
  }

  lines.push('━━━ END ━━━');
  lines.push('Prompt suggestion: Using the above as context, help me plan a trip to ' + country + '. I prefer cultural immersion, local food, and scenic experiences over typical tourist routes.');

  var text = lines.join('\n');
  var blob = new Blob([text], { type: 'text/plain' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = country.replace(/[^a-z0-9]/gi, '_') + '_travel_notes.txt';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Global Export ──────────────────────────────────────────────────────────

var exportModal  = document.getElementById('export-modal');
var exCountryInp = document.getElementById('ex-country');
var exStateInp   = document.getElementById('ex-state');
var exCityInp    = document.getElementById('ex-city');

document.getElementById('open-export').onclick = function() {
  exCountryInp.value = ''; exStateInp.value = ''; exCityInp.value = '';
  exportModal.classList.add('open');
  setTimeout(function() { exCountryInp.focus(); }, 80);
};
document.getElementById('export-close').onclick = function() { exportModal.classList.remove('open'); };
exportModal.addEventListener('click', function(e) { if (e.target === exportModal) exportModal.classList.remove('open'); });

document.getElementById('export-confirm').onclick = function() {
  var filterCountry = exCountryInp.value.trim().toLowerCase();
  var filterState   = exStateInp.value.trim().toLowerCase();
  var filterCity    = exCityInp.value.trim().toLowerCase();

  var items = Object.values(allItems).filter(function(i) {
    if (filterCountry && (i.country || '').toLowerCase() !== filterCountry) return false;
    if (filterState   && (i.state   || '').toLowerCase() !== filterState)   return false;
    if (filterCity    && (i.city    || '').toLowerCase() !== filterCity)     return false;
    return true;
  });

  if (!items.length) { alert('No items match that filter.'); return; }

  var lines = [];
  var titleParts = [];
  if (exCountryInp.value.trim()) titleParts.push(exCountryInp.value.trim());
  if (exStateInp.value.trim())   titleParts.push(exStateInp.value.trim());
  if (exCityInp.value.trim())    titleParts.push(exCityInp.value.trim());
  var title = titleParts.length ? titleParts.join(', ') : 'All Places';

  lines.push('TRAVEL PLACES: ' + title);
  lines.push('Generated: ' + new Date().toLocaleDateString());
  lines.push('Total items: ' + items.length);
  lines.push('');

  // Group by continent → country → state → city
  var byCont = {};
  items.forEach(function(i) {
    var cont    = CONT_LABELS[itemTab(i)] || itemTab(i);
    var country = i.country || 'Unknown';
    var state   = i.state || '';
    var city    = i.city || 'General';
    if (!byCont[cont]) byCont[cont] = {};
    if (!byCont[cont][country]) byCont[cont][country] = {};
    if (!byCont[cont][country][state]) byCont[cont][country][state] = {};
    if (!byCont[cont][country][state][city]) byCont[cont][country][state][city] = [];
    byCont[cont][country][state][city].push(i);
  });

  Object.keys(byCont).sort().forEach(function(cont) {
    lines.push('══════════════════════════════');
    lines.push(cont.toUpperCase());
    lines.push('══════════════════════════════');
    Object.keys(byCont[cont]).sort().forEach(function(country) {
      lines.push('\n▶ ' + country);
      Object.keys(byCont[cont][country]).sort(function(a,b){
        if (a==='' && b!=='') return -1; if (a!=='' && b==='') return 1; return a.localeCompare(b);
      }).forEach(function(state) {
        if (state) lines.push('  — ' + state + ' —');
        Object.keys(byCont[cont][country][state]).sort().forEach(function(city) {
          lines.push('  ' + (state ? '  ' : '') + city);
          byCont[cont][country][state][city]
            .sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); })
            .forEach(function(item) {
              var label = TYPE_LABEL[item.type] || '📍';
              var visited = item.visited ? ' [visited]' : '';
              var desc = item.description ? ' — ' + item.description : '';
              lines.push('  ' + (state ? '  ' : '') + '  • ' + label + ' ' + (item.name||'') + visited + desc);
            });
        });
      });
    });
    lines.push('');
  });

  var filename = (titleParts.join('_') || 'all_places').replace(/[^a-z0-9_]/gi, '_').toLowerCase() + '_travel.txt';
  var blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  exportModal.classList.remove('open');
};

// ── Init ───────────────────────────────────────────────────────────────────

load();
