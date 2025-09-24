// Core utility functions for surveillance test page
console.log("🔍 DEBUG: utils.js loaded");

// Utility function to log to specific console area
function logToConsole(consoleId, message, type = 'info') {
    const consoleElement = document.getElementById(consoleId);
    if (!consoleElement) {
        console.warn(`Console element not found: ${consoleId}`);
        return;
    }

    const timestamp = new Date().toLocaleTimeString();
    const colorMap = {
        'info': '#00ff00',
        'warn': '#ffff00',
        'error': '#ff0000',
        'attack': '#ff6b35'
    };

    const logEntry = document.createElement('div');
    logEntry.style.color = colorMap[type] || '#00ff00';
    logEntry.innerHTML = `[${timestamp}] ${message}`;

    consoleElement.appendChild(logEntry);
    consoleElement.scrollTop = consoleElement.scrollHeight;
}

function clearConsole(consoleId) {
    const elem = document.getElementById(consoleId);
    if (elem) {
        elem.innerHTML = 'Console cleared...';
    } else {
        console.warn(`Console element not found: ${consoleId}`);
    }
}

// Make functions globally available
window.logToConsole = logToConsole;
window.clearConsole = clearConsole;