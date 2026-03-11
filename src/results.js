import { toast, esc, fmtBytes, fmtTime } from './utils.js';
import { blobBaseUrl, blobHeaders, corsErrorHtml } from './azure.js';
import { openModal } from './modal.js';

export async function refreshBlobs() {
  const el = document.getElementById('blobContent'), preview = document.getElementById('blobPreview');
  preview.innerHTML = ''; el.innerHTML = '<p class="empty"><span class="spin"></span> Listing blobs…</p>';
  try {
    const folder = document.getElementById('azOutputFolder').value.trim();
    const sub = document.getElementById('blobSubfolder').value;
    const prefix = folder + '/' + sub + '/';
    const url = blobBaseUrl() + `?restype=container&comp=list&prefix=${encodeURIComponent(prefix)}&delimiter=`;
    const resp = await fetch(url, { headers: blobHeaders() });
    if (!resp.ok) { let m = `HTTP ${resp.status}`; try { m = await resp.text(); } catch {} throw new Error(m); }
    const xml = await resp.text(); const parser = new DOMParser(); const doc = parser.parseFromString(xml, 'text/xml');
    const blobs = doc.querySelectorAll('Blob');
    if (!blobs.length) { el.innerHTML = '<p class="empty">No files found in ' + esc(prefix) + '</p>'; return; }
    const items = [];
    blobs.forEach(b => {
      const name = b.querySelector('Name')?.textContent || '';
      const size = parseInt(b.querySelector('Content-Length')?.textContent || '0');
      const modified = b.querySelector('Last-Modified')?.textContent || '';
      items.push({ name, size, modified, shortName: name.replace(prefix, '') });
    });
    items.sort((a, b) => new Date(b.modified) - new Date(a.modified));

    let h = `<div style="font-size:11px;color:var(--muted);padding:6px 0 8px">${items.length} files in <code>${esc(prefix)}</code></div>`;
    for (const f of items) {
      const isJsonl = f.shortName.endsWith('.jsonl');
      h += `<div class="blob-file" ${isJsonl ? `style="cursor:pointer" onclick="window._app.previewBlob('${f.name.replace(/'/g, "\\'")}')"` : ''}>
        <span class="blob-icon">${isJsonl ? '📋' : '📦'}</span>
        <span class="blob-name">${esc(f.shortName)}</span>
        <span class="blob-size">${fmtBytes(f.size)}</span>
        <span class="blob-size">${fmtTime(f.modified)}</span>
        <button class="btn-copy" onclick="event.stopPropagation();window._app.copyText('${f.name.replace(/'/g, "\\'")}','File path')">📋</button>
        ${isJsonl ? `<button class="btn-sm" onclick="event.stopPropagation();window._app.previewBlob('${f.name.replace(/'/g, "\\'")}')">View</button>` : ''}
      </div>`;
    }
    el.innerHTML = h;
  } catch (e) { el.innerHTML = `<p class="empty" style="color:var(--red)">${corsErrorHtml(e.message)}</p>`; }
}

export async function previewBlob(blobName) {
  const el = document.getElementById('blobPreview');
  el.innerHTML = `<div class="blob-preview"><span class="spin"></span> Loading…</div>`;
  try {
    const url = blobBaseUrl() + '/' + encodeURIComponent(blobName).replace(/%2F/g, '/');
    const resp = await fetch(url, { headers: blobHeaders() });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    let display = text;
    if (blobName.endsWith('.jsonl')) { try { display = text.trim().split('\n').map(line => JSON.stringify(JSON.parse(line), null, 2)).join('\n\n---\n\n'); } catch {} }
    el.innerHTML = `<div class="blob-preview">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-weight:600;font-size:12px;color:var(--accent);flex:1">${esc(blobName.split('/').pop())}</span>
        <button class="btn-copy" onclick="window._app.clipboardWrite(document.getElementById('blobText').textContent).then(()=>window._app.toast('Content copied!'))">📋 Copy</button>
        <button class="btn-sm" onclick="window._app.openModal('${esc(blobName.split('/').pop())}',document.getElementById('blobText').textContent)">⤢ Expand</button>
      </div>
      <pre id="blobText">${esc(display)}</pre>
    </div>`;
  } catch (e) { el.innerHTML = `<div class="blob-preview"><p style="color:var(--red)">${corsErrorHtml(e.message)}</p></div>`; }
}
