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
    _started: false,
    version: '0.0.1',
    phonebook: null,
    glVersion: null,
    bus: new EventTarget(),
    stages: [],
    config: {
      baseURL: new URL('.', location.href).href
    },

    addStage(id, label, fn, { optional = false } = {}) { this.stages.push({ id, label, fn, optional }); },

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

    on(type, fn) { this.bus.addEventListener(type, fn); return () => this.bus.removeEventListener(type, fn); },
    emit(type, detail) { this.bus.dispatchEvent(new CustomEvent(type, { detail })); },

    async import(id, path, { optional = false } = {}) {
      Task.start(`mod:${id}`, `Loading module: ${id}`);
      try {
        const mod = await import(path);
        Task.done(`mod:${id}`);
        return mod;
      } catch (e) {
        if (optional) { Task.done(`mod:${id}`, 'optional missing'); return null; }
        Task.fail(`mod:${id}`, e);
        throw e;
      }
    },

    async start() {
      if (this._started) { Task.log('Director already started; ignoring.'); return; }
      this._started = true;
      Task.start('director', 'Director starting');

      try {
        this.phonebook = window.Phonebook || null;
        if (!this.phonebook) throw new Error('Phonebook missing (entry script did not expose modules).');

        this.addStage('probe:webgl', 'Probing WebGL capability', async () => {
          const canvas = document.createElement('canvas');
          const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
          if (!gl) throw new Error('WebGL not available');
          this.glVersion = gl instanceof WebGL2RenderingContext ? 'webgl2' : 'webgl1';
          Task.log(`Renderer: ${gl.getParameter(gl.RENDERER)} • ${this.glVersion}`);
        });

        this.addStage('wire:events', 'Wiring global events', async () => {
          window.addEventListener('visibilitychange', () => this.emit('app:visibility', { hidden: document.hidden }));
          window.addEventListener('resize', () => this.emit('app:resize', { w: innerWidth, h: innerHeight }));
        });

        this.addStage('dom:mount', 'Mounting root container', async () => {
          const root = document.getElementById('app');
          if (!root) throw new Error('#app not found');
          root.setAttribute('data-app-mounted', '1');
        });

        await this.runStages();

        await this.import('viewer', './js/viewer.js');
        await this.import('navigation', './js/navigation.js');
        await this.import('menu', './js/menu.js');
        await this.import('modelManager', './js/model.js');
        await this.import('assetManager', './js/asset.js');
        await this.import('tabs', './js/tabs.js');
        await this.import('cleaner', './js/cleaner.js');
        await this.import('copy', './js/copy.js'); // <-- ADDED MODULE
        await this.import('rig', './js/rig.js');
        await this.import('hide', './js/hide.js');
        await this.import('toggles', './js/toggles.js');
        await this.import('transform', './js/transform.js');
        await this.import('meshes', './js/meshes.js');
        await this.import('texture', './js/texture.js');
        await this.import('developer', './js/developer.js');

        Task.done('director', `OK • ${this.glVersion || 'webgl?'}`);
        this.emit('app:booted', { version: this.version, gl: this.glVersion });

      } catch (e) {
        Task.fail('director', e);
        throw e;
      }
    }
  };

  window.App = App;

  if (document.readyState !== 'loading') {
      App.start();
  } else {
      document.addEventListener('DOMContentLoaded', () => App.start());
  }
})();
