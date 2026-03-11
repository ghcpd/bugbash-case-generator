import { toast } from './utils.js';

// In-memory token store — populated by importTokens() or the local refresh script
const tokens = {
  management: '',
  storage: '',
  batch: '',
};

export function getToken(resource) {
  const t = tokens[resource];
  if (!t) {
    const labels = { management: 'Azure Management', storage: 'Blob Storage', batch: 'Batch' };
    throw new Error(`No ${labels[resource] || resource} token — click "🔑 Refresh Tokens" in Settings`);
  }
  return t;
}

export function setTokens(obj) {
  if (obj.management) tokens.management = obj.management;
  if (obj.storage) tokens.storage = obj.storage;
  if (obj.batch) tokens.batch = obj.batch;
  updateTokenUI();
}

export function hasAllTokens() {
  return !!(tokens.management && tokens.storage && tokens.batch);
}

/**
 * Import tokens from clipboard. Accepts either:
 *   - JSON: { "management": "...", "storage": "...", "batch": "..." }
 *   - The output of the get_tokens.ps1 script
 */
export async function importTokens() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text?.trim()) { toast('Clipboard is empty'); return; }
    let data;
    try { data = JSON.parse(text); } catch { toast('Clipboard is not valid JSON'); return; }

    // Support both new key names and legacy field names
    const mgmt = data.management || data.azToken || '';
    const stor = data.storage || data.azBlobToken || '';
    const bat = data.batch || data.azBatchToken || '';

    let count = 0;
    if (mgmt) { tokens.management = mgmt; count++; }
    if (stor) { tokens.storage = stor; count++; }
    if (bat) { tokens.batch = bat; count++; }

    // Also import batch endpoint if present
    if (data.azBatchEndpoint || data.batchEndpoint) {
      const el = document.getElementById('azBatchEndpoint');
      if (el) el.value = data.azBatchEndpoint || data.batchEndpoint;
    }

    if (count > 0) {
      toast(`Imported ${count} token(s)`);
      updateTokenUI();
    } else {
      toast('No tokens found in JSON — expected keys: management, storage, batch');
    }
  } catch (e) { toast('Clipboard: ' + e.message); }
}

/**
 * Run the PowerShell script to generate tokens and copy to clipboard,
 * then auto-import.
 */
export async function refreshTokensViaScript() {
  const script = generatePowerShellScript();
  await navigator.clipboard.writeText(script);
  toast('PowerShell script copied! Paste in terminal, then click "📋 Import from Clipboard"');
}

function generatePowerShellScript() {
  return `# Run this in PowerShell, then click "📋 Import from Clipboard" in the UI
$mgmt = az account get-access-token --resource https://management.azure.com --query accessToken -o tsv
$storage = az account get-access-token --resource https://storage.azure.com --query accessToken -o tsv
$batch = az account get-access-token --resource https://batch.core.windows.net --query accessToken -o tsv
$json = @{ management = $mgmt; storage = $storage; batch = $batch } | ConvertTo-Json -Compress
Set-Clipboard $json
Write-Host "✅ Tokens copied to clipboard — go back to the browser and click Import" -ForegroundColor Green`;
}

function updateTokenUI() {
  const el = document.getElementById('tokenStatus');
  if (!el) return;
  const items = [
    { key: 'management', label: 'Mgmt' },
    { key: 'storage', label: 'Storage' },
    { key: 'batch', label: 'Batch' },
  ];
  el.innerHTML = items.map(({ key, label }) => {
    const ok = !!tokens[key];
    return `<span style="color:${ok ? 'var(--green)' : 'var(--muted)'};font-size:11px;font-weight:600">${ok ? '✓' : '○'} ${label}</span>`;
  }).join(' ');
}

// Re-export for backward compat
export async function initAuth() { updateTokenUI(); }
export async function signIn() { await refreshTokensViaScript(); }
export async function signOut() {
  tokens.management = ''; tokens.storage = ''; tokens.batch = '';
  updateTokenUI();
  toast('Tokens cleared');
}
