// src/js/tabs.js - Manages the asset list panel

(function () {
    'use strict';

    let panel, listContainer;
    const assets = new Map(); // Use a Map to store asset data

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
                position: relative; /* For positioning the close button */
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 12px;
                border: 1px solid rgba(255,255,255,0.1);
                cursor: pointer;
                transition: background-color 0.2s ease;
            }
            .tf-tab-card:hover { background-color: rgba(255,255,255,0.1); }
            .tf-tab-card .card-header {
                font-weight: 600; margin-bottom: 8px; word-break: break-all;
                padding-right: 25px; /* Space for the close button */
             }
            .tf-tab-card .card-grid {
                display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                gap: 8px; font-size: 13px; color: #a0a7b0;
            }
            .tf-tab-card .card-grid strong { color: #e6eef6; }
            .card-close-btn {
                position: absolute;
                top: 8px; right: 8px;
                width: 20px; height: 20px;
                background: rgba(0,0,0,0.3);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 50%;
                color: #fff;
                font-size: 14px;
                line-height: 18px;
                text-align: center;
                cursor: pointer;
                transition: background-color 0.2s ease;
            }
            .card-close-btn:hover { background-color: #ff3b30; }
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
            card.innerHTML = `
                <button class="card-close-btn">&times;</button>
                <div class="card-header">${asset.name}</div>
                <div class="card-grid">
                    <div>Type: <strong>${asset.fileType}</strong></div>
                    <div>Size: <strong>${asset.fileSize}</strong></div>
                    <div>Verts: <strong>${asset.vertices.toLocaleString()}</strong></div>
                    <div>Polys: <strong>${asset.polygons.toLocaleString()}</strong></div>
                </div>
            `;
            listContainer.appendChild(card);
        }
    }

    // --- Event Handlers ---
    function handleAssetLoaded(event) {
        const assetData = event.detail;
        if (assetData && assetData.id) {
            assets.set(assetData.id, assetData);
            render();
        }
    }

    function handleAssetCleaned(event) {
        const { id } = event.detail;
        if (id && assets.has(id)) {
            assets.delete(id);
            render();
        }
    }

    function handleNavChange(event) {
        panel.classList.toggle('show', event.detail.tab === 'tabs');
    }

    function handleListClick(event) {
        const target = event.target;
        if (target.matches('.card-close-btn')) {
            event.stopPropagation(); // Prevent card selection
            const card = target.closest('.tf-tab-card');
            const assetId = card.dataset.assetId;
            const assetToClean = assets.get(assetId);
            if (assetToClean) {
                window.Cleaner.clean(assetToClean);
            }
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

        window.Tabs = {}; // Expose if needed later
        window.Debug?.log('Tabs panel ready.');
    }

    if (window.App?.glVersion) {
        bootstrap();
    } else {
        window.App?.on('app:booted', bootstrap);
    }
})();
