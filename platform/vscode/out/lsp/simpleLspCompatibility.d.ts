import * as vscode from 'vscode';
import { SimpleLspClientOptionsSnapshot, SimpleLspConfigurationSnapshot, SimpleLspInitializationOptions, SimpleLspServerResolution } from '../services/simpleLspServerResolver';
export interface SimpleLspClientLifecycle {
    start?: () => Promise<void> | void;
    restart?: () => Promise<void> | void;
    stop?: () => Promise<void> | void;
    dispose?: () => Promise<void> | void;
}
export interface SimpleLspBootstrapRequest {
    context: vscode.ExtensionContext;
    configuration: SimpleLspConfigurationSnapshot;
    initializationOptions: SimpleLspInitializationOptions;
    clientOptions: SimpleLspClientOptionsSnapshot;
    server: SimpleLspServerResolution;
}
export type SimpleLspBootstrapHook = (request: SimpleLspBootstrapRequest) => Promise<SimpleLspClientLifecycle | undefined> | SimpleLspClientLifecycle | undefined;
export interface SimpleLspOperationResult {
    ok: boolean;
    message: string;
    detail?: string;
}
export declare class SimpleLspCompatibilitySurface implements vscode.Disposable {
    private readonly context;
    private readonly outputChannel;
    private readonly documentSelector;
    private bootstrapHook?;
    private client?;
    private disposed;
    constructor(context: vscode.ExtensionContext);
    get configuration(): SimpleLspConfigurationSnapshot;
    get initializationOptions(): SimpleLspInitializationOptions;
    get clientOptions(): SimpleLspClientOptionsSnapshot;
    showOutputChannel(): void;
    resolveServerCommand(resolveFrom?: string): SimpleLspServerResolution;
    getDocumentSelector(): vscode.DocumentSelector;
    setClientBootstrap(hook: SimpleLspBootstrapHook | undefined): void;
    attachClient(client: SimpleLspClientLifecycle | undefined): void;
    bootstrapClient(resolveFrom?: string): Promise<SimpleLspOperationResult>;
    restartClient(): Promise<SimpleLspOperationResult>;
    dispose(): Promise<void>;
    private log;
    private fail;
}
export declare function createSimpleLspCompatibilitySurface(context: vscode.ExtensionContext): SimpleLspCompatibilitySurface;
