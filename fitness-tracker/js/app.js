// Fitness Tracker App Logic

let activeTab = 'today';
let libCategory = 'all';
let libComplexity = 'all';
let libSearch = '';
let customExercises = [];
let completions = {};

let _db = null;
function getDb() {
  if (_db) return _db;
  if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
    _db = firebase.firestore();
  }
  return _db;
}

// ── DATE HELPERS ──────────────────────────────────────────────────────────────

function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function getDayOfWeek() {
  return new Date().getDay();
}

// ── COMPLETIONS ───────────────────────────────────────────────────────────────

function loadCompletions() {
  try { return JSON.parse(localStorage.getItem('ft_completions') || '{}'); }
  catch { return {}; }
}

function saveCompletions() {
  localStorage.setItem('ft_completions', JSON.stringify(completions));
}

function isCompleted(exId, dateKey) {
  return completions[dateKey] && completions[dateKey].includes(exId);
}

function toggleCompletion(exId, dateKey) {
  if (!completions[dateKey]) completions[dateKey] = [];
  const idx = completions[dateKey].indexOf(exId);
  if (idx >= 0) completions[dateKey].splice(idx, 1);
  else completions[dateKey].push(exId);
  saveCompletions();
}

// ── CUSTOM EXERCISES ──────────────────────────────────────────────────────────

async function loadCustomExercises() {
  const db = getDb();
  if (db) {
    try {
      const snap = await db.collection('fitness_custom_exercises').orderBy('createdAt','desc').get();
      customExercises = [];
      snap.forEach(doc => customExercises.push({ id: doc.id, ...doc.data(), custom: true }));
      localStorage.setItem('ft_custom', JSON.stringify(customExercises));
      return;
    } catch(e) { console.warn('Firestore load failed:', e); }
  }
  customExercises = JSON.parse(localStorage.getItem('ft_custom') || '[]');
}

async function saveCustomExercise(data) {
  const id = 'custom_' + Date.now();
  const item = { ...data, id, custom: true, createdAt: new Date().toISOString() };

  const db = getDb();
  let savedToFirestore = false;
  if (db) {
    try {
      await db.collection('fitness_custom_exercises').doc(id).set(item);
      savedToFirestore = true;
    } catch(e) {
      console.warn('Firestore write failed:', e);
    }
  }

  customExercises.unshift(item);
  localStorage.setItem('ft_custom', JSON.stringify(customExercises));
  return { item, savedToFirestore };
}

async function deleteCustomExercise(id) {
  const db = getDb();
  if (db) {
    try { await db.collection('fitness_custom_exercises').doc(id).delete(); } catch(e) { console.warn(e); }
  }
  customExercises = customExercises.filter(e => e.id !== id);
  localStorage.setItem('ft_custom', JSON.stringify(customExercises));
}

// ── ALL EXERCISES ─────────────────────────────────────────────────────────────

function allExercises() { return [...EXERCISES, ...customExercises]; }
function getExercise(id) { return allExercises().find(e => e.id === id); }

// ── RENDERING HELPERS ─────────────────────────────────────────────────────────

function esc(str) {
  const el = document.createElement('span');
  el.textContent = str || '';
  return el.innerHTML;
}

function complexityBadge(c) {
  const m = COMPLEXITY[c] || COMPLEXITY.simple;
  return `<span class="badge-complexity" style="color:${m.color};background:${m.bg}">${m.label}</span>`;
}

function hrBadge(hrZone) {
  if (!hrZone) return '';
  return `<span class="badge-hr">❤️ ${hrZone.label} ${hrZone.min}–${hrZone.max} bpm</span>`;
}

function catBadge(cat) {
  const m = CATEGORIES[cat] || { icon: '⚡', label: cat };
  return `<span class="badge-cat">${m.icon} ${m.label}</span>`;
}

function videoLink(url) {
  if (!url) return '';
  return `<a href="${url}" target="_blank" rel="noopener" class="btn-video">▶ Watch Form Video</a>`;
}

function diagramHtml(ex) {
  if (typeof renderDiagram !== 'undefined' && ex.diagramId) {
    return renderDiagram(ex.diagramId);
  }
  return '';
}

// ── TAB SWITCHING ─────────────────────────────────────────────────────────────

function showTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.style.display = p.id === 'panel-' + tab ? '' : 'none');
  if (tab === 'today') renderToday();
  if (tab === 'library') renderLibrary();
}

// ── TODAY TAB ─────────────────────────────────────────────────────────────────

function renderToday() {
  const dayOfWeek = getDayOfWeek();
  const plan = WEEKLY_PLAN[dayOfWeek];
  const key = todayKey();
  const container = document.getElementById('today-content');
  if (!container) return;

  const today = new Date();
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dateStr = `${dayNames[today.getDay()]}, ${months[today.getMonth()]} ${today.getDate()}`;

  const exercises = (plan.exercises || []).map(id => getExercise(id)).filter(Boolean);
  const done = exercises.filter(e => isCompleted(e.id, key)).length;
  const pct = exercises.length ? Math.round(done / exercises.length * 100) : 0;

  let html = `
    <div class="today-header">
      <div>
        <div class="today-date">${esc(dateStr)}</div>
        <div class="today-plan-label">${esc(plan.label)}</div>
        <div class="today-focus">${esc(plan.focus)} &middot; ${esc(plan.duration)}</div>
      </div>
      <div class="today-progress-wrap">
        <div class="progress-ring-label">${done}/${exercises.length}</div>
        <div class="progress-bar-wrap"><div class="progress-bar" style="width:${pct}%"></div></div>
        <div class="progress-pct">${pct}% done</div>
      </div>
    </div>
    <div class="cardiac-notice">⚕️ <strong>Cardiac Safety:</strong> Max HR = 145 bpm. Stop if chest pain, dizziness, or HR &gt; 140.</div>
  `;

  if (plan.cardio) {
    const ce = getExercise(plan.cardio);
    if (ce) {
      html += `<div class="cardio-callout">${hrBadge(ce.hrZone)} <span>Today's cardio: <strong>${esc(ce.name)}</strong> — ${esc(ce.setsReps)}</span></div>`;
    }
  }

  html += '<div class="exercise-list">';
  exercises.forEach(ex => {
    const done = isCompleted(ex.id, key);
    html += `
      <div class="exercise-card ${done ? 'ex-done' : ''}">
        <label class="ex-check-wrap">
          <input type="checkbox" class="ex-check" data-exid="${esc(ex.id)}" ${done ? 'checked' : ''}>
          <span class="ex-check-box"></span>
        </label>
        <div class="ex-body">
          <div class="ex-title-row">
            <span class="ex-name">${esc(ex.name)}</span>
            ${complexityBadge(ex.complexity)}
            ${catBadge(ex.category)}
          </div>
          <div class="ex-sets">${esc(ex.setsReps)}</div>
          ${ex.hrZone ? hrBadge(ex.hrZone) : ''}
          <details class="ex-details">
            <summary>Form cues &amp; video</summary>
            ${diagramHtml(ex)}
            <ul class="cue-list">${(ex.formCues||[]).map(c=>`<li>${esc(c)}</li>`).join('')}</ul>
            ${ex.notes ? `<p class="ex-notes">💡 ${esc(ex.notes)}</p>` : ''}
            ${videoLink(ex.videoUrl)}
          </details>
        </div>
      </div>`;
  });
  html += '</div>';
  if (exercises.length === 0) html += '<p class="empty-state">Rest day — take it easy!</p>';

  container.innerHTML = html;

  container.querySelectorAll('.ex-check').forEach(cb => {
    cb.addEventListener('change', () => {
      toggleCompletion(cb.dataset.exid, key);
      renderToday();
    });
  });
}

// ── LIBRARY TAB ───────────────────────────────────────────────────────────────

function renderLibrary() {
  const container = document.getElementById('library-content');
  if (!container) return;

  let exercises = allExercises();
  if (libCategory !== 'all') exercises = exercises.filter(e => e.category === libCategory);
  if (libComplexity !== 'all') exercises = exercises.filter(e => e.complexity === libComplexity);
  if (libSearch) {
    const q = libSearch.toLowerCase();
    exercises = exercises.filter(e =>
      e.name.toLowerCase().includes(q) ||
      (e.description||'').toLowerCase().includes(q) ||
      (e.notes||'').toLowerCase().includes(q)
    );
  }

  let html = `<div class="lib-count">${exercises.length} exercise${exercises.length !== 1 ? 's' : ''}</div><div class="lib-grid">`;

  exercises.forEach(ex => {
    html += `
      <div class="lib-card">
        <div class="lib-card-top">
          <span class="lib-ex-name">${esc(ex.name)}</span>
          ${ex.custom ? '<span class="badge-custom">Custom</span>' : ''}
        </div>
        <div class="lib-badges">${complexityBadge(ex.complexity)}${catBadge(ex.category)}</div>
        <div class="lib-sets">${esc(ex.setsReps)}</div>
        ${ex.hrZone ? hrBadge(ex.hrZone) : ''}
        ${diagramHtml(ex)}
        <p class="lib-desc">${esc(ex.description || '')}</p>
        <details class="ex-details">
          <summary>Form cues &amp; video</summary>
          <ul class="cue-list">${(ex.formCues||[]).map(c=>`<li>${esc(c)}</li>`).join('')}</ul>
          ${ex.notes ? `<p class="ex-notes">💡 ${esc(ex.notes)}</p>` : ''}
          ${videoLink(ex.videoUrl)}
        </details>
        ${ex.custom ? `<button class="btn-del-custom" data-exid="${esc(ex.id)}">Remove</button>` : ''}
      </div>`;
  });

  html += exercises.length === 0 ? '<p class="empty-state">No exercises match your filters.</p>' : '';
  html += '</div>';
  container.innerHTML = html;

  container.querySelectorAll('.btn-del-custom').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this custom exercise?')) return;
      await deleteCustomExercise(btn.dataset.exid);
      renderLibrary();
    });
  });
}

// ── ADD EXERCISE FORM ─────────────────────────────────────────────────────────

function bindAddForm() {
  const form = document.getElementById('add-ex-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-ex');
    const msgOk = document.getElementById('add-success');
    const msgErr = document.getElementById('add-error');
    if (msgOk) msgOk.style.display = 'none';
    if (msgErr) msgErr.style.display = 'none';

    const name = document.getElementById('ex-name').value.trim();
    if (!name) {
      document.getElementById('ex-name').focus();
      return;
    }

    btn.textContent = 'Saving…';
    btn.disabled = true;

    const data = {
      name,
      category: document.getElementById('ex-category').value,
      complexity: document.getElementById('ex-complexity').value,
      setsReps: document.getElementById('ex-setsreps').value.trim(),
      description: document.getElementById('ex-desc').value.trim(),
      videoUrl: document.getElementById('ex-video').value.trim(),
      notes: document.getElementById('ex-notes-field').value.trim(),
      formCues: document.getElementById('ex-cues').value.split('\n').map(s=>s.trim()).filter(Boolean)
    };

    const result = await saveCustomExercise(data);
    form.reset();
    btn.textContent = 'Save Exercise';
    btn.disabled = false;

    if (msgOk) {
      msgOk.textContent = result.savedToFirestore
        ? `✓ "${name}" saved! Go to Library to see it.`
        : `✓ "${name}" saved locally (Firestore unavailable). Go to Library to see it.`;
      msgOk.style.display = '';
      setTimeout(() => msgOk.style.display = 'none', 5000);
    }
  });
}

// ── INIT ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  completions = loadCompletions();
  await loadCustomExercises();

  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => showTab(btn.dataset.tab));
  });

  const catFilter = document.getElementById('lib-cat-filter');
  if (catFilter) catFilter.addEventListener('change', () => { libCategory = catFilter.value; renderLibrary(); });

  const cxFilter = document.getElementById('lib-cx-filter');
  if (cxFilter) cxFilter.addEventListener('change', () => { libComplexity = cxFilter.value; renderLibrary(); });

  const libSearchEl = document.getElementById('lib-search');
  if (libSearchEl) libSearchEl.addEventListener('input', () => { libSearch = libSearchEl.value.trim(); renderLibrary(); });

  bindAddForm();
  showTab('today');
});
