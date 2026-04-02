// Fitness Tracker App Logic

let activeTab = 'today';
let libCategory = 'all';
let libComplexity = 'all';
let libSearch = '';
let customExercises = [];
let completions = {}; // { 'YYYY-MM-DD': Set of exerciseIds }

// Firebase db reference (set after init)
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

function getDayName(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()];
}

function getDayOfWeek(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.getDay();
}

// ── COMPLETIONS ───────────────────────────────────────────────────────────────

function loadCompletions() {
  try {
    return JSON.parse(localStorage.getItem('ft_completions') || '{}');
  } catch { return {}; }
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
  if (idx >= 0) {
    completions[dateKey].splice(idx, 1);
  } else {
    completions[dateKey].push(exId);
  }
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
    } catch(e) {
      customExercises = JSON.parse(localStorage.getItem('ft_custom') || '[]');
    }
  } else {
    customExercises = JSON.parse(localStorage.getItem('ft_custom') || '[]');
  }
}

async function saveCustomExercise(data) {
  const id = 'custom_' + Date.now();
  const item = { ...data, id, custom: true, createdAt: new Date().toISOString() };
  const db = getDb();
  if (db) {
    try { await db.collection('fitness_custom_exercises').doc(id).set(item); } catch(e) { console.warn(e); }
  }
  customExercises.unshift(item);
  localStorage.setItem('ft_custom', JSON.stringify(customExercises));
  return item;
}

async function deleteCustomExercise(id) {
  const db = getDb();
  if (db) {
    try { await db.collection('fitness_custom_exercises').doc(id).delete(); } catch(e) { console.warn(e); }
  }
  customExercises = customExercises.filter(e => e.id !== id);
  localStorage.setItem('ft_custom', JSON.stringify(customExercises));
}

// ── ALL EXERCISES (built-in + custom) ────────────────────────────────────────

function allExercises() {
  return [...EXERCISES, ...customExercises];
}

function getExercise(id) {
  return allExercises().find(e => e.id === id);
}

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
  return `<span class="badge-hr" title="Target HR: ${hrZone.min}–${hrZone.max} bpm">❤️ ${hrZone.label} ${hrZone.min}–${hrZone.max} bpm</span>`;
}

function catBadge(cat) {
  const m = CATEGORIES[cat] || { icon: '⚡', label: cat };
  return `<span class="badge-cat">${m.icon} ${m.label}</span>`;
}

function videoLink(url) {
  if (!url) return '';
  return `<a href="${url}" target="_blank" rel="noopener" class="btn-video">▶ Watch Form Video</a>`;
}

// ── TAB SWITCHING ─────────────────────────────────────────────────────────────

function showTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.style.display = p.id === 'panel-' + tab ? '' : 'none');
  if (tab === 'today') renderToday();
  if (tab === 'library') renderLibrary();
  if (tab === 'add') { /* static form */ }
  if (tab === 'hr') renderHR();
}

// ── TODAY TAB ─────────────────────────────────────────────────────────────────

function renderToday() {
  const dayOfWeek = getDayOfWeek(0);
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
        <div class="progress-pct">${pct}% complete</div>
      </div>
    </div>
    <div class="cardiac-notice">⚕️ <strong>Cardiac Safety:</strong> Max HR = 145 bpm. If HR exceeds 140 or you feel chest pain/dizziness — stop immediately and rest.</div>
  `;

  if (plan.cardio) {
    const ce = getExercise(plan.cardio);
    if (ce) {
      html += `<div class="cardio-callout">
        ${hrBadge(ce.hrZone)}
        <span>Today's cardio: <strong>${esc(ce.name)}</strong> — ${esc(ce.setsReps)}</span>
      </div>`;
    }
  }

  html += '<div class="exercise-list">';
  exercises.forEach(ex => {
    const done = isCompleted(ex.id, key);
    const cat = CATEGORIES[ex.category] || {};
    html += `
      <div class="exercise-card ${done ? 'ex-done' : ''}" data-exid="${esc(ex.id)}">
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
            <ul class="cue-list">${(ex.formCues||[]).map(c=>`<li>${esc(c)}</li>`).join('')}</ul>
            ${ex.description ? `<p class="ex-desc">${esc(ex.description)}</p>` : ''}
            ${ex.notes ? `<p class="ex-notes">💡 ${esc(ex.notes)}</p>` : ''}
            ${videoLink(ex.videoUrl)}
          </details>
        </div>
      </div>`;
  });
  html += '</div>';

  if (exercises.length === 0) {
    html += '<p class="empty-state">Rest day — take it easy!</p>';
  }

  container.innerHTML = html;

  // Bind checkboxes
  container.querySelectorAll('.ex-check').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = cb.dataset.exid;
      toggleCompletion(id, key);
      renderToday(); // re-render to update progress + styling
    });
  });
}

// ── LIBRARY TAB ───────────────────────────────────────────────────────────────

function renderLibrary() {
  const container = document.getElementById('library-content');
  if (!container) return;

  let exercises = allExercises();

  // Filter
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

  let html = `<div class="lib-count">${exercises.length} exercise${exercises.length !== 1 ? 's' : ''}</div>`;
  html += '<div class="lib-grid">';

  exercises.forEach(ex => {
    const cat = CATEGORIES[ex.category] || {};
    html += `
      <div class="lib-card" data-exid="${esc(ex.id)}">
        <div class="lib-card-top">
          <span class="lib-ex-name">${esc(ex.name)}</span>
          ${ex.custom ? '<span class="badge-custom">Custom</span>' : ''}
        </div>
        <div class="lib-badges">
          ${complexityBadge(ex.complexity)}
          ${catBadge(ex.category)}
        </div>
        <div class="lib-sets">${esc(ex.setsReps)}</div>
        ${ex.hrZone ? hrBadge(ex.hrZone) : ''}
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

  if (exercises.length === 0) {
    html += '<p class="empty-state">No exercises match your filters.</p>';
  }

  html += '</div>';
  container.innerHTML = html;

  // Delete custom
  container.querySelectorAll('.btn-del-custom').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this custom exercise?')) return;
      await deleteCustomExercise(btn.dataset.exid);
      renderLibrary();
    });
  });
}

// ── HR ZONES TAB ──────────────────────────────────────────────────────────────

function renderHR() {
  const container = document.getElementById('hr-content');
  if (!container) return;

  let html = `
    <div class="hr-profile">
      <h3>Your Heart Rate Profile</h3>
      <div class="hr-stats">
        <div class="hr-stat"><span class="hr-num">${HR_ZONES.rhr}</span><span class="hr-lbl">RHR (bpm)</span></div>
        <div class="hr-stat"><span class="hr-num" style="color:#ef4444">${HR_ZONES.max}</span><span class="hr-lbl">Safe Max (bpm)</span></div>
        <div class="hr-stat"><span class="hr-num" style="color:#10b981">76–100</span><span class="hr-lbl">Target Zone 2</span></div>
      </div>
    </div>
    <div class="cardiac-notice">⚕️ Post-MI + stent: never exceed <strong>145 bpm</strong>. Stop if you feel chest pain, palpitations, or dizziness.</div>
    <div class="hr-zones-list">`;

  HR_ZONES.zones.forEach(z => {
    const pct = Math.round((z.max - z.min) / (HR_ZONES.max - HR_ZONES.rhr) * 100);
    html += `
      <div class="hr-zone-row">
        <div class="hz-label">
          <span class="hz-name" style="color:${z.color}">Zone ${z.zone} — ${z.label}</span>
          <span class="hz-range">${z.min}–${z.max} bpm</span>
        </div>
        <div class="hz-bar-wrap"><div class="hz-bar" style="background:${z.color};width:${Math.min(pct,100)}%"></div></div>
        <div class="hz-desc">${z.desc}</div>
      </div>`;
  });

  html += `</div>
    <div class="hr-tips">
      <h4>Training Guidelines</h4>
      <ul>
        <li><strong>80% of your cardio</strong> should be Zone 2 (conversational pace)</li>
        <li>Zone 2 burns fat, improves mitochondrial density, and is cardiac-safe</li>
        <li>Post-meal 10-min walks lower blood glucose significantly — do daily</li>
        <li>Check HR every 5 min during cardio sessions</li>
        <li>Cool down for 5 min before stopping — never stop suddenly</li>
        <li>If HR doesn't drop 12+ bpm in first minute post-exercise, rest more</li>
      </ul>
    </div>`;

  container.innerHTML = html;
}

// ── ADD EXERCISE FORM ─────────────────────────────────────────────────────────

function bindAddForm() {
  const form = document.getElementById('add-ex-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-ex');
    btn.textContent = 'Saving…';
    btn.disabled = true;

    const data = {
      name: document.getElementById('ex-name').value.trim(),
      category: document.getElementById('ex-category').value,
      complexity: document.getElementById('ex-complexity').value,
      setsReps: document.getElementById('ex-setsreps').value.trim(),
      description: document.getElementById('ex-desc').value.trim(),
      videoUrl: document.getElementById('ex-video').value.trim(),
      notes: document.getElementById('ex-notes-field').value.trim(),
      formCues: document.getElementById('ex-cues').value.split('\n').map(s=>s.trim()).filter(Boolean)
    };

    if (!data.name) { btn.textContent = 'Save Exercise'; btn.disabled = false; return; }

    await saveCustomExercise(data);
    form.reset();
    btn.textContent = 'Save Exercise';
    btn.disabled = false;

    // Show success
    const msg = document.getElementById('add-success');
    if (msg) { msg.style.display = ''; setTimeout(() => msg.style.display = 'none', 3000); }
  });
}

// ── INIT ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  completions = loadCompletions();
  await loadCustomExercises();

  // Nav tabs
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => showTab(btn.dataset.tab));
  });

  // Library filters
  const catFilter = document.getElementById('lib-cat-filter');
  if (catFilter) {
    catFilter.addEventListener('change', () => { libCategory = catFilter.value; renderLibrary(); });
  }
  const cxFilter = document.getElementById('lib-cx-filter');
  if (cxFilter) {
    cxFilter.addEventListener('change', () => { libComplexity = cxFilter.value; renderLibrary(); });
  }
  const libSearchEl = document.getElementById('lib-search');
  if (libSearchEl) {
    libSearchEl.addEventListener('input', () => { libSearch = libSearchEl.value.trim(); renderLibrary(); });
  }

  bindAddForm();
  showTab('today');
});
