// In src/js/menu.js

// ... inside injectUI() ...
        menuContainer.id = 'tf-menu-container';
        menuContainer.innerHTML = `
            <button id="tf-menu-button">Menu</button>
            <div id="tf-menu-card">
                <button data-action="load">Load</button>
                <button data-action="toggles">Toggles</button>
                <button data-action="animation">Animation</button>
                <button data-action="copy">Copy Data</button>
                <button data-action="export">Export</button> </div>
        `;
        document.getElementById('app')?.appendChild(menuContainer);

// ... inside wireEvents() ...
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
                    window.TFAnimation?.show();
                } else if (action === 'copy') {
                    window.Copy?.show();
                } else if (action === 'export') { // 👈 ADD THIS CASE
                    window.Export?.show();
                }
            }, 300);
        });

// ... rest of the file
