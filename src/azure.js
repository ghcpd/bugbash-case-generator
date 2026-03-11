import { toast, esc } from './utils.js';
import { getToken } from './auth.js';

/* ==================== Azure Management (ADF) ==================== */

export function azBaseUrl() {
  const sub = document.getElementById('azSub').value.trim(),
    rg = document.getElementById('azRg').value.trim(),
    f = document.getElementById('azFactory').value.trim();
  return `https://management.azure.com/subscriptions/${encodeURIComponent(sub)}/resourceGroups/${encodeURIComponent(rg)}/providers/Microsoft.DataFactory/factories/${encodeURIComponent(f)}`;
}

function azHeaders() {
  const t = getToken('management');
  return { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' };
}

export async function azFetch(method, path, body) {
  const r = await fetch(azBaseUrl() + path, { method, headers: azHeaders(), body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) { let m = `HTTP ${r.status}`; try { const e = await r.json(); m = e.error?.message || e.message || m; } catch {} throw new Error(m); }
  const t = await r.text();
  return t ? JSON.parse(t) : {};
}

/* ==================== Blob Storage ==================== */

export function blobBaseUrl() {
  return `https://${document.getElementById('azStorage').value.trim()}.blob.core.windows.net/${document.getElementById('azContainer').value.trim()}`;
}

export function blobStorageUrl() {
  return `https://${document.getElementById('azStorage').value.trim()}.blob.core.windows.net`;
}

export function blobHeaders() {
  const t = getToken('storage');
  return { 'Authorization': 'Bearer ' + t, 'x-ms-version': '2020-10-02' };
}

export function corsErrorHtml(msg) {
  const isCors = (msg || '').match(/ERR_FAILED|NetworkError|Failed to fetch/i);
  return isCors
    ? 'CORS error: Storage account blocks browser requests. Go to <b>Configure → Settings</b> and click <b>Enable CORS on Storage</b>, then retry.'
    : 'Error: ' + esc(msg);
}

export async function setCorsOnStorage() {
  const sub = document.getElementById('azSub').value.trim();
  const rg = document.getElementById('azRg').value.trim();
  const storage = document.getElementById('azStorage').value.trim();
  if (!sub || !rg || !storage) { toast('Fill in Subscription, RG, and Storage Account first'); return; }
  try {
    const mgmtToken = getToken('management');
    const url = `https://management.azure.com/subscriptions/${encodeURIComponent(sub)}/resourceGroups/${encodeURIComponent(rg)}/providers/Microsoft.Storage/storageAccounts/${encodeURIComponent(storage)}?api-version=2023-05-01`;
    const getResp = await fetch(url, { headers: { 'Authorization': 'Bearer ' + mgmtToken } });
    if (!getResp.ok) throw new Error('GET storage account failed: HTTP ' + getResp.status);
    await getResp.json();
    const corsUrl = `https://management.azure.com/subscriptions/${encodeURIComponent(sub)}/resourceGroups/${encodeURIComponent(rg)}/providers/Microsoft.Storage/storageAccounts/${encodeURIComponent(storage)}/blobServices/default?api-version=2023-05-01`;
    const body = {
      properties: {
        cors: {
          corsRules: [{
            allowedOrigins: ['*'], allowedMethods: ['GET', 'HEAD', 'PUT', 'OPTIONS'],
            allowedHeaders: ['Authorization', 'x-ms-version', 'x-ms-date', 'x-ms-blob-type', 'Content-Type'],
            exposedHeaders: ['x-ms-meta-*', 'Content-Length', 'Content-Type'], maxAgeInSeconds: 3600,
          }],
        },
      },
    };
    const putResp = await fetch(corsUrl, { method: 'PUT', headers: { 'Authorization': 'Bearer ' + mgmtToken, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!putResp.ok) { let m = 'HTTP ' + putResp.status; try { const e = await putResp.json(); m = e.error?.message || m; } catch {} throw new Error(m); }
    toast('CORS enabled on ' + storage + '! Retry your request.');
  } catch (e) { toast('CORS setup failed: ' + e.message); }
}

/* ==================== Azure Batch ==================== */

export function batchEndpoint() {
  const ep = document.getElementById('azBatchEndpoint').value.trim();
  if (!ep) throw new Error('Set Batch Account Endpoint in Settings');
  return ep.startsWith('https://') ? ep : 'https://' + ep;
}

function batchHeaders() {
  const t = getToken('batch');
  return { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json', 'ocp-date': new Date().toUTCString() };
}

export async function batchFetch(path) {
  const sep = path.includes('?') ? '&' : '?';
  const url = batchEndpoint() + path + sep + 'api-version=2024-02-01.19.0';
  const r = await fetch(url, { headers: batchHeaders() });
  if (!r.ok) { let m = `HTTP ${r.status}`; try { const e = await r.json(); m = e.message?.value || e.code || m; } catch {} throw new Error(m); }
  return r;
}
