// loading.js — Titan Forge launch screen + task tracker + fade-in
(() => {
  // ---- DOM scaffold ---------------------------------------------------------
  const style = document.createElement('style');
  style.textContent = `
  :root { --tf-bg:#0b0f14; --tf-fg:#e6eef6; --tf-accent:#1e90ff; --tf-ok:#00c853; --tf-bad:#ff3b30; --glass:rgba(255,255,255,.06); }
  #tf-loader {
    position:fixed; inset:0; z-index:9999; background:var(--tf-bg);
    display:flex; align-items:center; justify-content:center;
    padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    transition:opacity .35s ease; opacity:1;
  }
  #tf-loader.hidden { opacity:0; pointer-events:none; }
  .tf-card {
    width:min(720px,92vw); max-height:88vh; display:flex; flex-direction:column; gap:16px;
    background:var(--glass); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
    border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:20px;
    box-shadow:0 10px 40px rgba(0,0,0,.35);
  }
  .tf-brand { display:flex; align-items:center; gap:14px; }
  .tf-logo { width:44px; height:44px; flex:0 0 44px; }
  .tf-title { font-weight:700; font-size:18px; letter-spacing:.4px; color:var(--tf-fg); }
  .tf-sub { font-size:12px; opacity:.7; }
  .tf-bar {
    position:relative; height:18px; border-radius:10px; overflow:hidden;
    background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.12);
  }
  .tf-fill {
    position:absolute; left:0; top:0; bottom:0; width:0%;
    background:linear-gradient(90deg, var(--tf-accent), #52a8ff);
    display:flex; align-items:center; justify-content:center; font-size:12px; color:#001;
    transition:width .18s ease;
  }
  .tf-fill.bad { background:linear-gradient(90deg, var(--tf-bad), #ff6b6b); color:#fff; }
  .tf-row { display:flex; gap:8px; align-items:center; justify-content:space-between; }
  .tf-status { font-size:12px; opacity:.8; }
  .tf-actions { display:flex; gap:8px; }
  .tf-btn {
    font-size:12px; padding:6px 10px; border-radius:10px; border:1px solid rgba(255,255,255,.15);
    background:rgba(255,255,255,.06); color:var(--tf-fg); cursor:pointer;
  }
  .tf-btn:active { transform:translateY(1px); }
  #tf-debugger {
    background:rgba(0,0,0,.35); border:1px solid rgba(255,255,255,.08); border-radius:12px; padding:10px;
    display:flex; flex-direction:column; gap:8px; min-height:140px; max-height:36vh;
  }
  #tf-debugger .head { display:flex; align-items:center; justify-content:space-between; }
  #tf-debugger .head .title { font-size:12px; opacity:.75; }
  #tf-debugger pre {
    margin:0; padding:10px; border-radius:8px; overflow:auto; white-space:pre-wrap; word-wrap:break-word;
    background:rgba(255,255,255,.04); color:#cde3ff; font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,Monaco,monospace;
    max-height:28vh;
  }`;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = 'tf-loader';
  el.innerHTML = `
    <div class="tf-card" role="status" aria-live="polite">
      <div class="tf-brand">
        <svg class="tf-logo" viewBox="0 0 64 64" aria-hidden="true">
          <!-- Titan Forge logo (simple anvil + flame) -->
          <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#52a8ff"/><stop offset="1" stop-color="#1e90ff"/></linearGradient></defs>
          <path d="M12 42h40v6H12z" fill="url(#g)"/>
          <path d="M20 36h24l-4 6H24z" fill="#83c2ff"/>
          <path d="M32 10c6 4 8 9 6 14-2 4-6 6-6 6s-4-2-6-6c-2-5 0-10 6-14z" fill="#ff945e"/>
        </svg>
        <div>
          <div class="tf-title">Titan Forge — Launching</div>
          <div class="tf-sub">Verifying modules & wiring UI…</div>
        </div>
      </div>

      <div class="tf-bar" aria-label="Loading progress">
        <div class="tf-fill" id="tf-fill"><span id="tf-pct">0%</span></div>
      </div>

      <div class="tf-row">
        <div class="tf-status" id="tf-status">Preparing…</div>
        <div class="tf-actions">
          <button class="tf-btn" id="tf-copy">Copy Logs</button>
          <button class="tf-btn" id="tf-hide">Hide</button>
        </div>
      </div>

      <div id="tf-debugger" data-ready="false">
        <div class="head"><span class="title">Debugger output</span></div>
        <pre id="tf-log"></pre>
      </div>
    </div>`;
  document.body.appendChild(el);

  // ---- Logger (works even if debugger.js not loaded yet) --------------------
  const logBuffer = [];
  const logEl = () => document.getElementById('tf-log');
  const ts = () => new Date().toISOString().replace('T',' ').replace('Z','');
  const write = (level, msg) => {
    const line = `[${ts()}] [${level}] ${msg}`;
    logBuffer.push(line);
    const pre = logEl();
    if (pre) {
      pre.textContent += (pre.textContent ? '\n' : '') + line;
      pre.scrollTop = pre.scrollHeight;
    }
    // Let debugger.js also see logs
    window.dispatchEvent(new CustomEvent('tf:log', { detail: { level, msg, time: Date.now() }}));
  };

  // ---- Task tracker ---------------------------------------------------------
  const tasks = new Map();   // id -> { label, state: 'pending'|'done'|'failed' }
  const state = { done:0, failed:0 };

  function updateBar() {
    const total = Math.max(tasks.size, 1);
    const pct = Math.floor((state.done / total) * 100);
    const fill = document.getElementById('tf-fill');
    const pctEl = document.getElementById('tf-pct');
    if (fill && pctEl) {
      fill.style.width = `${pct}%`;
      pctEl.textContent = `${pct}%`;
    }
  }
  function setStatus(text) {
    const s = document.getElementById('tf-status');
    if (s) s.textContent = text;
  }
  function finalize(success) {
    const fill = document.getElementById('tf-fill');
    if (fill) fill.classList.toggle('bad', !success);
    setStatus(success ? 'Loaded • All systems nominal' : 'Failed • See debugger for details');
    if (success) {
      write('OK', 'All tasks complete. Fading to app.');
      setTimeout(() => { el.classList.add('hidden'); }, 180);
      setTimeout(() => { el.remove(); }, 600);
    } else {
      write('ERR', 'Loader halted due to errors.');
    }
  }

  const AppLoader = {
    register(id, label) {
      if (!tasks.has(id)) {
        tasks.set(id, { label, state:'pending' });
        write('INFO', `▶ ${label}…`);
        setStatus(label);
      }
      updateBar();
    },
    complete(id, note='') {
      const t = tasks.get(id); if (!t || t.state!=='pending') return;
      t.state='done'; state.done++; updateBar();
      write('OK', `✓ ${t.label}${note ? ' — '+note : ''}`);
      if (state.done === tasks.size && state.failed===0) {
        // small grace period; more tasks might register right after imports
        clearTimeout(this._idle);
        this._idle = setTimeout(() => finalize(true), 120);
      }
    },
    fail(id, error) {
      const t = tasks.get(id) || { label:id, state:'pending' };
      tasks.set(id, t);
      if (t.state !== 'failed') { t.state='failed'; state.failed++; }
      updateBar();
      const msg = (error && error.stack) ? error.stack : (error && error.message) ? error.message : String(error);
      write('ERR', `✗ ${t.label} — ${msg}`);
      finalize(false);
    },
    log(level, msg) { write(level, msg); },
    summary() { return logBuffer.join('\n'); }
  };
  window.AppLoader = AppLoader; // expose for other modules

  // Copy & Hide buttons
  document.getElementById('tf-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(AppLoader.summary()); setStatus('Logs copied'); }
    catch { setStatus('Copy failed'); }
  });
  document.getElementById('tf-hide').addEventListener('click', () => el.classList.toggle('hidden'));

  // ---- Wire initial tasks ---------------------------------------------------
  AppLoader.register('phonebook', 'Loading phonebook (Three.js & addons)');
  // The index.html entry will dispatch this once imports succeed.
  window.addEventListener('app:ready', (e) => {
    AppLoader.complete('phonebook', `modules: ${Object.keys(window.Phonebook||{}).join(', ')}`);
  });

  // Allow other parts of the app to register/complete tasks via events
  window.addEventListener('tf:task:register', (ev) => {
    const { id, label } = ev.detail || {};
    if (id && label) AppLoader.register(id, label);
  });
  window.addEventListener('tf:task:complete', (ev) => {
    const { id, note } = ev.detail || {};
    if (id) AppLoader.complete(id, note);
  });
  window.addEventListener('tf:task:fail', (ev) => {
    const { id, error } = ev.detail || {};
    if (id) AppLoader.fail(id, error || 'Unknown failure');
  });

  // Log basic boot milestones
  write('INFO', 'Loader online.');
  write('INFO', 'Awaiting modules…');
})();