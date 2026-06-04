import * as vscode from 'vscode';
export type ServiceHealth = 'idle' | 'starting' | 'ready' | 'degraded' | 'failed';
export interface ServiceStatus {
    health: ServiceHealth;
    source: 'native' | 'wasm' | 'fallback' | 'none';
    message?: string;
    lastError?: string;
}
export type ServiceName = 'editor' | 'math' | 'lsp' | 'ai' | 'symbols' | 'diagnostics' | 'semanticTokens' | 'tests' | 'cli';
export declare class ExtensionHostServices implements vscode.Disposable {
    readonly outputChannel: vscode.LogOutputChannel;
    private readonly statusBar;
    private readonly statuses;
    constructor();
    setStatus(name: ServiceName, next: ServiceStatus): void;
    markReady(name: ServiceName, message?: string, source?: ServiceStatus['source']): void;
    markDegraded(name: ServiceName, message: string, source?: ServiceStatus['source'], lastError?: string): void;
    markFailed(name: ServiceName, message: string, lastError?: string): void;
    showOutputChannel(): void;
    safeRegister(name: ServiceName, message: string, register: () => Promise<vscode.Disposable | readonly vscode.Disposable[] | void> | vscode.Disposable | readonly vscode.Disposable[] | void, subscriptions: vscode.Disposable[]): Promise<void>;
    dispose(): void;
    private renderStatusBar;
}
