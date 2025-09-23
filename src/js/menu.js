// src/js/menu.js - Main expanding menu for the viewer
(function () {
    'use strict';

    let menuContainer, loadModal;

    function injectUI() {
        const style = document.createElement('style');
        style.textContent = `
            /* Main wrapper for positioning */
            #tf-menu-container {
                position: fixed;
                top: 16px;
                left: 16px;
                z-index: 30;
            }

            /* The visible menu button */
            #tf-menu-button {
                width: 80px;
                height: 30px;
                border-radius: 20px;
                background: linear-gradient(90deg, #6a11cb 0%, #2575fc 100%);
                color: #fff;
                cursor: pointer;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
                font-weight: 600;
                border: none;
                transition: opacity 0.3s ease, transform 0.3s ease;
            }

            /* The menu card, which is hidden by default */
            #tf-menu-card {
                width: 200px;
                border-radius: 8px;
                background: rgba(28, 32, 38, 0.9);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                padding: 8px;
                display: flex;
                flex-direction: column;
                gap: 0;
                /* Default hidden state */
                opacity: 0;
                transform: scale(0.95);
                pointer-events: none;
                transition: opacity 0.3s ease, transform 0.3s ease;
                position: absolute; /* Keep it in the same spot as the button */
                top: 0;
                left: 0;
            }

            /* State changes when the wrapper has the '.open' class */
            #tf-menu-container.open #tf-menu-button {
                opacity: 0;
                transform: scale(0.9);
                pointer-events: none;
            }

            #tf-menu-container.open #tf-menu-card {
                opacity: 1;
                transform: scale(1);
                pointer-events: auto;
            }
            
            /* Styles for buttons inside the card */
            #tf-menu-card button, .tf-load-modal-content button {
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
            #tf-menu-card button:last-child {
                border-bottom: none;
            }
            #tf-menu-card button:hover, .tf-load-modal-content button:hover {
                background-color: rgba(255, 255, 255, 0.1);
            }
            
            /* Disabled button style */
            #tf-menu-card button:disabled, .tf-load-modal-content button:disabled {
                color: #777;
                cursor: not-allowed;
                background-color: transparent;
            }

            /* Modal styles */
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
            <button id="tf-menu-button">Menu</button>
            <div id="tf-menu-card">
                <button data-action="load">Load</button>
                <button data-action="toggles">Toggles</button>
                <button data-action="animation">Animation</button>
                <button data-action="copy">Copy Data</button> 
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

    function toggleMenu(show) {
        menuContainer.classList.toggle('open', show);
    }

    function showLoadModal(show) { loadModal.classList.toggle('show', show); }

    function wireEvents() {
        const menuButton = menuContainer.querySelector('#tf-menu-button');
        const menuCard = menuContainer.querySelector('#tf-menu-card');
        
        menuButton.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleMenu(true);
        });
        
        menuCard.addEventListener('pointerdown', (event) => {
            event.stopPropagation();
        });

        menuCard.addEventListener('click', (event) => {
            const action = event.target.dataset.action;
            if (!action) return;

            toggleMenu(false);
            
            setTimeout(() => {
                if (action === 'load') {
                    showLoadModal(true);
                } else if (action === 'toggles') {
                    window.Toggles?.show();
                } else if (action === 'animation') {
                    // Updated namespace to avoid clashing with Web Animations API
                    window.TFAnimation?.show();
                } else if (action === 'copy') {
                    window.Copy?.show();
                }
            }, 300);
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