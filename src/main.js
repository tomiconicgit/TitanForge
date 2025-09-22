// src/main.js — Director/orchestrator for Titan Forge PWA
// Centralises boot order and shared utilities.

(() => {
  'use strict';

  const Task = {
    start: (id, label) => window.Debug?.task?.start?.(id, label),
    done:  (id, note)  => window.Debug?.task?.done?.(id, note),
    fail:  (id, err)   => window.Debug?.task?.fail?.(id, err),
    log:   (msg)       => window.Debug?.log?.(msg)
  };

  const App = {
    // NEW: start guard
    _started: false,

    version: '0.0.1',
    phonebook: null,          // filled on start from window.Phonebook
    glVersion: null,
    bus: new EventTarget(),   // simple app-wide event hub
    stages: [],               // [{ id, label, fn, optional }]
    config: {
      baseURL: new URL('.', location.href).href
    },

    // ---- Stage pipeline -----------------------------------------------------
    addStage(id, label, fn, { optional = false } = {}) {
      this.stages.push({ id, label, fn, optional });
    },

    async runStages() {
      for (const s of this.stages) {
        Task.start(s.id, s.label);
        try {
          const out = await s.fn();
          s.out = out;
          Task.done(s.id);
        } catch (e) {
          if (s.optional) {
            console.warn(`[stage:optional] ${s.id}`, e);
            Task.done(s.id, 'optional skipped');
          } else {
            Task.fail(s.id, e);
            throw e;
          }
        }
      }
    },

    // ---- Event bus helpers --------------------------------------------------
    on(type, fn) { this.bus.addEventListener(type, fn); return () => this.bus.removeEventListener(type, fn); },
    emit(type, detail) { this.bus.dispatchEvent(new CustomEvent(type, { detail })); },

    // ---- Safe dynamic import for later modules ------------------------------
    async import(id, path, { optional = false } = {}) {
      Task.start(`mod:${id}`, `Loading module ${id}`);
      try {
        const mod = await import(path);
        Task.done(`mod:${id}`, path);
        return mod;
      } catch (e) {
        if (optional) { Task.done(`mod:${id}`, 'optional missing'); return null; }
        Task.fail(`mod:${id}`, e);
        throw e;
      }
    },

    // ---- Boot ---------------------------------------------------------------
    async start() {
      // NEW: prevent double-start
      if (this._started) { Task.log('Director already started; ignoring.'); return; }
      this._started = true;

      Task.start('director', 'Director starting');

      try {
        // Show global loader before stages run
        window.App.emit('global-loader:show'); // Emit custom event to show global loader

        // Bind phonebook (Three, OrbitControls, GLTFLoader)
        this.phonebook = window.Phonebook || null;
        if (!this.phonebook) throw new Error('Phonebook missing (entry script did not expose modules).');

        // Define minimal, non-visual stages (no 404 risk)
        this.addStage('probe:webgl', 'Probing WebGL capability', async () => {
          const canvas = document.createElement('canvas');
          const gl2 = canvas.getContext('webgl2');
          const gl  = gl2 || canvas.getContext('webgl');
          if (!gl) throw new Error('WebGL not available');
          this.glVersion = gl2 ? 'webgl2' : 'webgl1';
          Task.log(`Renderer: ${gl.getParameter(gl.RENDERER)} • ${this.glVersion}`);
        });

        this.addStage('wire:events', 'Wiring global events', async () => {
          window.addEventListener('visibilitychange', () => this.emit('app:visibility', { hidden: document.hidden }));
          window.addEventListener('resize', () => this.emit('app:resize', { w: innerWidth, h: innerHeight }));
        });

        this.addStage('dom:mount', 'Mounting root container', async () => {
          const root = document.getElementById('app');
          if (!root) throw new Error('#app not found');
          // Reserve a hook for the first real screen (we’ll attach later).
          root.setAttribute('data-app-mounted', '1');
        });

        await this.runStages();

        Task.done('director', `OK • ${this.glVersion || 'webgl?'}`);
        this.emit('app:booted', { version: this.version, gl: this.glVersion });

        // Hide global loader after all stages are done
        window.App.emit('global-loader:hide'); // Emit custom event to hide global loader

      } catch (e) {
        Task.fail('director', e);
        // Hide global loader even on error
        window.App.emit('global-loader:hide');
        throw e;
      }
    }
  };

  // Expose globally for later modules to use
  window.App = App;

  // ---- Manage Global 3D Loader Visibility ---------------------------------
  const globalLoader = document.getElementById('tf-global-loader');
  if (globalLoader) {
    window.App.on('global-loader:show', () => globalLoader.classList.add('show'));
    window.App.on('global-loader:hide', () => globalLoader.classList.remove('show'));
  }


  // ---- Start after loader’s Continue (and be robust to different dispatchers)
  const kick = () => window.App.start();
  window.addEventListener('app:launch', kick);     // existing path
  document.addEventListener('app:launch', kick);   // NEW: extra listener

  // Safety: if the loader isn't present (or already removed), auto-start
  if (!document.getElementById('tf-loader')) {
    setTimeout(() => { if (!App._started) App.start(); }, 0);  // NEW
  }

  // Helpful log while idle
  if (document.readyState !== 'loading') {
    Task.log('Director loaded; waiting for app:launch (press Continue). You can also call App.start() manually.');
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      Task.log('Director ready; awaiting app:launch');
    });
  }
})();
