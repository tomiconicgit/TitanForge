// debugger.js — global error/404 catcher + consoles + fetch monitor
(() => {
  const ts = () => new Date().toISOString().replace('T',' ').replace('Z','');
  const emit = (level, msg) => {
    window.dispatchEvent(new CustomEvent('tf:log', { detail: { level, msg, time: Date.now() }}));
    // Mirror into loader if present
    if (window.AppLoader && typeof window.AppLoader.log === 'function') {
      window.AppLoader.log(level, msg);
    }
  };

  // Flush tf:log into the loader's <pre> if loader booted before us.
  window.addEventListener('tf:log', (e) => {
    // no-op; loader already listens. This ensures other listeners can hook too.
  });

  // ---- Console trapping (non-destructive) ----------------------------------
  ['log','warn','error'].forEach((k) => {
    const orig = console[k].bind(console);
    console[k] = (...args) => {
      try {
        const msg = args.map(a => typeof a==='string' ? a : JSON.stringify(a, null, 2)).join(' ');
        const level = (k==='error' ? 'ERR' : k==='warn' ? 'WARN' : 'LOG');
        emit(level, msg);
      } catch { /* ignore */ }
      orig(...args);
    };
  });

  // ---- Global runtime errors ------------------------------------------------
  window.addEventListener('error', (event) => {
    // Resource load error (script/img/link) -> event.target tagName present
    const t = event.target;
    if (t && (t.tagName === 'IMG' || t.tagName === 'SCRIPT' || t.tagName === 'LINK')) {
      const url = t.src || t.href || '(unknown)';
      const tag = t.tagName.toLowerCase();
      const msg = `Resource load error (${tag}): ${url}`;
      emit('ERR', msg);
      if (window.AppLoader) window.AppLoader.fail(`res:${url}`, new Error(msg));
      return;
    }
    // JS runtime error
    const msg = `${event.message} @ ${event.filename}:${event.lineno}:${event.colno}`;
    emit('ERR', msg);
    if (window.AppLoader) window.AppLoader.fail('runtime', event.error || new Error(msg));
  }, true);

  // ---- Unhandled Promise rejections ----------------------------------------
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason || {};
    const msg = `Unhandled rejection: ${reason.message || String(reason)}`;
    emit('ERR', msg);
    if (window.AppLoader) window.AppLoader.fail('promise', reason instanceof Error ? reason : new Error(msg));
  });

  // ---- Fetch monitor (network failures, 404/5xx) ---------------------------
  if (window.fetch) {
    const _fetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const url = args[0];
      try {
        const res = await _fetch(...args);
        if (!res.ok) {
          const msg = `HTTP ${res.status} ${res.statusText} — ${url}`;
          emit('WARN', msg);
          // Not always fatal, so don't fail loader automatically.
        }
        return res;
      } catch (e) {
        const msg = `Fetch error — ${url}: ${e && e.message ? e.message : e}`;
        emit('ERR', msg);
        if (window.AppLoader) window.AppLoader.fail(`fetch:${url}`, e);
        throw e;
      }
    };
  }

  // ---- Convenience API ------------------------------------------------------
  window.Debug = {
    log: (msg) => emit('LOG', msg),
    warn: (msg) => emit('WARN', msg),
    error: (msgOrErr) => emit('ERR', msgOrErr instanceof Error ? msgOrErr.stack || msgOrErr.message : String(msgOrErr)),
    task: {
      start: (id, label) => window.dispatchEvent(new CustomEvent('tf:task:register', { detail: { id, label } })),
      done:  (id, note)   => window.dispatchEvent(new CustomEvent('tf:task:complete', { detail: { id, note } })),
      fail:  (id, error)  => window.dispatchEvent(new CustomEvent('tf:task:fail', { detail: { id, error } }))
    }
  };

  emit('LOG', 'Debugger online.');
})();