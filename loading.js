// loading.js — Titan Forge launch screen + task tracker + manual continue
(() => {
  // ---- DOM scaffold ---------------------------------------------------------
  const style = document.createElement('style');
  style.textContent = `
  :root {
    --tf-bg:#000000; /* Solid black background */
    --tf-fg:#e6eef6;
    --tf-accent:#1e90ff;
    --tf-ok:#00c853;
    --tf-bad:#ff3b30;
    --glass:rgba(255,255,255,.06);
    --tf-loader-max-width: min(400px, 90vw); /* Narrower focus for content */
  }
  html, body {
    background: var(--tf-bg); /* Ensure body also black */
    overflow: hidden; /* Prevent scrolling during loading */
  }
  #tf-loader {
    position:fixed; inset:0; z-index:9999; background:var(--tf-bg);
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    transition:opacity .6s ease; /* Slower fade out */
    opacity:1;
    color: var(--tf-fg);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  }
  #tf-loader.hidden { opacity:0; pointer-events:none; }

  /* Logo specific styles */
  .tf-logo-container {
    opacity: 0; /* Initially hidden for fade-in */
    transition: opacity 1.5s ease-in; /* Slower fade-in for logo */
    margin-bottom: 40px; /* Space between logo and loading bar */
    text-align: center;
  }
  .tf-logo-container.show {
    opacity: 1;
  }
  .tf-logo-text {
    font-size: 36px; /* Larger text for logo */
    font-weight: 700;
    letter-spacing: 1px;
    color: var(--tf-fg);
    margin-bottom: 8px;
  }
  .tf-logo-subtext {
    font-size: 16px;
    opacity: 0.7;
  }

  /* Loading bar */
  .tf-loading-area {
    width: var(--tf-loader-max-width);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 15px; /* Reduced gap */
  }
  .tf-bar-wrapper {
    width: 100%;
    position: relative;
    height: 10px; /* Slimmer bar */
    border-radius: 5px;
    overflow: hidden;
    background: rgba(255,255,255,.1);
    border: none;
  }
  .tf-bar-fill {
    position: absolute; left:0; top:0; bottom:0; width:0%;
    background: linear-gradient(90deg, #6a11cb 0%, #2575fc 100%);
    transition: width 0.2s ease-out; /* Direct, quick fill transition */
  }
  .tf-bar-fill.bad {
    background: linear-gradient(90deg, var(--tf-bad), #ff6b6b);
  }
  .tf-percentage {
    font-size: 14px;
    color: #a0a0a0;
    width: 100%;
    text-align: right;
  }

  /* Process text below bar */
  .tf-process-text {
    font-size: 14px;
    opacity: 0.8;
    height: 20px; /* Reserve space to prevent layout shifts */
    text-align: center;
    width: 100%;
    color: #a0a0a0;
  }

  /* Continue button */
  .tf-continue-button {
    margin-top: 30px;
    padding: 12px 30px;
    font-size: 16px;
    font-weight: 600;
    border-radius: 25px;
    border: none;
    background: linear-gradient(90deg, #6a11cb 0%, #2575fc 100%);
    color: #fff;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    transition: all 0.3s ease;
    opacity: 0;
    transform: translateY(10px);
    pointer-events: none;
  }
  .tf-continue-button.show {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }
  
  /* Error Debugger Card */
  .tf-debugger-card {
    background: rgba(25, 25, 27, 0.8);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 12px;
    padding: 15px;
    display: none; /* Hidden by default */
    flex-direction: column;
    gap: 10px;
    width: var(--tf-loader-max-width);
    max-height: 20vh;
    margin-top: 20px;
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.5s ease, transform 0.5s ease;
  }
  .tf-debugger-card.show {
    display: flex; /* Becomes visible on error */
    opacity: 1;
    transform: translateY(0);
  }
  .tf-debugger-card .head { display: flex; align-items: center; justify-content: space-between; }
  .tf-debugger-card .head .title { font-size: 13px; opacity: 0.8; color: var(--tf-fg); }
  .tf-debugger-card pre {
    margin:0; padding:10px; border-radius:8px; overflow:auto; white-space:pre-wrap; word-wrap:break-word;
    background:rgba(0,0,0,.2); color:#cde3ff; font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,Monaco,monospace;
    flex-grow: 1;
  }
  .tf-debugger-card .tf-copy-button {
    padding: 6px 15px; font-size: 13px; border-radius: 10px;
    border: 1px solid rgba(255,255,255,.2); background: rgba(255,255,255,.1);
    color: var(--tf-fg); cursor: pointer; transition: background 0.2s ease;
  }
  .tf-debugger-card .tf-copy-button:hover { background: rgba(255,255,255,.15); }

  /* Error actions (Reload button) */
  .tf-error-action-row {
    display: none; /* Hidden by default */
    justify-content: center;
    margin-top: 20px;
    width: var(--tf-loader-max-width);
  }
  .tf-error-action-row.show {
    display: flex; /* Becomes visible on error */
  }
  .tf-reload-button {
    padding: 10px 25px; font-size: 15px; font-weight: 600; border-radius: 20px;
    border: none; background: var(--tf-bad); color: #fff;
    cursor: pointer; transition: background 0.2s ease, transform 0.2s ease;
  }
  .tf-reload-button:hover { background: #e62e2e; }
  `;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = 'tf-loader';
  el.innerHTML = `
    <div class="tf-logo-container" id="tf-logo-container">
      <div class="tf-logo-text">Titan Forge</div>
      <div class="tf-logo-subtext">Launching...</div>
    </div>

    <div class="tf-loading-area">
      <div class="tf-bar-wrapper">
        <div class="tf-bar-fill" id="tf-fill"></div>
      </div>
      <div class="tf-percentage" id="tf-pct">0%</div>
      <div class="tf-process-text" id="tf-status">Initializing...</div>
    </div>

    <button class="tf-continue-button" id="tf-continue">Continue</button>

    <div class="tf-debugger-card" id="tf-debugger-card">
      <div class="head">
        <span class="title">Debugger output</span>
        <button class="tf-copy-button" id="tf-copy">Copy</button>
      </div>
      <pre id="tf-log"></pre>
    </div>

    <div class="tf-error-action-row" id="tf-error-actions">
      <button class="tf-reload-button" id="tf-reload-btn">Reload</button>
    </div>
    `;
  document.body.appendChild(el);

  // ---- Logger ---------------------------------------------------------------
  const logBuffer = [];
  const logEl = () => document.getElementById('tf-log');
  const write = (level, msg) => {
    const line = `[${new Date().toISOString().substr(11, 12)}] [${level}] ${msg}`;
    logBuffer.push(line);
    const pre = logEl();
    if (pre) {
      pre.textContent += (pre.textContent ? '\n' : '') + line;
      pre.scrollTop = pre.scrollHeight;
    }
    if (level !== 'STATUS_UPDATE') {
      window.dispatchEvent(new CustomEvent('tf:log', { detail: { level, msg, time: Date.now() }}));
    }
  };

  // ---- Task tracker ---------------------------------------------------------
  const tasks = new Map();
  const state = { done:0, failed:0, total: 0 };
  let isFinalized = false; // **FIX**: Prevents bar from moving after completion/failure
  
  const ui = {
    logoContainer: () => document.getElementById('tf-logo-container'),
    fill: () => document.getElementById('tf-fill'),
    pct: () => document.getElementById('tf-pct'),
    status: () => document.getElementById('tf-status'),
    continueBtn: () => document.getElementById('tf-continue'),
    debuggerCard: () => document.getElementById('tf-debugger-card'),
    errorActions: () => document.getElementById('tf-error-actions'),
    reloadBtn: () => document.getElementById('tf-reload-btn'),
    copyBtn: () => document.getElementById('tf-copy'),
  };

  function updateBar() {
    if (isFinalized) return; // **FIX**: Stop updating the bar once loading is finished

    const total = Math.max(state.total, 1);
    const pct = Math.floor((state.done / total) * 100);
    const fill = ui.fill();
    const pctEl = ui.pct();
    if (fill && pctEl) {
      fill.style.width = `${pct}%`;
      pctEl.textContent = `${pct}%`;
    }
  }

  function setStatus(text) {
    const s = ui.status();
    if (s) {
      s.textContent = text;
      write('STATUS_UPDATE', text);
    }
  }

  function showContinueButton() {
    const b = ui.continueBtn();
    if (b) {
      b.classList.add('show');
      b.onclick = () => {
        write('OK', 'User confirmed. Entering app.');
        window.dispatchEvent(new CustomEvent('app:launch'));
        fadeOutAndRemove();
      };
    }
  }

  function showErrorUI(errorInfo) {
    const card = ui.debuggerCard();
    const errorActions = ui.errorActions();

    if (card && errorActions) {
      logEl().textContent = errorInfo;
      card.classList.add('show');
      errorActions.classList.add('show'); // **FIX**: Show reload button container
      
      ui.reloadBtn().onclick = () => location.reload();
      ui.copyBtn().onclick = async () => {
        try { await navigator.clipboard.writeText(AppLoader.summary()); setStatus('Logs copied'); }
        catch { setStatus('Copy failed'); }
      };
    }
  }

  function fadeOutAndRemove() {
    el.classList.add('hidden');
    setTimeout(() => {
      el.remove();
      document.body.style.overflow = '';
    }, 600);
  }

  function finalize(success, errorDetail = '') {
    if (isFinalized) return;
    isFinalized = true; // Set flag to stop updates

    const fill = ui.fill();
    if (fill) fill.classList.toggle('bad', !success);

    if (success) {
      setStatus('Loading complete.');
      write('OK', 'All tasks complete. Tap Continue to proceed.');
      showContinueButton();
    } else {
      setStatus('Loading failed. See debugger for details.');
      write('ERR', 'Loader halted due to errors.');
      showErrorUI(errorDetail);
    }
  }

  const AppLoader = {
    register(id, label) {
      if (isFinalized || tasks.has(id)) return;
      tasks.set(id, { label, state:'pending' });
      state.total++;
      setStatus(label + '...');
      updateBar();
    },
    complete(id, note='') {
      const t = tasks.get(id);
      if (isFinalized || !t || t.state !== 'pending') return;
      t.state='done';
      state.done++;
      updateBar();
      if (state.done === state.total && state.failed === 0) {
        setTimeout(() => finalize(true), 300);
      }
    },
    fail(id, error) {
      if (isFinalized) return;
      const t = tasks.get(id) || { label:id, state:'pending' };
      if (!tasks.has(id)) {
        tasks.set(id, t);
        state.total++;
      }
      if (t.state !== 'failed') { t.state='failed'; state.failed++; }
      const msg = (error && error.stack) ? error.stack : (error && error.message) ? error.message : String(error);
      setStatus(`Error: ${t.label}.`);
      finalize(false, `Error: ${t.label}\n${msg}`);
    },
    log(level, msg) { write(level, msg); },
    summary() { return logBuffer.join('\n'); }
  };
  window.AppLoader = AppLoader;

  // Initial setup when script loads
  document.addEventListener('DOMContentLoaded', () => {
    ui.logoContainer().classList.add('show');
  });

  // ---- Wire initial tasks ---------------------------------------------------
  AppLoader.register('phonebook', 'Loading core modules');
  window.addEventListener('app:ready', () => {
    AppLoader.complete('phonebook', `modules: ${Object.keys(window.Phonebook||{}).join(', ')}`);
  });

  // External task events
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

  write('INFO', 'Loader online.');
})();
