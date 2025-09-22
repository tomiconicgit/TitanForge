// src/js/textures.js - Panel for applying PBR textures to meshes.

(function () {
    'use strict';

    let panel, waitingMessage, controlsContainer, activeAsset;
    let meshSelect, fileInput, mapButtonsContainer;
    let selectedMesh = null;
    let mapTypeToLoad = null;

    // A mapping from our UI names to three.js material properties
    const MAP_CONFIG = {
        'Albedo': { prop: 'map', colorSpace: THREE.SRGBColorSpace },
        'Normal': { prop: 'normalMap' },
        'Metalness': { prop: 'metalnessMap' },
        'Roughness': { prop: 'roughnessMap' },
        'AO': { prop: 'aoMap' },
        'Emissive': { prop: 'emissiveMap', colorSpace: THREE.SRGBColorSpace },
    };

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
                display: flex; flex-direction: column; gap: 20px;
            }
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
            <div id="tf-textures-controls" style="display: none;">
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
        
        // Create the grid of buttons from our config
        Object.keys(MAP_CONFIG).forEach(name => {
            const button = document.createElement('button');
            button.className = 'tf-map-button';
            button.textContent = name;
            button.dataset.mapName = name;
            mapButtonsContainer.appendChild(button);
        });
    }

    // --- Logic ---
    function resetPanel() {
        activeAsset = null;
        selectedMesh = null;
        controlsContainer.style.display = 'none';
        waitingMessage.style.display = 'block';
        meshSelect.innerHTML = '';
    }

    function updatePanelForAsset() {
        if (!activeAsset) {
            resetPanel();
            return;
        }

        const meshes = [];
        activeAsset.object.traverse(obj => {
            if (obj.isMesh) {
                // Ensure the mesh has a material to work with
                if (!obj.material) {
                    obj.material = new THREE.MeshStandardMaterial();
                } else if (!obj.material.isMeshStandardMaterial) {
                    // Attempt to convert simple materials
                    const oldMat = obj.material;
                    obj.material = new THREE.MeshStandardMaterial({ color: oldMat.color, map: oldMat.map });
                    oldMat.dispose();
                }
                meshes.push(obj);
            }
        });

        meshSelect.innerHTML = ''; // Clear previous options
        if (meshes.length > 0) {
            meshes.forEach((mesh, i) => {
                const option = document.createElement('option');
                option.value = mesh.uuid;
                option.textContent = mesh.name || `Mesh ${i + 1}`;
                meshSelect.appendChild(option);
            });
            // Auto-select the first mesh
            selectedMesh = meshes[0];
            controlsContainer.style.display = 'flex';
            waitingMessage.style.display = 'none';
        } else {
            resetPanel();
        }
    }

    function handleTextureFile(file) {
        if (!file || !selectedMesh || !mapTypeToLoad) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const textureLoader = new THREE.TextureLoader();
            textureLoader.load(e.target.result, (texture) => {
                const config = MAP_CONFIG[mapTypeToLoad];
                
                // Configure texture properties for GLB/PBR workflow
                texture.flipY = false;
                if (config.colorSpace) {
                    texture.colorSpace = config.colorSpace;
                }
                
                // Apply the texture to the material property
                selectedMesh.material[config.prop] = texture;
                selectedMesh.material.needsUpdate = true; // Crucial!
                
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
            fileInput.value = ''; // Reset for next selection
        });
    }

    // --- Bootstrap ---
    function bootstrap() {
        if (window.Textures) return;
        const { THREE } = window.Phonebook;
        injectUI();
        wireEvents();
        window.Textures = {};
        window.Debug?.log('Textures Panel ready.');
    }

    if (window.App?.glVersion) bootstrap();
    else window.App?.on('app:booted', bootstrap);

})();
