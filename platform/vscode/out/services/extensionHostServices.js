"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtensionHostServices = void 0;
const vscode = __importStar(require("vscode"));
const SERVICE_LABELS = {
    editor: 'Editor',
    math: 'Math',
    lsp: 'LSP',
    ai: 'AI',
    symbols: 'Symbols',
    diagnostics: 'Diagnostics',
    semanticTokens: 'Semantic Tokens',
    tests: 'Tests',
    cli: 'CLI',
};
class ExtensionHostServices {
    constructor() {
        this.statuses = new Map();
        this.outputChannel = vscode.window.createOutputChannel('Simple Rich Editor', { log: true });
        this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBar.command = 'simple.richEditor.showOutputChannel';
        this.statusBar.show();
        this.setStatus('editor', { health: 'starting', source: 'native', message: 'Booting rich editor host' });
        this.setStatus('math', { health: 'idle', source: 'fallback', message: 'Not registered yet' });
        this.setStatus('lsp', { health: 'idle', source: 'fallback', message: 'Compatibility surface not registered yet' });
        this.setStatus('ai', { health: 'idle', source: 'native', message: 'Not registered yet' });
        this.setStatus('symbols', { health: 'idle', source: 'fallback', message: 'Not registered yet' });
        this.setStatus('diagnostics', { health: 'idle', source: 'fallback', message: 'Not registered yet' });
        this.setStatus('semanticTokens', { health: 'idle', source: 'fallback', message: 'Not registered yet' });
        this.setStatus('tests', { health: 'idle', source: 'native', message: 'Not registered yet' });
        this.setStatus('cli', { health: 'idle', source: 'native', message: 'Not checked yet' });
    }
    setStatus(name, next) {
        this.statuses.set(name, next);
        const prefix = `${SERVICE_LABELS[name]} ${next.health.toUpperCase()}`;
        const detail = [next.message, next.lastError].filter(Boolean).join(' | ');
        this.outputChannel.info(detail ? `${prefix}: ${detail}` : prefix);
        this.renderStatusBar();
    }
    markReady(name, message, source = 'native') {
        this.setStatus(name, { health: 'ready', source, message });
    }
    markDegraded(name, message, source = 'fallback', lastError) {
        this.setStatus(name, { health: 'degraded', source, message, lastError });
    }
    markFailed(name, message, lastError) {
        this.setStatus(name, { health: 'failed', source: 'none', message, lastError });
    }
    showOutputChannel() {
        this.outputChannel.show();
    }
    async safeRegister(name, message, register, subscriptions) {
        this.setStatus(name, { health: 'starting', source: 'native', message });
        try {
            const result = await register();
            if (Array.isArray(result)) {
                subscriptions.push(...result);
            }
            else if (result) {
                subscriptions.push(result);
            }
            this.markReady(name, message);
        }
        catch (error) {
            const detail = error instanceof Error ? error.stack ?? error.message : String(error);
            this.markFailed(name, `Failed to register ${message}`, detail);
            void vscode.window.showWarningMessage(`Simple Rich Editor: ${message} failed to register. See output for details.`);
        }
    }
    dispose() {
        this.statusBar.dispose();
        this.outputChannel.dispose();
    }
    renderStatusBar() {
        const values = Array.from(this.statuses.values());
        const hasFailure = values.some((status) => status.health === 'failed');
        const hasDegraded = values.some((status) => status.health === 'degraded');
        const icon = hasFailure ? '$(error)' : hasDegraded ? '$(warning)' : '$(check)';
        this.statusBar.text = `${icon} Simple Rich`;
        const lines = ['Simple Rich Editor Services'];
        for (const [name, status] of this.statuses.entries()) {
            const label = SERVICE_LABELS[name];
            const detail = [status.source, status.message].filter(Boolean).join(' - ');
            lines.push(`${label}: ${status.health}${detail ? ` (${detail})` : ''}`);
        }
        this.statusBar.tooltip = lines.join('\n');
        this.statusBar.backgroundColor = hasFailure
            ? new vscode.ThemeColor('statusBarItem.errorBackground')
            : hasDegraded
                ? new vscode.ThemeColor('statusBarItem.warningBackground')
                : undefined;
    }
}
exports.ExtensionHostServices = ExtensionHostServices;
//# sourceMappingURL=extensionHostServices.js.map