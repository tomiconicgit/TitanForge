// src/js/tabs.js - Manages the asset list panel

(function () {
    'use strict';

    let panel, listContainer;
    const assets = new Map(); // Use a Map to store asset data
    let activeAssetId = null;

    // --- UI Injection ---
    function injectUI() {
        const style = document.createElement('style');
        style.textContent = `
            #tf-tabs-panel {
                position: fixed;
                top: calc(50vh + 54px); /* Below viewer and nav bar */
                left: 0; right: 0; bottom: 0;
                background: #0D1014;
                z-index: 5;
                padding: 16px;
                box-sizing: border-box;
                overflow-y: auto;
                display: none; /* Hidden by default */
            }
            #tf-tabs-panel.show { display: block; }
            .tf-tab-card {
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 12px;
                border: 1px solid rgba(255,255,255,0.1);
                transition: background-color 0.2s ease, border-color 0.2s ease;
            }
            .tf-tab-card:not(.active) {
                 cursor: pointer;
            }
            .tf-tab-card:not(.active):hover { background-color: rgba(255,255,255,0.1); }
            /* --- NEW: Active card style --- */
            .tf-tab-card.active {
                border-color: #00c853;
                box-shadow: 0 0 10px rgba(0, 200, 83, 0.4);
            }
            .tf-tab-card .card-header {
                font-weight: 600; margin-bottom: 8px; word-break: break-all;
             }
            .tf-tab-card .card-grid {
                display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                gap: 8px; font-size: 13px; color: #a0a7b0;
                margin-bottom: 12px; /* Space above the buttons */
            }
            .tf-tab-card .card-grid strong { color: #e6eef6; }

            /* --- NEW: Button container --- */
            .card-actions {
                display: flex;
                gap: 10px;
            }

            /* --- NEW & UPDATED Button Styles --- */
            .card-actions button {
                flex: 1; /* Make buttons share space */
                padding: 8px 12px;
                font-size: 14px;
                font-weight: 600;
                border-radius: 15px;
                border: none;
                color: #fff;
                cursor: pointer;
                text-align: center;
                transition: all 0.2s ease;
            }
            .card-actions button:hover {
                opacity: 0.85;
            }
            .card-active-btn {
                background: linear-gradient(90deg, #00b048, #00c853); /* Green gradient */
            }
            .card-close-btn {
                background: linear-gradient(90deg, #c62828, #ff3b30); /* Red gradient */
            }
        `;
        document.head.appendChild(style);

        panel = document.createElement('div');
        panel.id = 'tf-tabs-panel';
        panel.innerHTML = `<div id="tf-tab-list"></div>`;
        document.getElementById('app')?.appendChild(panel);
        listContainer = panel.querySelector('#tf-tab-list');
    }

    // --- Logic ---
    function render() {
        listContainer.innerHTML = ''; // Clear current list
        for (const [id, asset] of assets.entries()) {
            const card = document.createElement('div');
            card.className = 'tf-tab-card';
            card.dataset.assetId = id;
            if (id === activeAssetId) {
                card.classList.add('active');
            }

            card.innerHTML = `
                <div class="card-header">${asset.name}</div>
                <div class="card-grid">
                    <div>Type: <strong>${asset.fileType}</strong></div>
                    <div>Size: <strong>${asset.fileSize}</strong></div>
                    <div>Verts: <strong>${asset.vertices.toLocaleString()}</strong></div>
                    <div>Polys: <strong>${asset.polygons.toLocaleString()}</strong></div>
                </div>
                <div class="card-actions">
                    <button class="card-active-btn" data-action="make-active">Make Active</button>
                    <button class="card-close-btn" data-action="close">Close</button>
                </div>
            `;
            listContainer.appendChild(card);
        }
    }
    
    function setActiveAsset(assetId) {
        if (activeAssetId === assetId) return;
        activeAssetId = assetId;
        console.log(`Active asset is now: ${assetId}`);
        // Here you would emit an event for other tools to listen to
        App.emit('asset:activated', assets.get(assetId));
        render(); // Re-render to apply the '.active' class
    }

    // --- Event Handlers ---
    function handleAssetLoaded(event) {
        const assetData = event.detail;
        if (assetData && assetData.id) {
            assets.set(assetData.id, assetData);
            // If it's the first model loaded, make it active automatically
            if (assets.size === 1) {
                setActiveAsset(assetData.id);
            } else {
                render();
            }
        }
    }

    function handleAssetCleaned(event) {
        const { id } = event.detail;
        if (id && assets.has(id)) {
            assets.delete(id);
            // If the active asset was deleted, clear the active state
            if (activeAssetId === id) {
                activeAssetId = null;
                 // Optionally, make another asset active
                if (assets.size > 0) {
                   setActiveAsset(assets.keys().next().value);
                }
            }
            render();
        }
    }

    function handleNavChange(event) {
        panel.classList.toggle('show', event.detail.tab === 'tabs');
    }

    function handleListClick(event) {
        const target = event.target;
        const card = target.closest('.tf-tab-card');
        if (!card) return;

        const assetId = card.dataset.assetId;
        const action = target.dataset.action;

        if (action === 'close') {
            event.stopPropagation();
            const assetToClean = assets.get(assetId);
            if (assetToClean) {
                window.Cleaner.clean(assetToClean);
            }
        } else if (action === 'make-active') {
            event.stopPropagation();
            setActiveAsset(assetId);
        } else {
            // If the card itself (but not a button) is clicked, make it active
            setActiveAsset(assetId);
        }
    }

    function bootstrap() {
        if (window.Tabs) return;

        injectUI();

        // Listen for global and local events
        App.on('asset:loaded', handleAssetLoaded);
        App.on('asset:cleaned', handleAssetCleaned);
        Navigation.on('change', handleNavChange);
        listContainer.addEventListener('click', handleListClick);

        window.Tabs = {};
        window.Debug?.log('Tabs panel ready.');
    }

    if (window.App?.glVersion) {
        bootstrap();
    } else {
        window.App?.on('app:booted', bootstrap);
    }
})();
