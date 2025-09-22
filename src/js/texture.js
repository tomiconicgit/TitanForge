// src/js/textures.js - Panel for applying PBR textures to meshes.

(function () {
    'use strict';

    let panel, waitingMessage, controlsContainer, activeAsset;
    let meshSelect, fileInput, mapButtonsContainer;
    let selectedMesh = null;
    let mapTypeToLoad = null;

    let MAP_CONFIG;

    // --- UI Injection ---
    function injectUI() {
        const style = document.createElement('style');
        style.textContent = `
            #tf-textures-panel {
                position: fixed;
                top: calc(50vh + 54px); left: 0; right: 0; bottom: 0;
                background: #0D1014;
                z-index: 5;
                padding: 16px;
                box-sizing: border-box;
                overflow-y: auto;
                display: none;
            }
            #tf-textures-panel.show { display: flex; flex-direction: column; }
            #tf-textures-waiting {
                color: #a0a7b0; font-size: 16px;
                text-align: center; margin: auto;
            }
            #tf-textures-controls {
                display: none; /* Hidden by default */
                flex-direction: column; gap: 20px;
            }
            /* **FIX**: Use a class on the parent panel to control visibility */
            #tf-textures-panel.has-model #tf-textures-waiting { display: none; }
            #tf-textures-panel.has-model #tf-textures-controls { display: flex; }

            #tf-mesh-select {
                width: 100%; padding: 10px; font-size: 15px;
                background: rgba(255,255,255,0.05); color: #fff;
                border: 1px solid rgba(255,255,255,0.1); border-radius: 6px;
            }
            .tf-maps-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 10px;
            }
            .tf-map-button {
                padding: 20px 10px; font-size: 14px; font-weight: 600;
                background: rgba(255,255,255,0.05); color: #a0a7b0;
                border: 1px solid rgba(255,255,255,0.1); border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .tf-map-button:hover {
                background: rgba(255,255,255,0.1);
                color: #fff;
            }
        `;
        document.head.appendChild(style);

        panel = document.createElement('div');
        panel.id = 'tf-textures-panel';
        panel.innerHTML = `
            <div id="tf-textures-waiting">Load a model to edit textures.</div>
            <div id="tf-textures-controls">
                <select id="tf-mesh-select"></select>
                <div class="tf-maps-grid"></div>
            </div>
        `;
        document.getElementById('app')?.appendChild(panel);

        // Hidden file input for texture uploads
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/png, image/jpeg';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);

        waitingMessage = panel.querySelector('#tf-textures-waiting');
        controlsContainer = panel.querySelector('#tf-textures-controls');
        meshSelect = panel.querySelector('#tf-mesh-select');
        mapButtonsContainer = panel.querySelector('.tf-maps-grid');
    }

    // --- Logic ---
    function resetPanel() {
        activeAsset = null;
        selectedMesh = null;
        meshSelect.innerHTML = '';
        panel.classList.remove('has-model'); // **FIX**: Control visibility via parent class
    }

    function updatePanelForAsset() {
        if (!activeAsset) {
            resetPanel();
            return;
        }
        const { THREE } = window.Phonebook;

        const meshes = [];
        activeAsset.object.traverse(obj => {
            if (obj.isMesh) {
                if (!obj.material) {
                    obj.material = new THREE.MeshStandardMaterial();
                } else if (!obj.material.isMeshStandardMaterial) {
                    const oldMat = obj.material;
                    obj.material = new THREE.MeshStandardMaterial({ color: oldMat.color, map: oldMat.map });
                    oldMat.dispose();
                }
                meshes.push(obj);
            }
        });

        meshSelect.innerHTML = '';
        if (meshes.length > 0) {
            meshes.forEach((mesh, i) => {
                const option = document.createElement('option');
                option.value = mesh.uuid;
                option.textContent = mesh.name || `Mesh ${i + 1}`;
                meshSelect.appendChild(option);
            });
            selectedMesh = meshes[0];
            panel.classList.add('has-model'); // **FIX**: Control visibility via parent class
        } else {
            resetPanel();
        }
    }

    function handleTextureFile(file) {
        if (!file || !selectedMesh || !mapTypeToLoad) return;
        
        const { THREE } = window.Phonebook;
        const reader = new FileReader();
        reader.onload = (e) => {
            const textureLoader = new THREE.TextureLoader();
            textureLoader.load(e.target.result, (texture) => {
                const config = MAP_CONFIG[mapTypeToLoad];
                
                texture.flipY = false;
                if (config.colorSpace) {
                    texture.colorSpace = config.colorSpace;
                }
                
                selectedMesh.material[config.prop] = texture;
                selectedMesh.material.needsUpdate = true;
                
                console.log(`Applied ${mapTypeToLoad} map to ${selectedMesh.name}`);
            });
        };
        reader.readAsDataURL(file);
    }
    
    // --- Event Handlers ---
    function handleNavChange(event) {
        panel.classList.toggle('show', event.detail.tab === 'textures');
    }

    function handleAssetActivated(event) {
        activeAsset = event.detail;
        updatePanelForAsset();
    }
    
    function wireEvents() {
        Navigation.on('change', handleNavChange);
        App.on('asset:activated', handleAssetActivated);

        meshSelect.addEventListener('change', () => {
            if (!activeAsset) return;
            const uuid = meshSelect.value;
            selectedMesh = activeAsset.object.getObjectByProperty('uuid', uuid);
        });
        
        mapButtonsContainer.addEventListener('click', (e) => {
            if (e.target.matches('.tf-map-button')) {
                mapTypeToLoad = e.target.dataset.mapName;
                fileInput.click();
            }
        });
        
        fileInput.addEventListener('change', () => {
            const file = fileInput.files[0];
            if (file) {
                handleTextureFile(file);
            }
            fileInput.value = '';
        });
    }

    // --- Bootstrap ---
    function bootstrap() {
        if (window.Textures) return;
        const { THREE } = window.Phonebook;
        
        MAP_CONFIG = {
            'Albedo': { prop: 'map', colorSpace: THREE.SRGBColorSpace },
            'Normal': { prop: 'normalMap' },
            'Metalness': { prop: 'metalnessMap' },
            'Roughness': { prop: 'roughnessMap' },
            'AO': { prop: 'aoMap' },
            'Emissive': { prop: 'emissiveMap', colorSpace: THREE.SRGBColorSpace },
        };
        
        injectUI();
        
        Object.keys(MAP_CONFIG).forEach(name => {
            const button = document.createElement('button');
            button.className = 'tf-map-button';
            button.textContent = name;
            button.dataset.mapName = name;
            mapButtonsContainer.appendChild(button);
        });

        wireEvents();
        window.Textures = {};
        window.Debug?.log('Textures Panel ready.');
    }

    if (window.App?.glVersion) bootstrap();
    else window.App?.on('app:booted', bootstrap);

})();
