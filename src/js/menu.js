// src/js/menu.js - Main expanding menu for the viewer

(function () {
    'use strict';

    let menuContainer, loadModal;

    function injectUI() {
        const style = document.createElement('style');
        style.textContent = `
            #tf-menu-container {
                position: fixed;
                top: 16px; 
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
                width: 200px;
                height: 155px;
                cursor: default;
                border-radius: 8px;
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
                transition: opacity 0.2s ease, transform 0.2s ease;
            }
            #tf-menu-container.open #tf-menu-button-text {
                opacity: 0;
                transform: scale(0.9);
                pointer-events: none;
            }
            .tf-menu-options {
                position: absolute;
                inset: 0;
                padding: 8px;
                display: flex;
                flex-direction: column;
                gap: 0;
                opacity: 0;
                transform: scale(0.95);
                transition: opacity 0.3s ease 0.1s, transform 0.3s ease 0.1s;
                pointer-events: none;
            }
            #tf-menu-container.open .tf-menu-options {
                opacity: 1;
                transform: scale(1);
                pointer-events: auto;
            }
            .tf-menu-options button, .tf-load-modal-content button {
                width: 100%;
                padding: 10px 12px;
                font-size: 15px;
                font-weight: 500;
                border: none;
                border-radius: 5px;
                background-color: transparent;
                color: #e6eef6;
                cursor: pointer;
                text-align: left;
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                transition: background-color 0.2s ease;
            }
             .tf-menu-options button:last-child {
                border-bottom: none;
            }
            .tf-menu-options button:hover, .tf-load-modal-content button:hover {
                background-color: rgba(255, 255, 255, 0.1);
            }
            .tf-load-modal-content {
                display: flex; flex-direction: column; gap: 15px;
                width: min(300px, 80vw);
                padding: 25px;
                background: rgba(28, 32, 38, 0.9); border-radius: 12px;
                border: 1px solid rgba(255,255,255,0.1);
            }
             .tf-load-modal-content button {
                text-align: center;
                font-weight: 600;
                background-color: rgba(255, 255, 255, 0.1);
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
                <button data-action="load-model">Load Model</button>
                <button data-action="load-asset">Load Asset</button>
            </div>
        `;
        document.body.appendChild(loadModal);
    }

    function toggleMenu(show) { menuContainer.classList.toggle('open', show); }
    function showLoadModal(show) { loadModal.classList.toggle('show', show); }

    function wireEvents() {
        // --- FULLY REVISED EVENT LOGIC ---

        menuContainer.addEventListener('pointerdown', (event) => {
            // Stop this event from reaching the window listener and causing an immediate close.
            event.stopPropagation();
            
            const optionButton = event.target.closest('.tf-menu-options button');

            if (optionButton) {
                // An option button was pressed. Use a 'click' listener on the parent 
                // to ensure the action only fires on a complete tap/click.
                return;
            } else {
                // The menu background or initial button text was pressed. Toggle the menu.
                toggleMenu(!menuContainer.classList.contains('open'));
            }
        });
        
        // A single 'click' listener on the options container handles all button actions.
        const options = menuContainer.querySelector('.tf-menu-options');
        options.addEventListener('click', (event) => {
            const action = event.target.dataset.action;
            if (!action) return;

            toggleMenu(false); // Always close the menu after an action.
            
            if (action === 'load') {
                setTimeout(() => showLoadModal(true), 400); // Wait for menu animation.
            } else if (action === 'toggles') {
                window.Toggles?.show();
            } else if (action === 'save') {
                console.log('Save action triggered.');
            }
        });

        // Load Modal logic remains the same.
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

        // The global listener now reliably closes the menu.
        window.addEventListener('pointerdown', () => {
            if (menuContainer.classList.contains('open')) {
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
