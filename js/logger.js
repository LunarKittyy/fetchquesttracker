/**
 * Logger - Centralized logging and debugging for FetchQuest
 * 
 * Usage:
 *   import { Logger } from './logger.js';
 *   const log = Logger.module('Storage');
 *   log.info('Saving state...');
 *   log.error('Failed to save', { error: e.message });
 * 
 * Debug panel: Add ?debug to URL or press Ctrl+Shift+D
 */

// ============================================================================
// LOG LEVELS & CONFIG
// ============================================================================

const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, NONE: 4 };
let currentLevel = LOG_LEVELS.INFO;
const MAX_HISTORY = 100;
const logHistory = [];
const errorCount = { total: 0, recent: [] };

// Module colors for visual distinction
const MODULE_COLORS = {
    SYNC: '#4ecdb4',
    STORAGE: '#6366f1',
    SHARING: '#ec4899',
    FIREBASE: '#f97316',
    AUTH: '#a855f7',
    SPACES: '#5cb572',
    QUESTS: '#e8b84a',
    UI: '#888',
    DEFAULT: '#888'
};

// ============================================================================
// CORE LOGGING
// ============================================================================

function formatTime() {
    return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function addToHistory(entry) {
    logHistory.push(entry);
    if (logHistory.length > MAX_HISTORY) logHistory.shift();

    if (entry.level === 'ERROR') {
        errorCount.total++;
        errorCount.recent.push({ time: entry.time, msg: entry.msg, module: entry.module });
        if (errorCount.recent.length > 10) errorCount.recent.shift();
    }

    updateDebugPanelIfOpen();
}

function log(level, module, msg, data = null) {
    if (LOG_LEVELS[level] < currentLevel) return;

    const time = formatTime();
    const color = MODULE_COLORS[module.toUpperCase()] || MODULE_COLORS.DEFAULT;
    const entry = { time, level, module, msg, data };

    addToHistory(entry);

    // Console output with styling
    const prefix = `%c[${module}]`;
    const style = `color: ${color}; font-weight: bold;`;

    const icons = { DEBUG: '🔍', INFO: '▸', WARN: '⚠️', ERROR: '❌' };
    const icon = icons[level] || '';

    if (data !== null && data !== undefined) {
        console[level.toLowerCase() === 'debug' ? 'log' : level.toLowerCase()](`${icon} ${prefix} ${msg}`, style, data);
    } else {
        console[level.toLowerCase() === 'debug' ? 'log' : level.toLowerCase()](`${icon} ${prefix} ${msg}`, style);
    }
}

// ============================================================================
// PUBLIC API
// ============================================================================

export const Logger = {
    setLevel(level) {
        currentLevel = LOG_LEVELS[level.toUpperCase()] ?? LOG_LEVELS.INFO;
    },

    module(name) {
        return {
            debug: (msg, data) => log('DEBUG', name, msg, data),
            info: (msg, data) => log('INFO', name, msg, data),
            warn: (msg, data) => log('WARN', name, msg, data),
            error: (msg, data) => log('ERROR', name, msg, data)
        };
    },

    // Direct access (use module() for tagged logging)
    debug: (msg, data) => log('DEBUG', 'App', msg, data),
    info: (msg, data) => log('INFO', 'App', msg, data),
    warn: (msg, data) => log('WARN', 'App', msg, data),
    error: (msg, data) => log('ERROR', 'App', msg, data),

    getHistory: () => [...logHistory],
    getErrors: () => ({ ...errorCount }),
    clearErrors: () => { errorCount.total = 0; errorCount.recent = []; }
};

// ============================================================================
// DEBUG PANEL
// ============================================================================

let debugPanel = null;
let filterModule = 'ALL';
let filterLevel = 'ALL';

function createDebugPanel() {
    if (debugPanel) return debugPanel;

    const panel = document.createElement('div');
    panel.id = 'debug-panel';
    panel.innerHTML = `
        <style>
            #debug-panel {
                position: fixed;
                bottom: 16px;
                right: 16px;
                width: 380px;
                max-height: 400px;
                background: rgba(10, 12, 16, 0.95);
                color: #ccc;
                font-family: 'Share Tech Mono', 'Consolas', monospace;
                font-size: 11px;
                border-radius: 8px;
                border: 1px solid rgba(78, 205, 180, 0.3);
                z-index: 99999;
                overflow: hidden;
                box-shadow: 0 8px 32px rgba(0,0,0,0.6);
                backdrop-filter: blur(8px);
            }
            #debug-panel .dp-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 12px;
                background: rgba(78, 205, 180, 0.1);
                border-bottom: 1px solid rgba(78, 205, 180, 0.2);
            }
            #debug-panel .dp-title {
                display: flex;
                align-items: center;
                gap: 8px;
                font-weight: bold;
                color: #4ecdb4;
                font-size: 12px;
            }
            #debug-panel .dp-error-badge {
                background: #d45454;
                color: white;
                padding: 2px 6px;
                border-radius: 10px;
                font-size: 10px;
                display: none;
            }
            #debug-panel .dp-error-badge.visible { display: inline; }
            #debug-panel .dp-close {
                background: none;
                border: none;
                color: #666;
                cursor: pointer;
                font-size: 18px;
                line-height: 1;
            }
            #debug-panel .dp-close:hover { color: #fff; }
            #debug-panel .dp-filters {
                display: flex;
                gap: 8px;
                padding: 8px 12px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
            }
            #debug-panel .dp-filter {
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 4px;
                color: #888;
                padding: 4px 8px;
                font-size: 10px;
                cursor: pointer;
            }
            #debug-panel .dp-filter:hover { background: rgba(255,255,255,0.1); }
            #debug-panel .dp-filter.active { 
                background: rgba(78, 205, 180, 0.2); 
                border-color: #4ecdb4;
                color: #4ecdb4;
            }
            #debug-panel .dp-logs {
                max-height: 280px;
                overflow-y: auto;
                padding: 8px 0;
            }
            #debug-panel .dp-log {
                padding: 4px 12px;
                border-left: 3px solid transparent;
                display: flex;
                gap: 8px;
                align-items: flex-start;
            }
            #debug-panel .dp-log:hover { background: rgba(255,255,255,0.03); }
            #debug-panel .dp-log.WARN { border-left-color: #e8b84a; }
            #debug-panel .dp-log.ERROR { border-left-color: #d45454; background: rgba(212,84,84,0.05); }
            #debug-panel .dp-log .time { color: #555; flex-shrink: 0; }
            #debug-panel .dp-log .module { font-weight: bold; flex-shrink: 0; }
            #debug-panel .dp-log .msg { color: #aaa; word-break: break-word; }
            #debug-panel .dp-log.ERROR .msg { color: #f88; }
            #debug-panel .dp-empty {
                text-align: center;
                color: #555;
                padding: 24px;
            }
            #debug-panel .dp-footer {
                padding: 8px 12px;
                border-top: 1px solid rgba(255,255,255,0.1);
                display: flex;
                justify-content: space-between;
                font-size: 10px;
                color: #555;
            }
        </style>
        <div class="dp-header">
            <div class="dp-title">
                🔧 DEBUG
                <span class="dp-error-badge" id="dp-error-count">0</span>
            </div>
            <button class="dp-close" id="dp-close">×</button>
        </div>
        <div class="dp-filters">
            <button class="dp-filter active" data-filter="ALL">All</button>
            <button class="dp-filter" data-filter="ERROR">Errors</button>
            <button class="dp-filter" data-filter="WARN">Warnings</button>
        </div>
        <div class="dp-logs" id="dp-logs"></div>
        <div class="dp-footer">
            <span>Ctrl+Shift+D to toggle</span>
            <span id="dp-log-count">0 logs</span>
        </div>
    `;

    document.body.appendChild(panel);
    debugPanel = panel;

    // Event handlers
    panel.querySelector('#dp-close').onclick = () => hideDebugPanel();
    panel.querySelectorAll('.dp-filter').forEach(btn => {
        btn.onclick = () => {
            panel.querySelectorAll('.dp-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterLevel = btn.dataset.filter;
            updateDebugPanelIfOpen();
        };
    });

    updateDebugPanelIfOpen();
    return panel;
}

function updateDebugPanelIfOpen() {
    if (!debugPanel) return;

    const logsEl = debugPanel.querySelector('#dp-logs');
    const countEl = debugPanel.querySelector('#dp-log-count');
    const errorBadge = debugPanel.querySelector('#dp-error-count');

    // Filter logs
    let filtered = logHistory;
    if (filterLevel !== 'ALL') {
        filtered = logHistory.filter(e => e.level === filterLevel);
    }
    if (filterModule !== 'ALL') {
        filtered = filtered.filter(e => e.module === filterModule);
    }

    // Update error badge
    if (errorCount.total > 0) {
        errorBadge.textContent = errorCount.total;
        errorBadge.classList.add('visible');
    } else {
        errorBadge.classList.remove('visible');
    }

    // Render logs
    if (filtered.length === 0) {
        logsEl.innerHTML = '<div class="dp-empty">No logs yet</div>';
    } else {
        logsEl.innerHTML = filtered.slice(-50).map(entry => {
            const color = MODULE_COLORS[entry.module.toUpperCase()] || MODULE_COLORS.DEFAULT;
            return `
                <div class="dp-log ${entry.level}">
                    <span class="time">${entry.time}</span>
                    <span class="module" style="color:${color}">[${entry.module}]</span>
                    <span class="msg">${escapeHtml(entry.msg)}${entry.data ? ' ' + JSON.stringify(entry.data).slice(0, 50) : ''}</span>
                </div>
            `;
        }).join('');
        logsEl.scrollTop = logsEl.scrollHeight;
    }

    countEl.textContent = `${logHistory.length} logs`;
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function showDebugPanel() {
    createDebugPanel();
    debugPanel.style.display = 'block';
}

function hideDebugPanel() {
    if (debugPanel) debugPanel.style.display = 'none';
}

function toggleDebugPanel() {
    if (debugPanel && debugPanel.style.display !== 'none') {
        hideDebugPanel();
    } else {
        showDebugPanel();
    }
}

// ============================================================================
// ERROR BOUNDARY
// ============================================================================

function setupErrorBoundary() {
    window.addEventListener('error', (e) => {
        Logger.error(`Uncaught: ${e.message}`, { file: e.filename, line: e.lineno });
    });

    window.addEventListener('unhandledrejection', (e) => {
        const reason = e.reason?.message || e.reason || 'Unknown';
        Logger.error(`Unhandled Promise: ${reason}`);
    });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
    setupErrorBoundary();

    // Check URL for debug mode
    if (new URLSearchParams(window.location.search).has('debug')) {
        showDebugPanel();
        Logger.setLevel('DEBUG');
        Logger.info('Debug mode enabled via URL');
    }

    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            e.preventDefault();
            toggleDebugPanel();
        }
    });
}

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Expose for console debugging
window.Logger = Logger;
window.showDebugPanel = showDebugPanel;
window.hideDebugPanel = hideDebugPanel;
