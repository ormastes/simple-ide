import * as vscode from 'vscode';

export type ServiceHealth = 'idle' | 'starting' | 'ready' | 'degraded' | 'failed';

export interface ServiceStatus {
    health: ServiceHealth;
    source: 'native' | 'wasm' | 'fallback' | 'none';
    message?: string;
    lastError?: string;
}

export type ServiceName =
    | 'editor'
    | 'math'
    | 'lsp'
    | 'ai'
    | 'symbols'
    | 'diagnostics'
    | 'semanticTokens'
    | 'tests'
    | 'cli';

const SERVICE_LABELS: Record<ServiceName, string> = {
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

export class ExtensionHostServices implements vscode.Disposable {
    public readonly outputChannel: vscode.LogOutputChannel;
    private readonly statusBar: vscode.StatusBarItem;
    private readonly statuses = new Map<ServiceName, ServiceStatus>();

    public constructor() {
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

    public setStatus(name: ServiceName, next: ServiceStatus): void {
        this.statuses.set(name, next);
        const prefix = `${SERVICE_LABELS[name]} ${next.health.toUpperCase()}`;
        const detail = [next.message, next.lastError].filter(Boolean).join(' | ');
        this.outputChannel.info(detail ? `${prefix}: ${detail}` : prefix);
        this.renderStatusBar();
    }

    public markReady(name: ServiceName, message?: string, source: ServiceStatus['source'] = 'native'): void {
        this.setStatus(name, { health: 'ready', source, message });
    }

    public markDegraded(name: ServiceName, message: string, source: ServiceStatus['source'] = 'fallback', lastError?: string): void {
        this.setStatus(name, { health: 'degraded', source, message, lastError });
    }

    public markFailed(name: ServiceName, message: string, lastError?: string): void {
        this.setStatus(name, { health: 'failed', source: 'none', message, lastError });
    }

    public showOutputChannel(): void {
        this.outputChannel.show();
    }

    public async safeRegister(
        name: ServiceName,
        message: string,
        register: () => Promise<vscode.Disposable | readonly vscode.Disposable[] | void> | vscode.Disposable | readonly vscode.Disposable[] | void,
        subscriptions: vscode.Disposable[],
    ): Promise<void> {
        this.setStatus(name, { health: 'starting', source: 'native', message });
        try {
            const result = await register();
            if (Array.isArray(result)) {
                subscriptions.push(...result);
            } else if (result) {
                subscriptions.push(result as vscode.Disposable);
            }
            this.markReady(name, message);
        } catch (error) {
            const detail = error instanceof Error ? error.stack ?? error.message : String(error);
            this.markFailed(name, `Failed to register ${message}`, detail);
            void vscode.window.showWarningMessage(`Simple Rich Editor: ${message} failed to register. See output for details.`);
        }
    }

    public dispose(): void {
        this.statusBar.dispose();
        this.outputChannel.dispose();
    }

    private renderStatusBar(): void {
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
