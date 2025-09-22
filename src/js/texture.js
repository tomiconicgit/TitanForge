// src/js/texture.js — Textures panel with mesh selection and PBR map support
(function () {
  'use strict';

  // --- Module State ---
  let panel, waiting, meshSelectContainer, meshSelectBtn, meshDropdownList, textureGrid;
  let fileInput;

  let activeAsset = null;
  let activeMesh = null;
  let currentMapTarget = null; // Stores which map we're about to load (e.g., 'map', 'normalMap')

  // --- UI Injection ---
  function injectUI() {
    const style = document.createElement('style');
    style.textContent = `
      #tf-textures-panel {
        position: fixed; top: calc(50vh + 54px); left: 0; right: 0; bottom: 0;
        background: #0D1014; z-index: 5; padding: 16px; box-sizing: border-box;
        overflow-y: auto; display: none; flex-direction: column; gap: 20px;
      }
      #tf-textures-panel.show { display: flex; }

      /* Waiting Message */
      #tf-textures-waiting { color: #a0a7b0; text-align: center; margin: auto; }

      /* Mesh Selector Dropdown */
      #tf-mesh-select-container { position: relative; }
      #tf-mesh-select-btn {
        width: 100%; padding: 12px; font-size: 15px; font-weight: 600;
        border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);
        background: rgba(255,255,255,0.1); color: #fff; cursor: pointer;
        text-align: left;
      }
      #tf-mesh-dropdown-list {
        display: none; position: absolute; top: 105%; left: 0; right: 0;
        background: #1C2026; border: 1px solid rgba(255,255,255,0.2);
        border-radius: 8px; z-index: 11; max-height: 200px; overflow-y: auto;
      }
      #tf-mesh-dropdown-list.show { display: block; }
      .tf-mesh-item {
        padding: 10px 12px; color: #e6eef6; cursor: pointer;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      .tf-mesh-item:last-child { border-bottom: none; }
      .tf-mesh-item:hover { background: rgba(255,255,255,0.1); }

      /* Texture Button Grid */
      #tf-texture-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr); /* <-- UPDATED FOR 2x3 LAYOUT */
        gap: 10px;
      }
      .tf-texture-btn {
        padding: 12px 8px; border-radius: 6px; border: none;
        background: rgba(255,255,255,0.08);
        color: #fff; font-size: 13px; font-weight: 500;
        cursor: pointer; transition: background-color 0.2s ease;
      }
      .tf-texture-btn:hover { background: rgba(255,255,255,0.15); }
      .tf-texture-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    `;
    document.head.appendChild(style);

    panel = document.createElement('div');
    panel.id = 'tf-textures-panel';
    panel.innerHTML = `
      <div id="tf-textures-waiting">Load a model to view textures.</div>
      <div id="tf-texture-editor" style="display:none;">
        <div id="tf-mesh-select-container">
          <button id="tf-mesh-select-btn">-- Select a Mesh --</button>
          <div id="tf-mesh-dropdown-list"></div>
        </div>
        <div id="tf-texture-grid">
          <button class="tf-texture-btn" data-act="map">Albedo</button>
          <button class="tf-texture-btn" data-act="normalMap">Normal</button>
          <button class="tf-texture-btn" data-act="metalnessMap">Metalness</button>
          <button class="tf-texture-btn" data-act="roughnessMap">Roughness</button>
          <button class="tf-texture-btn" data-act="aoMap">Ambient Occlusion</button>
          <button class="tf-texture-btn" data-act="emissiveMap">Emissive</button>
        </div>
      </div>
    `;
    document.getElementById('app')?.appendChild(panel);

    // --- DOM Element References ---
    waiting = panel.querySelector('#tf-textures-waiting');
    meshSelectContainer = panel.querySelector('#tf-mesh-select-container');
    meshSelectBtn = panel.querySelector('#tf-mesh-select-btn');
    meshDropdownList = panel.querySelector('#tf-mesh-dropdown-list');
    textureGrid = panel.querySelector('#tf-texture-grid');

    // --- Hidden File Input for reuse ---
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    panel.appendChild(fileInput);
  }

  // --- Logic & State Management ---

  function selectMesh(mesh) {
    activeMesh = mesh;
    meshSelectBtn.textContent = mesh.name || `Unnamed Mesh (UUID: ...${mesh.uuid.slice(-4)})`;
    meshDropdownList.classList.remove('show');
    updateTextureUI();
  }

  function updateTextureUI() {
    const isMeshSelected = !!activeMesh;
    // Enable/disable all buttons based on whether a mesh is selected
    textureGrid.querySelectorAll('button').forEach(btn => {
        btn.disabled = !isMeshSelected;
        // You could add more logic here to change the button text,
        // e.g., from "Albedo" to "Replace Albedo" if a map exists.
        if(isMeshSelected && activeMesh.material[btn.dataset.act]) {
            btn.style.borderColor = '#00c853'; // Example: highlight if map exists
        } else {
            btn.style.borderColor = '';
        }
    });
  }
  
  function populateMeshDropdown() {
    meshDropdownList.innerHTML = '';
    if (!activeAsset) return;

    const meshes = [];
    activeAsset.object.traverse(obj => {
      if (obj.isMesh) {
        meshes.push(obj);
        // Ensure material is MeshStandardMaterial for PBR maps
        if (!obj.material || obj.material.type !== 'MeshStandardMaterial') {
            obj.material = new window.Phonebook.THREE.MeshStandardMaterial({ name: 'Default Material' });
        }
      }
    });

    if (meshes.length > 0) {
      meshes.forEach(mesh => {
        const item = document.createElement('div');
        item.className = 'tf-mesh-item';
        item.textContent = mesh.name || `Unnamed Mesh (UUID: ...${mesh.uuid.slice(-4)})`;
        item.onclick = () => selectMesh(mesh);
        meshDropdownList.appendChild(item);
      });
      // Automatically select the first mesh
      selectMesh(meshes[0]);
      panel.querySelector('#tf-texture-editor').style.display = 'block';
      waiting.style.display = 'none';
    } else {
      waiting.textContent = 'No meshes found in this model.';
      panel.querySelector('#tf-texture-editor').style.display = 'none';
      waiting.style.display = 'block';
    }
  }

  function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file || !activeMesh || !currentMapTarget) return;

    const url = URL.createObjectURL(file);
    const { THREE } = window.Phonebook;
    const loader = new THREE.TextureLoader();

    loader.load(url, (texture) => {
      // Standard settings for GLB/GLTF textures
      texture.flipY = false;
      texture.colorSpace = (currentMapTarget === 'map' || currentMapTarget === 'emissiveMap')
        ? THREE.SRGBColorSpace
        : THREE.NoColorSpace;

      // Dispose of the old texture to free GPU memory
      activeMesh.material[currentMapTarget]?.dispose();
      
      // Assign the new texture
      activeMesh.material[currentMapTarget] = texture;
      activeMesh.material.needsUpdate = true;

      URL.revokeObjectURL(url);
      updateTextureUI(); // Refresh the UI state
      
    }, undefined, (err) => {
      console.error('Texture load error:', err);
      URL.revokeObjectURL(url);
    });

    fileInput.value = ''; // Reset for next selection
  }

  // --- Event Handlers & Wiring ---

  function onNav(e) {
    panel.classList.toggle('show', e.detail.tab === 'textures');
  }

  function onActive(e) {
    activeAsset = e.detail;
    activeMesh = null; // Reset selection
    meshSelectBtn.textContent = '-- Select a Mesh --';

    if (activeAsset) {
      populateMeshDropdown();
    } else {
      panel.querySelector('#tf-texture-editor').style.display = 'none';
      waiting.style.display = 'block';
    }
    updateTextureUI();
  }

  function wireEvents() {
    Navigation.on('change', onNav);
    App.on('asset:activated', onActive);

    // Toggle dropdown visibility
    meshSelectBtn.addEventListener('click', () => {
      meshDropdownList.classList.toggle('show');
    });
    
    // Clicking a texture button triggers the file input
    textureGrid.addEventListener('click', (e) => {
        const target = e.target;
        if (target.matches('.tf-texture-btn') && !target.disabled) {
            currentMapTarget = target.dataset.act; // Store which map we're setting
            fileInput.click();
        }
    });

    fileInput.addEventListener('change', handleFileSelect);

    // Close dropdown if clicking outside
    window.addEventListener('pointerdown', (e) => {
        if (!meshSelectContainer.contains(e.target)) {
            meshDropdownList.classList.remove('show');
        }
    });
  }

  // --- Bootstrap ---
  function bootstrap() {
    if (window.Textures) return;
    injectUI();
    wireEvents();
    window.Textures = {};
    window.Debug?.log('Textures panel (v2) ready.');
  }

  if (window.App?.glVersion) bootstrap();
  else window.App?.on('app:booted', bootstrap);
})();
