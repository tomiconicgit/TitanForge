// src/js/textures.js — Textures panel
(function () {
  'use strict';

  let panel, waiting, list, activeAsset;

  function injectUI() {
    const style = document.createElement('style');
    style.textContent = `
      #tf-textures-panel{position:fixed;top:calc(50vh + 54px);left:0;right:0;bottom:0;
        background:#0D1014;z-index:5;padding:16px;box-sizing:border-box;overflow-y:auto;display:none}
      #tf-textures-panel.show{display:block}
      #tf-textures-list{display:flex;flex-direction:column;gap:8px}
      .tf-tex-row{display:flex;justify-content:space-between;align-items:center;
        padding:10px;background:rgba(255,255,255,.05);border-radius:6px}
      .tf-tex-row .name{color:#e6eef6;font-size:14px}
      .tf-tex-row button{padding:6px 10px;border-radius:8px;border:none;
        background:rgba(255,255,255,.1);color:#fff;cursor:pointer}
    `;
    document.head.appendChild(style);

    panel = document.createElement('div');
    panel.id = 'tf-textures-panel';
    panel.innerHTML = `
      <div id="tf-textures-waiting" style="color:#a0a7b0;text-align:center;margin-top:20px">
        Load a model to view textures.
      </div>
      <div id="tf-textures-list" style="display:none"></div>
    `;
    document.getElementById('app')?.appendChild(panel);

    waiting = panel.querySelector('#tf-textures-waiting');
    list = panel.querySelector('#tf-textures-list');
  }

  function populate() {
    list.innerHTML = '';
    if (!activeAsset) {
      waiting.style.display = 'block';
      list.style.display = 'none';
      return;
    }

    // Collect unique materials on the active asset
    const mats = new Map();
    activeAsset.object.traverse(o => {
      if (o.isMesh && o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => mats.set(m.uuid, m));
        else mats.set(o.material.uuid, o.material);
      }
    });

    if (mats.size === 0) {
      waiting.textContent = 'No materials found on this model.';
      waiting.style.display = 'block';
      list.style.display = 'none';
      return;
    }

    mats.forEach((mat) => {
      const row = document.createElement('div');
      row.className = 'tf-tex-row';
      const name = mat.name || 'Material';
      const hasMap = !!mat.map;

      row.innerHTML = `
        <span class="name">${name} ${hasMap ? '• has baseColor map' : '• no map'}</span>
        <div class="actions">
          <button data-act="set-map">${hasMap ? 'Replace map' : 'Set map'}</button>
          ${hasMap ? '<button data-act="clear-map">Clear</button>' : ''}
        </div>
      `;

      // Hidden input per row for picking an image
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      row.appendChild(input);

      row.addEventListener('click', (e) => {
        const act = e.target?.dataset?.act;
        if (!act) return;
        if (act === 'set-map') input.click();
        if (act === 'clear-map') {
          if (mat.map) { mat.map.dispose(); mat.map = null; mat.needsUpdate = true; populate(); }
        }
      });

      input.addEventListener('change', () => {
        const f = input.files[0]; if (!f) return;
        const url = URL.createObjectURL(f);
        const { THREE } = window.Phonebook;
        const loader = new THREE.TextureLoader();
        loader.load(url, (tex) => {
          tex.flipY = false; // GLTF/GLB convention
          tex.colorSpace = THREE.SRGBColorSpace;
          mat.map?.dispose();
          mat.map = tex;
          mat.needsUpdate = true;
          URL.revokeObjectURL(url);
          populate();
        }, undefined, (err) => console.error('Texture load error', err));
        input.value = '';
      });

      list.appendChild(row);
    });

    waiting.style.display = 'none';
    list.style.display = 'flex';
  }

  function onNav(e) { panel.classList.toggle('show', e.detail.tab === 'textures'); }
  function onActive(e) { activeAsset = e.detail; populate(); }

  function bootstrap() {
    if (window.Textures) return;
    injectUI();
    Navigation.on('change', onNav);
    App.on('asset:activated', onActive);
    window.Textures = {};
    window.Debug?.log('Textures panel ready.');
  }

  if (window.App?.glVersion) bootstrap();
  else window.App?.on('app:booted', bootstrap);
})();