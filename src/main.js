import './styles/main.css';

import { STEPS } from './constants.js';
import { toast, esc, toggleCollapse, copyText, goStep } from './utils.js';
import { initAuth, importTokens, refreshTokensViaScript, signOut } from './auth.js';
import { setCorsOnStorage } from './azure.js';
import { initSelects, bulkAdd, addRow, updateCount } from './tasks.js';
import { generate, cpRepoList, resetAll, triggerPipeline } from './generate.js';
import { refreshRuns, loadActivities, viewActivityOutput, cancelRun, backfillRun, doBackfill, toggleAutoRefresh } from './monitor.js';
import { listBatchJobs, renderBatchTasks, loadBatchTasks, viewBatchFile, refreshModal } from './batch.js';
import { refreshBlobs, previewBlob } from './results.js';
import { loadAuditCases, toggleAuditCase, selectAllAudit, selectNoneAudit, runQuickAudit, triggerAuditPipeline, loadAuditResults, previewAuditResult } from './audit.js';
import { loadBugBashCases, toggleBBCase, viewBBCase, bbSelectAll, bbSelectNone, bbSelectWithTar, triggerBugBashGenRubric, triggerBugBashAutoRun, loadPipelineDefinition, resetBugBash } from './bugbash.js';
import { openModal, closeModal, copyModalContent } from './modal.js';
import { saveState, loadState, autoSave } from './persistence.js';

// Expose functions globally for inline onclick handlers
window._app = {
  toast, esc, toggleCollapse, copyText, goStep,
  importTokens, refreshTokensViaScript, signOut,
  setCorsOnStorage,
  bulkAdd, addRow, updateCount,
  generate, cpRepoList, resetAll, triggerPipeline,
  refreshRuns, loadActivities, viewActivityOutput, cancelRun, backfillRun, doBackfill, toggleAutoRefresh,
  listBatchJobs, renderBatchTasks, loadBatchTasks, viewBatchFile, refreshModal,
  refreshBlobs, previewBlob,
  loadAuditCases, toggleAuditCase, selectAllAudit, selectNoneAudit, runQuickAudit, triggerAuditPipeline, loadAuditResults, previewAuditResult,
  loadBugBashCases, toggleBBCase, viewBBCase, bbSelectAll, bbSelectNone, bbSelectWithTar, triggerBugBashGenRubric, triggerBugBashAutoRun, loadPipelineDefinition, resetBugBash,
  openModal, closeModal, copyModalContent,
  saveState,
};

// Keyboard shortcut for modal
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// Initialize MSAL auth
initAuth().catch(e => console.error('MSAL init failed:', e));

// Initialize UI
initSelects();
const restored = loadState();
if (!restored) addRow();
updateCount();
autoSave();

// Restore active tab
try {
  const tab = localStorage.getItem('swebench_active_tab');
  if (tab && STEPS.includes(tab)) {
    goStep(tab);
    if (tab === 'monitor') setTimeout(refreshRuns, 300);
    if (tab === 'results') setTimeout(refreshBlobs, 300);
    if (tab === 'audit') setTimeout(loadAuditCases, 300);
  }
} catch {}
