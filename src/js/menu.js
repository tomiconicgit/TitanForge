// src/js/menu.js - Main expanding menu for the viewer

(function () {
    'use strict';

    let menuContainer, loadModal;

    function injectUI() {
        const style = document.createElement('style');
        style.textContent = `
            #tf-menu-container {
                position: fixed;
                bottom: 727px;
                left: 16px;
                z-index: 30;
                border-radius: 20px;
                background: linear-gradient(90deg, #6a11cb 0%, #2575fc 100%);
                color: #fff;
                cursor: pointer;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
                transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);
                overflow: hidden;
            }
            #tf-menu-container:not(.open) {
                width: 80px;
                height: 30px;
            }
            #tf-menu-container.open {
                width: 220px;
                height: 180px;
                cursor: default;
                border-radius: 12px;
                background: rgba(28, 32, 38, 0.9);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            #tf-menu-button-text {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                height: 100%;
                font-size: 14px;
                font-weight: 600;
                transition: opacity 0.2s ease;
            }
            #tf-menu-container.open #tf-menu-button-text {
                opacity: 0;
                pointer-events: none;
            }
            .tf-menu-options {
                position: absolute;
                inset: 0;
                padding: 16px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                opacity: 0;
                transition: opacity 0.3s ease 0.2s;
            }
            #tf-menu-container.open .tf-menu-options {
                opacity: 1;
            }
            .tf-menu-options button {
                width: 100%;
                padding: 12px;
                font-size: 15px;
                font-weight: 600;
                border: none;
                border-radius: 8px;
                background-color: rgba(255, 255, 255, 0.1);
                color: #fff;
                cursor: pointer;
                transition: background-color 0.2s ease;
            }
            .tf-menu-options button:hover {
                background-color: rgba(255, 255, 255, 0.2);
            }
            .tf-load-modal-content {
                display: flex; flex-direction: column; gap: 15px;
                width: min(300px, 80vw);
                padding: 25px;
                background: rgba(28, 32, 38, 0.9); border-radius: 12px;
                border: 1px solid rgba(255,255,255,0.1);
            }
        `;
        document.head.appendChild(style);

        menuContainer = document.createElement('div');
        menuContainer.id = 'tf-menu-container';
        menuContainer.innerHTML = `
            <div id="tf-menu-button-text">Menu</div>
            <div class="tf-menu-options">
                <button data-action="load">Load</button>
                <button data-action="toggles">Toggles</button>
                <button data-action="save">Save</button>
            </div>
        `;
        document.getElementById('app')?.appendChild(menuContainer);
        
        loadModal = document.createElement('div');
        loadModal.className = 'tf-modal-overlay';
        loadModal.innerHTML = `
            <div class="tf-load-modal-content">
                <button class="tf-menu-options-button" data-action="load-model">Load Model</button>
                <button class="tf-menu-options-button" data-action="load-asset">Load Asset</button>
            </div>
        `;
        document.body.appendChild(loadModal);
    }

    function toggleMenu(show) { menuContainer.classList.toggle('open', show); }
    function showLoadModal(show) { loadModal.classList.toggle('show', show); }

    function wireEvents() {
        menuContainer.addEventListener('click', (event) => {
            if (event.target === menuContainer || event.target.id === 'tf-menu-button-text') {
                toggleMenu(!menuContainer.classList.contains('open'));
            }
        });

        const options = menuContainer.querySelector('.tf-menu-options');
        options.addEventListener('click', (event) => {
            const action = event.target.dataset.action;
            if (!action) return;

            toggleMenu(false); // Close menu on any action
            
            if (action === 'load') {
                setTimeout(() => showLoadModal(true), 300); // Delay for animation
            } else if (action === 'toggles') {
                window.Toggles?.show();
            } else if (action === 'save') {
                console.log('Save action triggered.');
            }
        });

        loadModal.addEventListener('click', (event) => {
            const action = event.target.dataset.action;
            if (action === 'load-model') {
                showLoadModal(false);
                window.ModelManager?.load();
            } else if (action === 'load-asset') {
                showLoadModal(false);
                window.AssetManager?.load();
            } else if (event.target === loadModal) {
                showLoadModal(false);
            }
        });

        window.addEventListener('click', (event) => {
            if (menuContainer.classList.contains('open') && !menuContainer.contains(event.target)) {
                toggleMenu(false);
            }
        });
    }

    function bootstrap() {
        if (window.Menu) return;
        injectUI();
        wireEvents();
        window.Menu = {};
        window.App?.emit('menu:ready');
        window.Debug?.log('Menu UI ready.');
    }

    if (window.App?.glVersion) bootstrap();
    else window.App?.on('app:booted', bootstrap);
})();
