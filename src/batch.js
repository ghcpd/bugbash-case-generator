import { toast, esc, copyText, fmtDuration, fmtTime, statusBadge } from './utils.js';
import { batchFetch } from './azure.js';
import { openModal } from './modal.js';

let _batchJobsCache = [];
let _batchTasksCache = {};
let _taskSortMode = 'id-asc';
let _taskUuidFilter = '';

export async function listBatchJobs() {
  const el = document.getElementById('batchJobsContent');
  el.innerHTML = '<p class="empty"><span class="spin"></span> Loading Batch jobs…</p>';
  document.getElementById('batchTasksDetail').innerHTML = '';
  try {
    const poolFilter = document.getElementById('batchPoolFilter').value.trim();
    let url = '/jobs?maxresults=50';
    if (poolFilter) url += '&$filter=executionInfo/poolId eq \'' + poolFilter + '\'';
    const resp = await batchFetch(url);
    const data = await resp.json();
    let jobs = data.value || [];
    if (poolFilter && jobs.length) {
      const filtered = jobs.filter(j => (j.poolInfo?.poolId || '') === poolFilter);
      if (filtered.length) jobs = filtered;
    }
    _batchJobsCache = jobs;
    if (!jobs.length) { el.innerHTML = '<p class="empty">No Batch jobs found</p>'; return; }
    renderBatchJobs();
  } catch (e) { el.innerHTML = `<p class="empty" style="color:var(--red)">Error: ${esc(e.message)}</p>`; }
}

function renderBatchJobs() {
  const el = document.getElementById('batchJobsContent');
  if (!el) return;
  const jobs = _batchJobsCache;
  if (!jobs || !jobs.length) { el.innerHTML = '<p class="empty">No Batch jobs found</p>'; return; }

  let filtered = jobs.slice();
  filtered.sort((a, b) => new Date(b.creationTime || 0) - new Date(a.creationTime || 0));

  let h = `<table class="batch-jobs-table"><tr><th>Job ID</th><th>State</th><th>Created</th><th>Pool</th><th></th></tr>`;
  if (!filtered.length) {
    h += `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:16px">No jobs found</td></tr>`;
  }
  for (const j of filtered) {
    const jid = j.id || '';
    const shortId = jid.length > 32 ? jid.substring(0, 32) + '…' : jid;
    h += `<tr class="clickable" onclick="window._app.loadBatchTasks('${esc(jid)}')">
      <td><span style="font-family:monospace;font-size:11px;color:var(--cyan)" title="${esc(jid)}">${esc(shortId)}</span>
        <button class="btn-copy" onclick="event.stopPropagation();window._app.copyText('${esc(jid)}','Job ID')">📋</button></td>
      <td>${statusBadge(j.state || 'unknown')}</td>
      <td style="font-size:11px">${fmtTime(j.creationTime)}</td>
      <td style="font-size:11px;color:var(--muted)">${esc(j.poolInfo?.poolId || '-')}</td>
      <td><button class="btn-sm" onclick="event.stopPropagation();window._app.loadBatchTasks('${esc(jid)}')">Tasks →</button></td>
    </tr>`;
  }
  h += '</table>';
  el.innerHTML = h;
}

function classifyTask(t) {
  const s = (t.state || '').toLowerCase();
  if (s === 'running') return 'running';
  if (s === 'completed') { return (t.executionInfo?.exitCode === 0) ? 'succeeded' : 'failed'; }
  if (s === 'active' || s === 'preparing') return 'pending';
  return 'other';
}

export function renderBatchTasks(jobId, filter, sortMode, uuidFilter) {
  if (sortMode !== undefined) _taskSortMode = sortMode;
  if (uuidFilter !== undefined) _taskUuidFilter = uuidFilter;
  const el = document.getElementById('batchTasksDetail');
  const tasks = _batchTasksCache[jobId];
  if (!tasks) return;

  let nS = 0, nF = 0, nR = 0, nP = 0;
  for (const t of tasks) { const c = classifyTask(t); if (c === 'succeeded') nS++; else if (c === 'failed') nF++; else if (c === 'running') nR++; else nP++; }
  const pct = tasks.length ? Math.round((nS + nF) / tasks.length * 100) : 0;

  let filtered = filter === 'all' ? tasks.slice() : tasks.filter(t => classifyTask(t) === filter);

  const uf = (_taskUuidFilter || '').trim().toLowerCase();
  if (uf) filtered = filtered.filter(t => (t.id || '').toLowerCase().includes(uf));

  filtered.sort((a, b) => {
    switch (_taskSortMode) {
      case 'id-desc': return (b.id || '').localeCompare(a.id || '', undefined, { numeric: true });
      case 'time-desc': { const at = a.executionInfo?.startTime || a.creationTime || ''; const bt = b.executionInfo?.startTime || b.creationTime || ''; return new Date(bt || 0) - new Date(at || 0); }
      case 'time-asc': { const at2 = a.executionInfo?.startTime || a.creationTime || ''; const bt2 = b.executionInfo?.startTime || b.creationTime || ''; return new Date(at2 || 0) - new Date(bt2 || 0); }
      case 'state': return classifyTask(a).localeCompare(classifyTask(b));
      case 'exit': { const ea = a.executionInfo?.exitCode ?? 999; const eb = b.executionInfo?.exitCode ?? 999; return ea - eb; }
      default: return (a.id || '').localeCompare(b.id || '', undefined, { numeric: true });
    }
  });

  const btnStyle = (f) => `cursor:pointer;padding:3px 10px;border-radius:10px;font-size:11px;border:1px solid var(--border);background:${filter === f ? 'var(--accent)' : 'var(--surface2)'};color:${filter === f ? '#fff' : 'var(--text-sec)'}`;
  let h = `<div class="batch-tasks-panel">
    <div class="batch-tasks-head">
      <span style="flex:1">Tasks — <code style="color:var(--cyan);cursor:pointer" onclick="window._app.copyText('${esc(jobId)}','Job ID')">${esc(jobId.length > 30 ? jobId.substring(0, 30) + '…' : jobId)}</code>
        <button class="btn-copy" onclick="window._app.copyText('${esc(jobId)}','Job ID')">📋</button></span>
      <span style="font-size:11px;color:var(--muted)">${tasks.length} tasks &middot; ${pct}% done</span>
    </div>
    <div style="display:flex;gap:6px;padding:8px 12px;flex-wrap:wrap;align-items:center">
      <span style="${btnStyle('all')}" onclick="window._app.renderBatchTasks('${esc(jobId)}','all','${esc(_taskSortMode)}','${esc(_taskUuidFilter)}')">All (${tasks.length})</span>
      <span style="${btnStyle('failed')}" onclick="window._app.renderBatchTasks('${esc(jobId)}','failed','${esc(_taskSortMode)}','${esc(_taskUuidFilter)}')">❌ Failed (${nF})</span>
      <span style="${btnStyle('running')}" onclick="window._app.renderBatchTasks('${esc(jobId)}','running','${esc(_taskSortMode)}','${esc(_taskUuidFilter)}')">🔄 Running (${nR})</span>
      <span style="${btnStyle('succeeded')}" onclick="window._app.renderBatchTasks('${esc(jobId)}','succeeded','${esc(_taskSortMode)}','${esc(_taskUuidFilter)}')">✅ Succeeded (${nS})</span>
      <span style="${btnStyle('pending')}" onclick="window._app.renderBatchTasks('${esc(jobId)}','pending','${esc(_taskSortMode)}','${esc(_taskUuidFilter)}')">⏳ Pending (${nP})</span>
      <span style="flex:1"></span>
      <label style="font-size:11px;color:var(--muted)">Sort:</label>
      <select id="taskSort" style="font-size:11px;padding:3px 6px" onchange="window._app.renderBatchTasks('${esc(jobId)}','${esc(filter)}',this.value,document.getElementById('taskUuidFilter').value)">
        <option value="id-asc" ${_taskSortMode === 'id-asc' ? 'selected' : ''}>ID ↑ (A→Z)</option>
        <option value="id-desc" ${_taskSortMode === 'id-desc' ? 'selected' : ''}>ID ↓ (Z→A)</option>
        <option value="time-desc" ${_taskSortMode === 'time-desc' ? 'selected' : ''}>Time ↓ (newest)</option>
        <option value="time-asc" ${_taskSortMode === 'time-asc' ? 'selected' : ''}>Time ↑ (oldest)</option>
        <option value="state" ${_taskSortMode === 'state' ? 'selected' : ''}>State</option>
        <option value="exit" ${_taskSortMode === 'exit' ? 'selected' : ''}>Exit Code</option>
      </select>
      <input id="taskUuidFilter" placeholder="Filter Task ID…" value="${esc(_taskUuidFilter)}" style="width:180px;font-size:11px;padding:4px 8px" oninput="window._app.renderBatchTasks('${esc(jobId)}','${esc(filter)}',document.getElementById('taskSort').value,this.value)">
      <span style="font-size:11px;color:var(--muted)">${filtered.length}/${tasks.length}</span>
    </div>
    <table class="act-table"><tr><th>Task ID</th><th>State</th><th>Exit</th><th>Duration</th><th>Logs</th></tr>`;

  if (!filtered.length) {
    h += `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:16px">No tasks match filter</td></tr>`;
  }
  for (const t of filtered) {
    const tid = t.id || '';
    const ei = t.executionInfo || {};
    const exitCode = ei.exitCode;
    const exitColor = exitCode === 0 ? 'var(--green)' : exitCode !== undefined ? 'var(--red)' : 'var(--muted)';

    h += `<tr>
      <td><span style="font-family:monospace;font-size:11px;color:var(--cyan)">${esc(tid)}</span>
        <button class="btn-copy" onclick="window._app.copyText('${esc(tid)}','Task ID')">📋</button></td>
      <td>${statusBadge(t.state)}</td>
      <td style="font-family:monospace;font-size:11px;color:${exitColor}">${exitCode !== undefined ? exitCode : '-'}</td>
      <td style="font-size:11px">${fmtDuration(ei.startTime, ei.endTime)}</td>
      <td class="act-actions">
        <button class="btn-log stdout" onclick="window._app.viewBatchFile('${esc(jobId)}','${esc(tid)}','stdout.txt')">stdout</button>
        <button class="btn-log stderr" onclick="window._app.viewBatchFile('${esc(jobId)}','${esc(tid)}','stderr.txt')">stderr</button>
      </td></tr>`;
  }
  h += '</table></div>';
  el.innerHTML = h;
}

export async function loadBatchTasks(jobId) {
  const el = document.getElementById('batchTasksDetail');
  el.innerHTML = `<div class="batch-tasks-panel"><div class="batch-tasks-head"><span class="spin"></span> Loading tasks for ${esc(jobId.substring(0, 24))}…</div></div>`;
  try {
    const resp = await batchFetch(`/jobs/${encodeURIComponent(jobId)}/tasks`);
    const data = await resp.json();
    const tasks = data.value || [];
    if (!tasks.length) { el.innerHTML = `<div class="batch-tasks-panel"><div class="batch-tasks-head">No tasks in job</div></div>`; return; }

    _taskSortMode = 'id-asc';
    _taskUuidFilter = '';
    _batchTasksCache[jobId] = tasks;

    const hasFailures = tasks.some(t => classifyTask(t) === 'failed');
    renderBatchTasks(jobId, hasFailures ? 'failed' : 'all', _taskSortMode, _taskUuidFilter);
  } catch (e) { el.innerHTML = `<div class="batch-tasks-panel"><div class="batch-tasks-head" style="color:var(--red)">Error: ${esc(e.message)}</div></div>`; }
}

let _modalSource = null;

export async function viewBatchFile(jobId, taskId, filename) {
  _modalSource = { jobId, taskId, filename };
  openModal(`${filename} — ${taskId}`, 'Loading…', true);
  try {
    const resp = await batchFetch(`/jobs/${encodeURIComponent(jobId)}/tasks/${encodeURIComponent(taskId)}/files/${encodeURIComponent(filename)}`);
    const text = await resp.text();
    document.getElementById('logModalContent').textContent = text || '(empty)';
  } catch (e) { document.getElementById('logModalContent').textContent = 'Error: ' + e.message; }
}

export async function refreshModal() {
  if (!_modalSource) return;
  const { jobId, taskId, filename } = _modalSource;
  document.getElementById('logModalContent').textContent = 'Refreshing…';
  try {
    const resp = await batchFetch(`/jobs/${encodeURIComponent(jobId)}/tasks/${encodeURIComponent(taskId)}/files/${encodeURIComponent(filename)}`);
    const text = await resp.text();
    document.getElementById('logModalContent').textContent = text || '(empty)';
    toast('Refreshed');
  } catch (e) { document.getElementById('logModalContent').textContent = 'Error: ' + e.message; }
}
