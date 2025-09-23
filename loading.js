// loading.js â Titan Forge launch screen
(() => {
  // ---- DOM scaffold ---------------------------------------------------------
  const style = document.createElement('style');
  style.textContent = `
  :root {
    --tf-bg: #0b0f14;
    --tf-fg: #e6eef6;
    --tf-accent-grad: linear-gradient(90deg, #6a11cb 0%, #2575fc 100%);
    --tf-bad: #ff3b30;
  }
  html, body {
    background: var(--tf-bg);
    overflow: hidden;
  }
  #tf-loader {
    position:fixed; inset:0; z-index:9999; background:var(--tf-bg);
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    transition:opacity .6s ease;
    opacity:1;
    color: var(--tf-fg);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  }
  #tf-loader.hidden { opacity:0; pointer-events:none; }

  /* Logo */
  .tf-logo-container {
    text-align: center;
    margin-bottom: 40px;
  }
  .tf-logo-text {
    font-size: 36px;
    font-weight: 700;
    letter-spacing: 1px;
  }
  .tf-logo-subtext {
    font-size: 16px;
    opacity: 0.7;
    margin-top: 8px;
  }

  /* State container for spinner/button/error */
  #tf-state-container {
    height: 80px; /* Reserve space */
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Spinner */
  .tf-spinner {
    width: 48px; height: 48px;
    border: 5px solid rgba(255,255,255,0.2);
    border-top-color: #fff;
    border-radius: 50%;
    animation: tf-spin 1s linear infinite;
  }
  @keyframes tf-spin { to { transform: rotate(360deg); } }

  /* Start Button */
  .tf-start-button {
    display: none; /* Hidden by default */
    padding: 12px 30px;
    font-size: 16px;
    font-weight: 600;
    border-radius: 25px;
    border: none;
    background: var(--tf-accent-grad);
    color: #fff;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    transition: transform 0.2s ease;
  }
  .tf-start-button:hover { transform: scale(1.05); }

  /* Error Display */
  .tf-error-display {
    display: none; /* Hidden by default */
    text-align: center;
    color: #ff8a80;
  }
  .tf-error-display button {
    margin-top: 15px;
    padding: 10px 25px;
    font-size: 15px;
    font-weight: 600;
    border-radius: 20px;
    border: none;
    background: var(--tf-bad);
    color: #fff;
    cursor: pointer;
  }
  `;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = 'tf-loader';
  el.innerHTML = `
    <div class="tf-logo-container">
      <div class="tf-logo-text">Titan Forge</div>
      <div class="tf-logo-subtext">Mobile Model Editor</div>
    </div>
    <div id="tf-state-container">
      <div class="tf-spinner" id="tf-spinner"></div>
      <button class="tf-start-button" id="tf-start-btn">Start Application</button>
      <div class="tf-error-display" id="tf-error-display">
        <p>Application failed to load.</p>
        <button id="tf-reload-btn">Reload</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  // --- State & UI Elements ---
  const tasks = new Map();
  const state = { done: 0, failed: 0, total: 0 };
  let isFinalized = false;
  
  const ui = {
    spinner: () => document.getElementById('tf-spinner'),
    startBtn: () => document.getElementById('tf-start-btn'),
    errorDisplay: () => document.getElementById('tf-error-display'),
    reloadBtn: () => document.getElementById('tf-reload-btn'),
  };

  // --- Core Functions ---
  function fadeOutAndRemove() {
    el.classList.add('hidden');
    setTimeout(() => {
      el.remove();
      document.body.style.overflow = '';
    }, 600);
  }

  function checkCompletion() {
      if (isFinalized) return;
      if (state.done === state.total && state.failed === 0) {
          setTimeout(() => finalize(true), 300);
      }
  }

  function finalize(success) {
    if (isFinalized) return;
    isFinalized = true;

    const spinner = ui.spinner();
    if (spinner) spinner.style.display = 'none';

    if (success) {
      const startBtn = ui.startBtn();
      if (startBtn) {
        startBtn.style.display = 'block';
        startBtn.onclick = fadeOutAndRemove;
      }
    } else {
      const errorDisplay = ui.errorDisplay();
      if(errorDisplay) {
        errorDisplay.style.display = 'block';
        ui.reloadBtn().onclick = () => location.reload();
      }
    }
  }

  // --- Public API ---
  const AppLoader = {
    register(id, label) {
      if (isFinalized || tasks.has(id)) return;
      tasks.set(id, { label, state: 'pending' });
      state.total++;
    },
    complete(id) {
      const t = tasks.get(id);
      if (isFinalized || !t || t.state !== 'pending') return;
      t.state = 'done';
      state.done++;
      checkCompletion();
    },
    fail(id, error) {
      if (isFinalized) return;
      const t = tasks.get(id) || { label: id, state: 'pending' };
      if (!tasks.has(id)) { tasks.set(id, t); state.total++; }
      if (t.state !== 'failed') { t.state = 'failed'; state.failed++; }
      finalize(false);
    },
    log(level, msg) {
        // This function is kept for compatibility with debugger.js, but does not display anything.
        if (level === 'ERR') console.error(`[Loader Log] ${msg}`);
    },
  };
  window.AppLoader = AppLoader;
  
  // --- Event Listeners ---
  AppLoader.register('phonebook', 'Loading core modules');
  window.addEventListener('app:ready', () => AppLoader.complete('phonebook'));
  window.addEventListener('tf:task:register', e => AppLoader.register(e.detail?.id, e.detail?.label));
  window.addEventListener('tf:task:complete', e => AppLoader.complete(e.detail?.id, e.detail?.note));
  window.addEventListener('tf:task:fail', e => AppLoader.fail(e.detail?.id, e.detail?.error || 'Unknown failure'));
})();
