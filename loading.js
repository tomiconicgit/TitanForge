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
    margin-bottom: 30px; /* Space between logo and loading bar */
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .tf-logo-container.show {
    opacity: 1;
  }
  .tf-logo-image {
    width: 100px; /* Adjust size as needed */
    height: 100px;
    margin-bottom: 15px;
  }
  .tf-logo-text {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: 0.8px;
    color: var(--tf-fg);
    margin-bottom: 5px;
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
    gap: 20px;
  }
  .tf-bar-wrapper {
    width: 100%;
    position: relative;
    height: 24px; /* Taller bar */
    border-radius: 12px;
    overflow: hidden;
    background: rgba(255,255,255,.1); /* Lighter background for the bar track */
    border: none; /* No border for a cleaner look */
  }
  .tf-bar-fill {
    position: absolute; left:0; top:0; bottom:0; width:0%;
    background: linear-gradient(90deg, #6a11cb 0%, #2575fc 100%); /* Blue-purple gradient */
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; color: var(--tf-fg); /* Percentage text on bar */
    transition: width 0.3s ease; /* Smooth fill */
    text-shadow: 0 1px 2px rgba(0,0,0,0.4);
  }
  .tf-bar-fill.bad {
    background: linear-gradient(90deg, var(--tf-bad), #ff6b6b);
  }
  .tf-percentage {
    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
    font-size: 14px;
    color: var(--tf-fg); /* Separate percentage text for contrast */
    text-shadow: 0 1px 2px rgba(0,0,0,0.4);
    pointer-events: none; /* Make sure it doesn't interfere with clicks */
  }
  /* Process text below bar */
  .tf-process-text {
    font-size: 14px;
    opacity: 0.8;
    height: 20px; /* Reserve space to prevent layout shifts */
    text-align: center;
    width: 100%;
    color: #a0a0a0; /* Slightly muted color */
  }

  /* Continue button */
  .tf-continue-button {
    margin-top: 30px; /* Space between process text/error and button */
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
    display: none; /* Hidden by default */
  }
  .tf-continue-button:hover {
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    transform: translateY(-2px);
  }
  .tf-continue-button:active {
    transform: translateY(1px);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  }
  .tf-continue-button[disabled] {
    opacity: 0.5;
    pointer-events: none;
  }
  .tf-continue-button.show {
    display: block;
  }

  /* Error Debugger Card */
  .tf-debugger-card {
    background: rgba(0,0,0,.6); /* Darker, more prominent background */
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 12px;
    padding: 15px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: var(--tf-loader-max-width);
    max-height: 20vh; /* Controlled height */
    margin-top: 20px; /* Space above */
    opacity: 0; /* Initially hidden */
    transform: translateY(20px); /* Slide up on show */
    transition: opacity 0.5s ease, transform 0.5s ease;
  }
  .tf-debugger-card.show {
    opacity: 1;
    transform: translateY(0);
  }
  .tf-debugger-card .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .tf-debugger-card .head .title {
    font-size: 13px;
    opacity: 0.8;
    color: var(--tf-fg);
  }
  .tf-debugger-card pre {
    margin:0; padding:10px; border-radius:8px; overflow:auto; white-space:pre-wrap; word-wrap:break-word;
    background:rgba(255,255,255,.04); color:#cde3ff; font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,Monaco,monospace;
    max-height: calc(20vh - 50px); /* Adjust based on padding/head height */
    flex-grow: 1;
  }
  .tf-debugger-card .tf-copy-button {
    padding: 6px 15px;
    font-size: 13px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,.2);
    background: rgba(255,255,255,.1);
    color: var(--tf-fg);
    cursor: pointer;
    transition: background 0.2s ease;
  }
  .tf-debugger-card .tf-copy-button:hover {
    background: rgba(255,255,255,.15);
  }
  .tf-debugger-card .tf-copy-button:active {
    transform: translateY(1px);
  }
  .tf-error-action-row {
    display: flex;
    justify-content: center;
    gap: 15px;
    margin-top: 20px;
    width: var(--tf-loader-max-width);
  }
  .tf-error-action-row .tf-reload-button {
    padding: 10px 25px;
    font-size: 15px;
    font-weight: 600;
    border-radius: 20px;
    border: none;
    background: var(--tf-bad);
    color: #fff;
    cursor: pointer;
    transition: background 0.2s ease, transform 0.2s ease;
  }
  .tf-error-action-row .tf-reload-button:hover {
    background: #e62e2e;
  }
  .tf-error-action-row .tf-reload-button:active {
    transform: translateY(1px);
  }
  `;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = 'tf-loader';
  el.innerHTML = `
    <div class="tf-logo-container" id="tf-logo-container">
      <img src="data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgNjQgNjQiIGFyaWEtaGlkZGVuPSJ0cnVlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogIDxkZWZzPgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJhIiB4MT0iMCIgeDI9IjEiPjxzYWx0IG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzU0NjlGRiIvPjxzYWx0IG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzJFOTBGMyIvPjwvZ3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImIiIHgxPSIwIiB4Mj0iMSI+PHNhbHQgb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjRkY0RTVBIi8+PHNhbHQgb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjRkZDNjE3Ii8+PC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHBhdGggZD0iTTMyIDYuNEMxOC40IDYuNCA3LjIgMTcuNiA3LjIgMzFDNy4yIDQ0LjQgMTguNCA1NS42IDMyIDU1LjYgNDUuNiA1NS42IDU2LjggNDQuNCA1Ni44IDMxIDU2LjggMTcuNiA0NS42IDYuNCAzMiA2LjRaTTE1LjMgMjguNkgxNi42TDE5IDQwLjJoLTMuOFpNMzIgMzguOGMtMy42IDAtNi43LTItOC41LTQuNkwyMy4yIDMzYzEuNSAyLjEgMy43IDMuMiA1LjcgMy4yIDIgMCAzLjktMS4xIDUuMy0zLjJsMC40LTAuNmMwLjQgMC4xIDAuOSAwLjIgMS4zIDAuMiAwLjcgMCAxLjQtMC4xIDIgLTAuNCBMNDEgMzEuOCAzNi40IDM2LjJDNDEuNSA0MSA0OC42IDQxLjQgNTIgMzcuNkw1Mi40IDM4LjRDNTYuNCAzMy44IDU4IDIzLjIgNTMgMTguOGM0LjQgMi44IDYuOCAzLjYgOC40IDMuNiAwLjcgMCAxLjQtMC4xIDIgLTAuNCBMNDIgMzkuMiAzOC40IDM2LjJDNDMuNSA0MCA1MC42IDQxLjQgNTUgMzcuNkw1NS40IDM4LjRDNTkuNCAzMy44IDYxIDIxLjIgNTYgMTYuOGM0LjQgMi44IDYuOCAzLjYgOC40IDMuNiAwLjcgMCAxLjQtMC4xIDIgLTAuNCBMNDIgMzkuMiAzOC40IDM2LjJDNDMuNSA0MCA1MC42IDQxLjQgNTUgMzcuNkw1NS40IDM4LjRDNTkuNCAzMy44IDYxIDIxLjIgNTYgMTYuOGM0LjQgMi44IDYuOCAzLjYgOC40IDMuNiAwLjcgMCAxLjQtMC4xIDIgLTAuNCBMNDIgMzkuMiAzOC40IDM2LjJDNDMuNSA0MCA1MC42IDQxLjQgNTUgMzcuNkw1NS40IDM4LjRDNTkuNCAzMy44IDYxIDIxLjIgNTYgMTYuOGM0LjQgMi44IDYuOCAzLjYgOC40IDMuNiAwLjcgMCAxLjQtMC4xIDIgLTAuNCBMNDIgMzkuMiAzOC40IDM2LjJDNDMuNSA0MCA1MC42IDQxLjQgNTUgMzcuNkw1NS40IDM4LjRDNTkuNCAzMy44IDYxIDIxLjIgNTYgMTYuOGM0LjQgMi44IDYuOCAzLjYgOC40IDMuNiAwLjcgMCAxLjQtMC4xIDIgLTAuNCBMNDIgMzkuMiAzOC40IDM2LjJDNDMuNSA0MCA1MC42IDQxLjQgNTUgMzcuNkw1NS40IDM4LjRDNTkuNCAzMy44IDYxIDIxLjIgNTYgMTYuOGM0LjQgMi44IDYuOCAzLjYgOC40IDMuNiAwLjcgMCAxLjQtMC4xIDIgLTAuNCBMNDIgMzkuMiAzOC40IDM2LjJDNDMuNSA0MCA1MC42IDQxLjQgNTUgMzcuNkw1NS40IDM4LjRDNTkuNCAzMy44IDYxIDIxLjIgNTYgMTYuOGM0LjQgMi44IDYuOCAzLjYgOC40IDMuNiAwLjcgMCAxLjQtMC4xIDIgLTAuNCBMNDIgMzkuMiAzOC40IDM2LjJDNDMuNSA0MCA1MC42IDQxLjQgNTUgMzcuNkw1NS40IDM4LjRDNTkuNCAzMy44IDYxIDIxLjIgNTYgMTYuOEwxNi41IDIzLjZMMjIuMiAyNC4yQzE5LjYgMjEgMTcgMjAgMTQuNiAyMC42TDE1LjMgMjguNkgxNi42TDE5IDQwLjJoLTMuOFpNMzIgNi40QzE4LjQgNi40IDcuMiAxNy42IDcuMiAzMUw3LjIgMzFDNy4yIDQ0LjQgMTguNCA1NS42IDMyIDU1LjYgNDUuNiA1NS42IDU2LjggNDQuNCA1Ni44IDMxIDU2LjggMTcuNiA0NS42IDYuNCAzMiA2LjRaIiBmaWxsPSJ1cmwoI2EpIi8+PHBhdGggZD0iTTQ0LjggMjguNmgtMi40TDM0LjMgNDAuMmgyLjhaTTQxLjggMjMuN0wzMy40IDIyLjEgMjguMiAzMi44IDMzLjggMzMuMiAzNi40IDI3LjZMNjEuMiAzNy42QzYxLjkgMzUgNjEuNyAyNy40IDU4LjYgMjQuMkw1OC4yIDIzLjUgNDQuOCAyOC42aC0yLjRMMzQuMyA0MC4ySDMyLjhsLTkuMS0xNS41TDE4LjggMjEuNkwxNi41IDIzLjZMMjkuMyAzMy4yIDI2LjQgMzguOUwzMiA1NS42QzQ1LjYgNTUuNiA1Ni44IDQ0LjQgNTYuOCAzMSA1Ni44IDI3LjYgNTUuNyAyNC41IDU0LjIgMjEuOUM0MS40IDI0LjYgMjAuNiAyMC42IDI4LjIgMTkuOEwxMi42IDMyLjZMOS41IDM0LjJMMTMuMiAyOS44IDE3LjQgMjUuOEwxMi42IDMyLjYyNy42IDIzLjYxNi41IDIyLjIgMjIuMiAyNC4yQzE5LjYgMjEgMTcgMjAgMTQuNiAyMC42bC0wLjcgMC45TDM2LjQgMjkuM0M0Ni40IDMxIDQ4LjQgMzIgNDkuNiAzMi44IDQxLjQgMzIuOCAzNS42IDMxLjIgMzAuMiAyNC40TDMxIDIzLjZMMzMuNCAyMi4xIDI4LjIgMzIuOCAzMy44IDMzLjIgMzYuNCAyNy42TDM2IDM3LjZoMi4zTDM4LjggMzUuNkw0My42IDMwLjIgMzYuNiAzNS40IDQyLjQgNDEuNiAzNy4yIDUyLjJMNDIuNCA0OC42IDU0LjQgMzEuNkM1Ni41IDI0LjIgNTUuNiAxNy4xIDQ3LjIgMTIuOEw0Ni44IDEyLjEgMzMuNCAyMC4yIDQxLjggMjMuN0wzMy40IDIyLjEgMjguMiAzMi44IDMzLjggMzMuMiAzNi40IDI3LjZMNjEgMzcuNkM2MS43IDM1IDYxLjUgMjcuNCA1OC40IDI0LjJMNTguMiAyMy41IDQ0LjggMjguNkg0MC4yTDM1IDMyLjZMNDIgNDQuNUw0NS40IDUwLjlMNDkuNiAzMC41TDU2LjQgMjguM0w2MiA0MS4yQzYyLjggMzkgNjIuNyAzMi43IDU5LjIgMjkuNkw1OC44IDI4LjYgNDUuNiAzMi42IDM3LjYgNDguMiAyMi40IDQ0LjYgMTcuNiAzNC4yIDE3LjYgMzMuNkwxNi41IDIzLjZMMjIuMiAyNC4yQzE5LjYgMjEgMTcgMjAgMTQuNiAyMC42TDguMiAyNC42QzguNiAyMy4yIDkuNiAyMi40IDEwLjYgMjEuNCA3LjIgMTcuNiA3LjIgMzEgNy4yIDMxYzAgMTMuNiAxMS4yIDI0LjggMjQuOCAyNC44eiIgZmlsbD0idXJsKCNiKSIvPjwvc3ZnPg==" class="tf-logo-image" alt="Titan Forge Logo">
      <div class="tf-logo-text">Titan Forge</div>
      <div class="tf-logo-subtext">Launching...</div>
    </div>

    <div class="tf-loading-area">
      <div class="tf-bar-wrapper">
        <div class="tf-bar-fill" id="tf-fill"></div>
        <div class="tf-percentage" id="tf-pct">0%</div>
      </div>
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
  const ts = () => new Date().toISOString().replace('T',' ').replace('Z','');
  const write = (level, msg) => {
    const line = `[${ts()}] [${level}] ${msg}`;
    logBuffer.push(line);
    const pre = logEl();
    if (pre) {
      pre.textContent += (pre.textContent ? '\n' : '') + line;
      pre.scrollTop = pre.scrollHeight;
    }
    // Only dispatch for `tf:log` which `debugger.js` listens to
    if (level !== 'STATUS_UPDATE') { // STATUS_UPDATE is internal to loader
      window.dispatchEvent(new CustomEvent('tf:log', { detail: { level, msg, time: Date.now() }}));
    }
  };

  // ---- Task tracker ---------------------------------------------------------
  const tasks = new Map();   // id -> { label, state }
  const state = { done:0, failed:0, total: 0 }; // Added total to manage tasks added
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

  let loadingTimeout = null; // For artificial delay

  function updateBar() {
    const total = Math.max(state.total, 1);
    const currentProgress = (state.done / total) * 100;
    const pct = Math.floor(currentProgress);

    const fill = ui.fill();
    const pctEl = ui.pct();
    if (fill && pctEl) {
      // Small delay for visual slowing
      clearTimeout(loadingTimeout);
      loadingTimeout = setTimeout(() => {
        fill.style.width = `${pct}%`;
        pctEl.textContent = `${pct}%`;
      }, 100); // Adjust this delay for smoother/slower progress
    }
  }

  function setStatus(text) {
    const s = ui.status();
    if (s) {
      s.textContent = text;
      write('STATUS_UPDATE', text); // Log internal status updates
    }
  }

  function showContinueButton() {
    const b = ui.continueBtn();
    if (b) {
      b.classList.add('show');
      b.disabled = false;
      b.onclick = () => {
        write('OK', 'User confirmed. Entering app.');
        window.dispatchEvent(new CustomEvent('app:launch'));
        fadeOutAndRemove();
      };
    }
  }

  function showDebuggerCard(errorInfo) {
    const card = ui.debuggerCard();
    const pre = logEl();
    const errorActions = ui.errorActions();

    if (card && pre && errorActions) {
      pre.textContent = errorInfo; // Display the error specifically
      card.classList.add('show');
      errorActions.style.display = 'flex'; // Show reload button
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
      // Restore body overflow in case it was hidden
      document.body.style.overflow = '';
      document.body.style.background = ''; // Clear black background if set
    }, 600);
  }

  function finalize(success, errorDetail = '') {
    const fill = ui.fill();
    if (fill) fill.classList.toggle('bad', !success);

    if (success) {
      setStatus('Loading complete.');
      write('OK', 'All tasks complete. Tap Continue to proceed.');
      showContinueButton();
    } else {
      setStatus('Loading failed. See debugger for details.');
      write('ERR', 'Loader halted due to errors.');
      showDebuggerCard(errorDetail);
    }
  }

  const AppLoader = {
    register(id, label) {
      if (!tasks.has(id)) {
        tasks.set(id, { label, state:'pending' });
        state.total++; // Increment total tasks
        setStatus(label + '...'); // Update process text
        // write('INFO', `▶ ${label}…`); // Mute this if only status line is needed
      }
      updateBar();
    },
    complete(id, note='') {
      const t = tasks.get(id);
      if (!t || t.state!=='pending') return;

      t.state='done';
      state.done++;
      updateBar();
      // write('OK', `✓ ${t.label}${note ? ' — '+note : ''}`); // Mute this if only status line is needed

      if (state.done === state.total && state.failed === 0) {
        // No auto-fade; require user to press Continue
        clearTimeout(loadingTimeout); // Clear any pending bar updates
        setTimeout(() => finalize(true), 500); // Small delay before finalize for a smoother end
      }
    },
    fail(id, error) {
      const t = tasks.get(id) || { label:id, state:'pending' };
      if (!tasks.has(id)) { // If task wasn't registered, add it as a failed task
        tasks.set(id, t);
        state.total++;
      }
      if (t.state !== 'failed') { t.state='failed'; state.failed++; }
      updateBar();

      const msg = (error && error.stack) ? error.stack : (error && error.message) ? error.message : String(error);
      // write('ERR', `✗ ${t.label} — ${msg}`); // Mute this if only status line is needed
      setStatus(`Error: ${t.label}.`); // Update process text with error summary
      finalize(false, `Error: ${t.label}\n${msg}`);
    },
    log(level, msg) { write(level, msg); },
    summary() { return logBuffer.join('\n'); }
  };
  window.AppLoader = AppLoader;

  // Initial setup when script loads
  document.addEventListener('DOMContentLoaded', () => {
    // Fade in the logo
    ui.logoContainer().classList.add('show');
    // Ensure debugger card and error actions are hidden initially
    ui.debuggerCard().style.display = 'none';
    ui.errorActions().style.display = 'none';

    // The 'Hide' button from the original is removed as per the redesign spec
    // if you want to keep a generic 'hide' for the whole loader, re-add it in HTML and JS
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

  // Boot logs
  write('INFO', 'Loader online.');
  write('INFO', 'Awaiting module initialization signals...');
})();
