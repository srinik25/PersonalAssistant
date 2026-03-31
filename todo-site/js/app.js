// Tasks — Year → Month → Week hierarchy
// Firestore: todo_tasks

var TASK_TYPES = ['health','financial','travel','house','garden','personal','work','other'];
var TYPE_LABEL = { health:'🏃 Health', financial:'💰 Financial', travel:'✈️ Travel', house:'🏠 House', garden:'🌿 Garden', personal:'🧘 Personal', work:'💼 Work', other:'📌 Other' };
var TYPE_COLOR = { health:'#059669', financial:'#d97706', travel:'#2563eb', house:'#7c3aed', garden:'#16a34a', personal:'#db2777', work:'#0891b2', other:'#64748b' };

var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// 2026 starts at April (index 3), future years start at January (index 0)
var YEAR_START = { 2026: 3 }; // month index (0-based)
function yearMonths(year) {
  var start = YEAR_START[year] !== undefined ? YEAR_START[year] : 0;
  var result = [];
  for (var i = start; i < 12; i++) result.push(i + 1); // 1-based month numbers
  return result;
}

// Week date ranges within a month
function weekRanges(year, month) {
  var weeks = [];
  var daysInMonth = new Date(year, month, 0).getDate();
  var starts = [1, 8, 15, 22];
  starts.forEach(function(s, i) {
    var end = i < 3 ? s + 6 : daysInMonth;
    if (s <= daysInMonth) weeks.push({ num: i + 1, label: 'Week ' + (i+1) + ' · ' + MONTHS[month-1] + ' ' + s + '–' + end });
  });
  return weeks;
}

// ── State ─────────────────────────────────────────────────────────────────
var tasks      = {};
var activeTab  = '2026';      // year string or 'backlog'
var activeView = 'year';      // 'year' or month number (1-12)

// ── Firestore ──────────────────────────────────────────────────────────────
function load() {
  db.collection('todo_tasks').onSnapshot(function(snap) {
    tasks = {};
    snap.forEach(function(doc) { tasks[doc.id] = Object.assign({ id: doc.id }, doc.data()); });
    render();
  });
}

function addTask(data)         { return db.collection('todo_tasks').add(Object.assign({ createdAt: new Date().toISOString() }, data)); }
function saveTask(id, data)    { return db.collection('todo_tasks').doc(id).update(Object.assign({ updatedAt: new Date().toISOString() }, data)); }
function removeTask(id)        { return db.collection('todo_tasks').doc(id).delete(); }

function markDone(id, done) {
  var updates = [saveTask(id, { status: done ? 'done' : 'pending' })];
  // Propagate up the parentId chain
  var cur = tasks[id];
  while (done && cur && cur.parentId && tasks[cur.parentId]) {
    updates.push(saveTask(cur.parentId, { status: 'done' }));
    cur = tasks[cur.parentId];
  }
  return Promise.all(updates);
}

function copyTask(srcId, targetLevel, targetYear, targetMonth, targetWeek) {
  var src = tasks[srcId];
  var tMonth  = targetMonth  || null;
  var tWeek   = targetWeek   || null;
  // Prevent duplicate: if an identical copy already exists at this destination, skip
  var existing = Object.values(tasks).find(function(t) {
    return t.parentId === srcId && t.level === targetLevel &&
           t.year === targetYear && t.month === tMonth && t.weekNum === tWeek;
  });
  if (existing) return Promise.resolve({ duplicate: true });
  return addTask({
    title:       src.title,
    description: src.description || '',
    type:        src.type || 'other',
    level:       targetLevel,
    year:        targetYear,
    month:       tMonth,
    weekNum:     tWeek,
    status:      'pending',
    parentId:    srcId
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function allYears() {
  var set = new Set([2026]);
  Object.values(tasks).forEach(function(t) { if (t.year) set.add(Number(t.year)); });
  return Array.from(set).sort();
}

function tasksFor(level, year, month, weekNum) {
  return Object.values(tasks).filter(function(t) {
    if (t.level !== level) return false;
    if (level === 'backlog') return true;
    if (t.year !== year) return false;
    if (level === 'year') return true;
    if (t.month !== month) return false;
    if (level === 'month') return true;
    return t.weekNum === weekNum;
  }).sort(function(a,b){ return (a.createdAt||'').localeCompare(b.createdAt||''); });
}

function progress(list) {
  if (!list.length) return null;
  var done = list.filter(function(t){ return t.status === 'done'; }).length;
  return { done: done, total: list.length, pct: Math.round(done / list.length * 100) };
}

function linkedCount(parentId) {
  return Object.values(tasks).filter(function(t){ return t.parentId === parentId; }).length;
}

// ── Render ─────────────────────────────────────────────────────────────────
function render() {
  renderYearTabs();
  renderMonthNav();
  renderMain();
}

function renderYearTabs() {
  var years = allYears();
  var html = years.map(function(y) {
    var cls = 'ytab' + (activeTab === String(y) ? ' active' : '');
    return '<button class="' + cls + '" data-year="' + y + '">' + y + '</button>';
  }).join('');
  html += '<button class="ytab backlog-tab' + (activeTab === 'backlog' ? ' active' : '') + '" data-year="backlog">📋 Backlog</button>';
  document.getElementById('year-tabs').innerHTML = html;
  document.querySelectorAll('.ytab').forEach(function(b) {
    b.onclick = function() {
      activeTab = this.dataset.year;
      if (activeTab !== 'backlog') activeView = 'year';
      render();
    };
  });
}

function renderMonthNav() {
  var wrap = document.getElementById('month-nav-wrap');
  if (activeTab === 'backlog') { wrap.innerHTML = ''; return; }
  var year = Number(activeTab);
  var months = yearMonths(year);
  var html = '<div class="month-nav"><button class="mtab' + (activeView === 'year' ? ' active' : '') + '" data-view="year">📅 Year</button>';
  months.forEach(function(m) {
    var cls = 'mtab' + (activeView === m ? ' active' : '');
    html += '<button class="' + cls + '" data-view="' + m + '">' + MONTHS[m-1] + '</button>';
  });
  html += '</div>';
  wrap.innerHTML = html;
  wrap.querySelectorAll('.mtab').forEach(function(b) {
    b.onclick = function() {
      activeView = this.dataset.view === 'year' ? 'year' : Number(this.dataset.view);
      render();
    };
  });
}

function renderMain() {
  var el = document.getElementById('main-content');
  if (activeTab === 'backlog') { el.innerHTML = renderBacklogHTML(); bindMain(); updateSidebar(); return; }
  var year = Number(activeTab);
  if (activeView === 'year') { el.innerHTML = renderYearHTML(year); bindMain(); updateSidebar(); return; }
  el.innerHTML = renderMonthHTML(year, Number(activeView));
  bindMain();
  updateSidebar();
}

// ── Year view ──────────────────────────────────────────────────────────────
function renderYearHTML(year) {
  var list = tasksFor('year', year);
  var prog = progress(list);
  var byType = groupByType(list);
  var html = '<div class="section-title"><span>Year ' + year + ' Tasks</span>' +
    (prog ? '<span class="cnt">' + prog.done + ' / ' + prog.total + '</span>' : '') +
    '</div>';
  if (prog) html += progressBarHTML(prog.pct);
  html += renderGroupedTasks(byType, 'year', year, null, null);
  return html;
}

// ── Month view ─────────────────────────────────────────────────────────────
function renderMonthHTML(year, month) {
  var monthTasks = tasksFor('month', year, month);
  var prog = progress(monthTasks);

  // Left panel: month-level tasks
  var leftHTML = '<div class="month-panel">' +
    '<div class="month-panel-title">Monthly' +
      (prog ? ' <span class="cnt">' + prog.done + '/' + prog.total + '</span>' : '') +
    '</div>' +
    (prog ? progressBarHTML(prog.pct) : '') +
    renderGroupedTasks(groupByType(monthTasks), 'month', year, month, null) +
  '</div>';

  // Right panel: weeks
  var weeks = weekRanges(year, month);
  var weeksHTML = weeks.map(function(w) {
    var weekTasks = tasksFor('week', year, month, w.num);
    var wp = progress(weekTasks);
    return '<div class="week-card" id="week-' + w.num + '">' +
      '<div class="week-card-title" data-week="' + w.num + '">' +
        esc(w.label) +
        (wp ? '<span class="cnt">' + wp.done + '/' + wp.total + '</span>' : '') +
      '</div>' +
      '<div class="week-card-body">' +
        renderGroupedTasks(groupByType(weekTasks), 'week', year, month, w.num) +
      '</div>' +
    '</div>';
  }).join('');

  var rightHTML = '<div class="weeks-panel">' + weeksHTML + '</div>';

  return '<div class="section-title"><span>' + MONTHS[month-1] + ' ' + year + '</span></div>' +
    '<div class="month-split">' + leftHTML + rightHTML + '</div>';
}

// ── Backlog view ───────────────────────────────────────────────────────────
function renderBacklogHTML() {
  var list = tasksFor('backlog');
  var byType = groupByType(list);
  var html = '<div class="section-title"><span>Backlog</span>' +
    (list.length ? '<span class="cnt">' + list.length + '</span>' : '') +
    '</div>';
  html += renderGroupedTasks(byType, 'backlog', null, null, null);
  return html;
}

// ── Group tasks by type ────────────────────────────────────────────────────
function groupByType(list) {
  var groups = {};
  list.forEach(function(t) {
    var tp = t.type || 'other';
    if (!groups[tp]) groups[tp] = [];
    groups[tp].push(t);
  });
  return groups;
}

function renderGroupedTasks(byType, level, year, month, weekNum) {
  var allTasks = [];
  TASK_TYPES.forEach(function(tp) { if (byType[tp]) allTasks = allTasks.concat(byType[tp]); });
  if (!allTasks.length) return '<p class="empty">No tasks yet.</p>';

  var html = '';
  TASK_TYPES.forEach(function(tp) {
    if (!byType[tp] || !byType[tp].length) return;
    var color = TYPE_COLOR[tp];
    html += '<div class="type-group">' +
      '<div class="type-group-header" style="color:' + color + ';border-bottom-color:' + color + '22">' +
        TYPE_LABEL[tp] +
        ' <span class="type-cnt">' + byType[tp].length + '</span>' +
      '</div>' +
      renderTaskList(byType[tp], level) +
      '</div>';
  });
  return html;
}

function renderTaskList(list, level) {
  if (!list.length) return '';
  var html = '<ul class="task-list">';
  list.forEach(function(t) {
    html += renderTaskItem(t, level);
  });
  html += '</ul>';
  return html;
}

function renderTaskItem(t, level) {
  var done      = t.status === 'done';
  var important = !!t.important;
  var cls       = 'task-item' + (done ? ' done' : '') + (important ? ' important' : '');
  var chkCls    = 'task-check' + (done ? ' checked' : '');
  var color    = TYPE_COLOR[t.type || 'other'];
  var linked   = linkedCount(t.id);
  var linkBadge = linked ? '<span class="task-linked">↓ ' + linked + ' copied</span>' : '';
  var parentTask = t.parentId && tasks[t.parentId];
  var parentBadge = parentTask ? '<span class="task-linked" style="background:#eff6ff;color:#2563eb;border-color:#bfdbfe;">↑ from ' + esc(parentTask.title.slice(0,24)) + '</span>' : '';

  var copyBtn = '<button class="btn-copy-down btn-copy" data-id="' + esc(t.id) + '" title="Copy to month or week">↓ Copy to…</button>';

  var doneBadge = done ? '<span class="task-done-badge">✓ Done</span>' : '';
  var starBtn = '<button class="btn-star btn-toggle-star" data-id="' + esc(t.id) + '" data-important="' + important + '" title="Mark important">★</button>';

  return '<li class="' + cls + '" data-id="' + esc(t.id) + '">' +
    starBtn +
    '<div class="' + chkCls + '" data-id="' + esc(t.id) + '" data-done="' + done + '"></div>' +
    '<div class="task-body">' +
      '<div class="task-title" style="border-left:3px solid ' + color + ';padding-left:6px">' + esc(t.title) + doneBadge + '</div>' +
      (t.description ? '<div class="task-desc">' + esc(t.description) + '</div>' : '') +
      '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;">' + linkBadge + parentBadge + '</div>' +
    '</div>' +
    '<div class="task-actions">' +
      copyBtn +
      '<button class="btn-task btn-edit-task" data-id="' + esc(t.id) + '" title="Edit">✏️</button>' +
      '<button class="btn-task del btn-del-task" data-id="' + esc(t.id) + '" title="Delete">✕</button>' +
    '</div>' +
  '</li>';
}

function progressBarHTML(pct) {
  return '<div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:' + pct + '%"></div></div>';
}


// ── Bind events ────────────────────────────────────────────────────────────
function bindMain() {
  // Week collapse (card layout)
  document.querySelectorAll('.week-card-title').forEach(function(h) {
    h.onclick = function() { this.closest('.week-card').classList.toggle('collapsed'); };
  });

  // Star / important
  document.querySelectorAll('.btn-toggle-star').forEach(function(b) {
    b.onclick = function() {
      var isImportant = this.dataset.important === 'true';
      saveTask(this.dataset.id, { important: !isImportant });
    };
  });

  // Check / uncheck
  document.querySelectorAll('.task-check').forEach(function(c) {
    c.onclick = function() {
      var done = this.dataset.done === 'true';
      markDone(this.dataset.id, !done);
    };
  });

  // Delete
  document.querySelectorAll('.btn-del-task').forEach(function(b) {
    b.onclick = function() {
      if (!confirm('Delete this task?')) return;
      removeTask(this.dataset.id);
    };
  });

  // Edit
  document.querySelectorAll('.btn-edit-task').forEach(function(b) {
    b.onclick = function() { openTaskModal('edit', this.dataset.id); };
  });

  // Copy
  document.querySelectorAll('.btn-copy').forEach(function(b) {
    b.onclick = function() { openCopyModal(this.dataset.id); };
  });

}

// ── Add/Edit Modal ─────────────────────────────────────────────────────────
var taskModal    = document.getElementById('task-modal');
var tTitle       = document.getElementById('t-title');
var tDesc        = document.getElementById('t-desc');
var taskModalSave= document.getElementById('task-modal-save');
var taskModalStatus = document.getElementById('task-modal-status');
var editingTaskId   = null;
var addingContext   = null; // {level, year, month, weekNum}

function openTaskModal(mode, id, ctx) {
  var tType = document.getElementById('t-type');
  taskModalStatus.textContent = '';
  if (mode === 'edit') {
    var t = tasks[id];
    document.getElementById('task-modal-title').textContent = 'Edit Task';
    tTitle.value = t.title || '';
    tDesc.value  = t.description || '';
    tType.value  = t.type || 'other';
    editingTaskId = id;
    addingContext = null;
  } else {
    document.getElementById('task-modal-title').textContent = 'Add Task';
    tTitle.value = '';
    tDesc.value  = '';
    tType.value  = 'other';
    editingTaskId = null;
    addingContext = ctx;
  }
  taskModal.classList.add('open');
  setTimeout(function() { tTitle.focus(); }, 60);
}

document.getElementById('task-modal-cancel').onclick = function() { taskModal.classList.remove('open'); };
taskModal.addEventListener('click', function(e) { if (e.target === taskModal) taskModal.classList.remove('open'); });

taskModalSave.onclick = function() {
  var title = tTitle.value.trim();
  var tType = document.getElementById('t-type');
  if (!title) { taskModalStatus.textContent = 'Title is required.'; return; }
  taskModalSave.disabled = true;
  var data = { title: title, description: tDesc.value.trim(), type: tType.value };
  var p;
  if (editingTaskId) {
    p = saveTask(editingTaskId, data);
  } else {
    p = addTask(Object.assign(data, {
      level:   addingContext.level,
      year:    addingContext.year   || null,
      month:   addingContext.month  || null,
      weekNum: addingContext.weekNum || null,
      status:  'pending',
      parentId: null
    }));
  }
  p.then(function() {
    taskModal.classList.remove('open');
    taskModalSave.disabled = false;
  }).catch(function(err) {
    taskModalStatus.textContent = 'Error: ' + err.message;
    taskModalSave.disabled = false;
  });
};

// ── Copy Modal ─────────────────────────────────────────────────────────────
var copyModal      = document.getElementById('copy-modal');
var copyYear       = document.getElementById('copy-year');
var copyLevel      = document.getElementById('copy-level');
var copyMonth      = document.getElementById('copy-month');
var copyWeek       = document.getElementById('copy-week');
var copyWeekWrap   = document.getElementById('copy-week-wrap');
var copyModalSave  = document.getElementById('copy-modal-save');
var copyModalStatus= document.getElementById('copy-modal-status');
var copyingSrcId   = null;

document.getElementById('copy-modal-cancel').onclick = function() { copyModal.classList.remove('open'); };
copyModal.addEventListener('click', function(e) { if (e.target === copyModal) copyModal.classList.remove('open'); });

function openCopyModal(srcId) {
  copyingSrcId = srcId;
  var t = tasks[srcId];
  document.getElementById('copy-task-title').textContent = t.title;
  copyModalStatus.textContent = '';

  // Populate year options
  var years = allYears();
  copyYear.innerHTML = years.map(function(y) {
    return '<option value="' + y + '"' + (y === (Number(activeTab)||2026) ? ' selected' : '') + '>' + y + '</option>';
  }).join('');

  updateCopyMonthOptions();
  updateCopyWeekVisibility();
  copyModal.classList.add('open');
}

function updateCopyMonthOptions() {
  var year = Number(copyYear.value) || 2026;
  var months = yearMonths(year);
  copyMonth.innerHTML = months.map(function(m) { return '<option value="' + m + '">' + MONTHS[m-1] + '</option>'; }).join('');
}

function updateCopyWeekVisibility() {
  copyWeekWrap.style.display = copyLevel.value === 'week' ? '' : 'none';
}

copyYear.onchange = updateCopyMonthOptions;
copyLevel.onchange = updateCopyWeekVisibility;

copyModalSave.onclick = function() {
  var year    = Number(copyYear.value);
  var level   = copyLevel.value;
  var month   = Number(copyMonth.value);
  var weekNum = level === 'week' ? Number(copyWeek.value) : null;
  copyModalSave.disabled = true;
  copyTask(copyingSrcId, level, year, month, weekNum).then(function(result) {
    copyModalSave.disabled = false;
    if (result && result.duplicate) {
      copyModalStatus.textContent = 'Already copied here — navigating to it.';
      setTimeout(function() {
        copyModal.classList.remove('open');
        copyModalStatus.textContent = '';
        activeTab = String(year); activeView = month; render();
      }, 1200);
      return;
    }
    copyModal.classList.remove('open');
    activeTab  = String(year);
    activeView = month;
    render();
  }).catch(function(err) {
    copyModalStatus.textContent = 'Error: ' + err.message;
    copyModalSave.disabled = false;
  });
};

// ── Sidebar ────────────────────────────────────────────────────────────────
var sbLevel   = document.getElementById('sb-level');
var sbWeekRow = document.getElementById('sb-week-row');
var sbWeek    = document.getElementById('sb-week');
var sbType    = document.getElementById('sb-type');
var sbTitle   = document.getElementById('sb-title');
var sbAdd     = document.getElementById('sb-add');

function updateSidebar() {
  if (!sbLevel) return;
  var opts = '';
  if (activeTab === 'backlog') {
    opts = '<option value="backlog">Backlog</option>';
    sbLevel.innerHTML = opts;
    sbWeekRow.style.display = 'none';
  } else {
    var year = Number(activeTab);
    opts += '<option value="year">Year ' + year + '</option>';
    yearMonths(year).forEach(function(m) {
      opts += '<option value="month-' + m + '">' + MONTHS[m-1] + ' ' + year + '</option>';
    });
    sbLevel.innerHTML = opts;
    // Pre-select current month view if applicable
    if (activeView !== 'year') {
      sbLevel.value = 'month-' + activeView;
    }
    // Show week row only when a month is selected
    sbWeekRow.style.display = sbLevel.value.startsWith('month-') ? '' : 'none';
  }
}

sbLevel.onchange = function() {
  sbWeekRow.style.display = this.value.startsWith('month-') ? '' : 'none';
};

sbAdd.onclick = function() {
  var title = sbTitle.value.trim();
  if (!title) { sbTitle.focus(); return; }
  var val = sbLevel.value;
  var data = { title: title, type: sbType.value, description: '', status: 'pending', parentId: null };
  if (val === 'backlog') {
    data.level = 'backlog';
    data.year = null; data.month = null; data.weekNum = null;
  } else if (val === 'year') {
    data.level = 'year';
    data.year = Number(activeTab); data.month = null; data.weekNum = null;
  } else {
    // month-N
    var month = Number(val.split('-')[1]);
    var weekNum = Number(sbWeek.value);
    data.year = Number(activeTab);
    data.month = month;
    // Check if week is selected
    if (sbWeekRow.style.display !== 'none') {
      data.level = 'week';
      data.weekNum = weekNum;
    } else {
      data.level = 'month';
      data.weekNum = null;
    }
  }
  addTask(data).then(function() { sbTitle.value = ''; sbTitle.focus(); });
};

sbTitle.addEventListener('keydown', function(e) { if (e.key === 'Enter') sbAdd.click(); });

// ── Add Year ───────────────────────────────────────────────────────────────
document.getElementById('btn-add-year').onclick = function() {
  var y = prompt('Enter year (e.g. 2027):');
  if (!y || isNaN(Number(y))) return;
  var year = Number(y);
  // Just switch to that year — it will appear once a task is added
  // But also ensure it shows in tabs by adding a placeholder if no tasks exist
  activeTab  = String(year);
  activeView = 'year';
  // Add the year to YEAR_START if it's not already there
  if (YEAR_START[year] === undefined) YEAR_START[year] = 0; // Jan for new years
  render();
};

// ── View / Edit mode toggle ────────────────────────────────────────────────
document.getElementById('btn-mode-toggle').onclick = function() {
  var isEdit = document.body.classList.toggle('edit-mode');
  this.textContent = isEdit ? '👁 View Mode' : '✏️ Edit Mode';
  if (isEdit) updateSidebar();
};

// ── Init ───────────────────────────────────────────────────────────────────
load();
