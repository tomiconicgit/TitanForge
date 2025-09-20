// loading.js
document.addEventListener('DOMContentLoaded', () => {
    const loadingScreen = document.getElementById('loading-screen');
    const loadingProgress = document.getElementById('loading-progress');
    const loadingText = document.getElementById('loading-text');
    const processLog = document.getElementById('process-log');

    const logProcess = (message) => {
        const line = document.createElement('div');
        line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        processLog.appendChild(line);
        processLog.scrollTop = processLog.scrollHeight;
    };

    logProcess('Starting asset loading...');

    import('./main.js')
        .then(() => {
            logProcess("Main application initialized.");
            loadingText.textContent = "TitanForge is ready!";
            setTimeout(() => {
                loadingScreen.style.opacity = '0';
                loadingScreen.style.pointerEvents = 'none';
            }, 500);
        })
        .catch(err => {
            logProcess(`Fatal error: ${err.message}`, 'error');
            loadingText.textContent = "An error occurred during startup.";
            console.error(err);
        });
});
