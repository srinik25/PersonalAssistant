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

// ── AI ENRICHMENT ─────────────────────────────────────────────────────────────

async function enrichExercise(ex) {
  if (!window.OPENAI_API_KEY) return ex;
  const needsDesc = !ex.description;
  const needsCues = !ex.formCues || ex.formCues.length === 0;
  const needsVideo = !ex.videoUrl;
  if (!needsDesc && !needsCues && !needsVideo) return ex;

  if (needsVideo) {
    const q = encodeURIComponent(ex.name + ' proper form technique');
    ex.videoUrl = `https://www.youtube.com/results?search_query=${q}`;
  }

  if (!needsDesc && !needsCues) return ex;

  const prompt = `You are a fitness expert. For the exercise "${ex.name}" (category: ${ex.category}, complexity: ${ex.complexity}):
${needsDesc ? '- Write a 1-2 sentence description: what muscles it targets and why it\'s useful.' : ''}
${needsCues ? '- List exactly 4 form cues: short, actionable instructions (under 10 words each).' : ''}

Respond ONLY with valid JSON, no markdown: {"description": "...", "formCues": ["...", "...", "...", "..."]}`;

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${window.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.3 })
    });
    const data = await resp.json();
    const raw = data.choices[0].message.content.trim().replace(/^```json\n?|\n?```$/g, '');
    const parsed = JSON.parse(raw);
    if (needsDesc && parsed.description) ex.description = parsed.description;
    if (needsCues && parsed.formCues && parsed.formCues.length > 0) ex.formCues = parsed.formCues;
  } catch(e) {
    console.warn('AI enrichment failed for', ex.name, e);
  }
  return ex;
}

// ── CUSTOM EXERCISES ──────────────────────────────────────────────────────────

async function loadCustomExercises() {
  const db = getDb();
  if (db) {
    try {
      const snap = await db.collection('fitness_custom_exercises').orderBy('createdAt','desc').get();
      customExercises = [];
      const backfills = [];
      snap.forEach(doc => {
        const ex = { id: doc.id, ...doc.data(), custom: true };
        if (ex.name && !ex.diagramId) {
          const detected = autoDetectExercise(ex.name).diagramId;
          if (detected) {
            ex.diagramId = detected;
            backfills.push({ id: doc.id, diagramId: detected });
          }
        }
        customExercises.push(ex);
      });
      // Save backfilled diagramIds to Firestore silently
      backfills.forEach(({ id, diagramId }) => {
        db.collection('fitness_custom_exercises').doc(id).update({ diagramId }).catch(() => {});
      });
      localStorage.setItem('ft_custom', JSON.stringify(customExercises));

      // Enrich exercises missing description or formCues (runs async in background)
      const needsEnrich = customExercises.filter(ex => !ex.description || !ex.formCues || ex.formCues.length === 0 || !ex.videoUrl);
      if (needsEnrich.length > 0) {
        (async () => {
          for (const ex of needsEnrich) {
            await enrichExercise(ex);
            const update = {};
            if (ex.description) update.description = ex.description;
            if (ex.formCues && ex.formCues.length > 0) update.formCues = ex.formCues;
            if (ex.videoUrl) update.videoUrl = ex.videoUrl;
            if (Object.keys(update).length > 0) {
              db.collection('fitness_custom_exercises').doc(ex.id).update(update).catch(() => {});
            }
          }
          localStorage.setItem('ft_custom', JSON.stringify(customExercises));
          if (activeTab === 'library') renderLibrary();
        })();
      }
      return;
    } catch(e) { console.warn('Firestore load failed:', e); }
  }
  customExercises = JSON.parse(localStorage.getItem('ft_custom') || '[]');
  // Backfill localStorage entries missing diagramId, description, formCues, or videoUrl
  let changed = false;
  customExercises.forEach(ex => {
    if (ex.name && !ex.diagramId) {
      const detected = autoDetectExercise(ex.name).diagramId;
      if (detected) { ex.diagramId = detected; changed = true; }
    }
    if (ex.name && !ex.videoUrl) {
      const q = encodeURIComponent(ex.name + ' proper form technique');
      ex.videoUrl = `https://www.youtube.com/results?search_query=${q}`;
      changed = true;
    }
  });
  if (changed) localStorage.setItem('ft_custom', JSON.stringify(customExercises));
  // AI enrichment for missing description/formCues (best-effort, no Firestore to write back)
  const needsEnrich = customExercises.filter(ex => !ex.description || !ex.formCues || ex.formCues.length === 0);
  if (needsEnrich.length > 0) {
    (async () => {
      for (const ex of needsEnrich) await enrichExercise(ex);
      localStorage.setItem('ft_custom', JSON.stringify(customExercises));
      if (activeTab === 'library') renderLibrary();
    })();
  }
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
  return `<span class="badge-hr">${hrZone.label} ${hrZone.min}–${hrZone.max} bpm</span>`;
}

function catBadge(cat) {
  const m = CATEGORIES[cat] || { label: cat };
  return `<span class="badge-cat">${m.label}</span>`;
}

function videoLink(url) {
  if (!url) return '';
  return `<a href="${url}" target="_blank" rel="noopener" class="btn-video">&#9654; Watch Form Video</a>`;
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
            ${ex.notes ? `<p class="ex-notes">${esc(ex.notes)}</p>` : ''}
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
          ${ex.notes ? `<p class="ex-notes">${esc(ex.notes)}</p>` : ''}
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

// ── AUTO-DETECT EXERCISE ATTRIBUTES ──────────────────────────────────────────

function autoDetectExercise(name) {
  const n = name.toLowerCase();

  // Category
  let category = 'core';
  if (/walk|run|bike|elliptical|row.*machine|cycling|jog|treadmill|cardio|swimming/.test(n)) category = 'cardio';
  else if (/press|push.?up|pull|shoulder|chest|tricep|bicep|lat|fly|raise|curl|row(?!.*machine)|face.?pull|shrug/.test(n)) category = 'upper';
  else if (/squat|lunge|leg|glute|hip|calf|step.?up|bridge|deadlift|hamstring|quad|clamshell/.test(n)) category = 'lower';
  else if (/stretch|foam|yoga|rotation|thoracic|mobility|pendulum/.test(n)) category = 'mobility';
  else if (/breath|meditat|rest|recover/.test(n)) category = 'recovery';
  else if (/plank|crunch|sit.?up|mountain|dead.?bug|ab|bird.?dog|core|climb/.test(n)) category = 'core';

  // Complexity
  let complexity = 'moderate';
  if (/walk|bike|stretch|foam|breath|elliptical|stationary|chin.?tuck|shrug|neck/.test(n)) complexity = 'simple';
  else if (/mountain.?climb|burpee|clean|snatch|turkish|olympic|plyometric/.test(n)) complexity = 'complex';

  // Diagram
  let diagramId = '';
  if (/mountain.?climb/.test(n)) diagramId = 'plank';
  else if (/push.?up/.test(n)) diagramId = 'push_up';
  else if (/side.?plank|copenhagen/.test(n)) diagramId = 'side_plank';
  else if (/plank/.test(n)) diagramId = 'plank';
  else if (/bird.?dog/.test(n)) diagramId = 'bird_dog';
  else if (/dead.?bug/.test(n)) diagramId = 'lying_back_dead_bug';
  else if (/glute.?bridge|hip.?bridge|bridge/.test(n)) diagramId = 'lying_back_bridge';
  else if (/leg.?raise/.test(n)) diagramId = 'lying_back_leg_raise';
  else if (/squat/.test(n)) diagramId = 'squat';
  else if (/lunge/.test(n)) diagramId = 'kneeling_lunge';
  else if (/step.?up/.test(n)) diagramId = 'step_up';
  else if (/wall.?sit/.test(n)) diagramId = 'wall_sit';
  else if (/wall.?slide/.test(n)) diagramId = 'wall_slides';
  else if (/clamshell/.test(n)) diagramId = 'lying_side_clamshell';
  else if (/ab.?wheel/.test(n)) diagramId = 'ab_wheel';
  else if (/all.?four/.test(n)) diagramId = 'all_fours';
  else if (/row(?!.*machine)/.test(n)) diagramId = 'bent_over_row';
  else if (/overhead.?press|shoulder.?press/.test(n)) diagramId = 'standing_arms_overhead';
  else if (/press.?forward|chest.?press/.test(n)) diagramId = 'standing_press_forward';
  else if (/curl/.test(n)) diagramId = 'standing_arm_curl';
  else if (/elliptical/.test(n)) diagramId = 'elliptical';
  else if (/rowing.?machine|row.*machine/.test(n)) diagramId = 'rowing_machine';
  else if (/walk|treadmill/.test(n)) diagramId = 'walking';
  else if (/breath/.test(n)) diagramId = 'sitting_breathing';
  else if (/child|yoga/.test(n)) diagramId = 'yoga_child';
  else if (/foam.?roll/.test(n)) diagramId = 'foam_roller';
  else if (/neck/.test(n)) diagramId = 'neck_side_stretch';
  else if (/chin.?tuck/.test(n)) diagramId = 'chin_tuck';
  else if (/face.?pull/.test(n)) diagramId = 'face_pull';
  else if (/shrug/.test(n)) diagramId = 'shrug_release';
  else if (/thoracic/.test(n)) diagramId = 'thoracic_rotation';
  else if (/hamstring/.test(n)) diagramId = 'hamstring_stretch_lying';
  else if (/world.*greatest/.test(n)) diagramId = 'worlds_greatest_stretch';
  else if (category === 'cardio') diagramId = 'walking';
  else if (category === 'core') diagramId = 'plank';
  else if (category === 'lower') diagramId = 'standing';
  else if (category === 'upper') diagramId = 'standing';
  else if (category === 'mobility') diagramId = 'standing';
  else if (category === 'recovery') diagramId = 'sitting_breathing';

  return { category, complexity, diagramId };
}

// ── ADD EXERCISE FORM ─────────────────────────────────────────────────────────

function bindAddForm() {
  const form = document.getElementById('add-ex-form');
  if (!form) return;

  const preview = document.getElementById('diagram-preview');
  const hiddenDiagram = document.getElementById('ex-diagram-id');
  const overrideSel = document.getElementById('ex-diagram-override');

  function updateDiagramPreview(id) {
    if (!preview) return;
    if (id && typeof renderDiagram !== 'undefined') {
      preview.innerHTML = renderDiagram(id);
      preview.style.display = '';
    } else {
      preview.innerHTML = '';
      preview.style.display = 'none';
    }
  }

  // Auto-detect on name input
  const nameInput = document.getElementById('ex-name');
  if (nameInput) {
    let detectTimer;
    nameInput.addEventListener('input', () => {
      clearTimeout(detectTimer);
      detectTimer = setTimeout(() => {
        const name = nameInput.value.trim();
        if (!name) return;
        const { category, complexity, diagramId } = autoDetectExercise(name);
        document.getElementById('ex-category').value = category;
        document.getElementById('ex-complexity').value = complexity;
        if (hiddenDiagram) hiddenDiagram.value = diagramId;
        if (overrideSel) overrideSel.value = diagramId;
        updateDiagramPreview(diagramId);
      }, 400);
    });
  }

  // Override diagram picker
  if (overrideSel) {
    overrideSel.addEventListener('change', () => {
      const id = overrideSel.value;
      if (hiddenDiagram) hiddenDiagram.value = id;
      updateDiagramPreview(id);
    });
  }

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

    const diagramId = document.getElementById('ex-diagram-id') ? document.getElementById('ex-diagram-id').value : '';

    const data = {
      name,
      category: document.getElementById('ex-category').value,
      complexity: document.getElementById('ex-complexity').value,
      setsReps: document.getElementById('ex-setsreps').value.trim(),
      description: document.getElementById('ex-desc').value.trim(),
      diagramId,
      videoUrl: document.getElementById('ex-video').value.trim(),
      notes: document.getElementById('ex-notes-field').value.trim(),
      formCues: document.getElementById('ex-cues').value.split('\n').map(s=>s.trim()).filter(Boolean)
    };

    if (!data.description || data.formCues.length === 0 || !data.videoUrl) {
      btn.textContent = 'Analyzing…';
      await enrichExercise(data);
    }

    const result = await saveCustomExercise(data);
    form.reset();
    btn.textContent = 'Save Exercise';
    btn.disabled = false;

    // Reset diagram preview
    updateDiagramPreview('');
    if (hiddenDiagram) hiddenDiagram.value = '';
    if (overrideSel) overrideSel.value = '';

    if (msgOk) {
      msgOk.textContent = result.savedToFirestore
        ? `Saved! "${name}" added to your library.`
        : `"${name}" saved locally (Firestore unavailable). Check your library.`;
      msgOk.style.display = '';
      setTimeout(() => { msgOk.style.display = 'none'; }, 5000);
    }

    setTimeout(() => showTab('library'), 1500);
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
