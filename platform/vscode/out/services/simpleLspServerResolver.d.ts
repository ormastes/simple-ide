import * as vscode from 'vscode';
export type SimpleLspMode = 'auto' | 'native' | 'wasm';
export interface SimpleLspConfigurationSnapshot {
    serverPath: string;
    mode: SimpleLspMode;
    enableSemanticTokens: boolean;
    enableInlayHints: boolean;
    enableCodeActions: boolean;
    enablePullDiagnostics: boolean;
    debounceDelay: number;
}
export interface SimpleLspInitializationOptions {
    semanticTokens: boolean;
    inlayHints: boolean;
    codeActions: boolean;
    pullDiagnostics: boolean;
    debounceDelay: number;
    wasmMode: boolean;
}
export interface SimpleLspServerResolution {
    command: string;
    args: string[];
    transport: 'stdio';
    usingWasm: boolean;
    source: 'config' | 'resolveFrom' | 'workspace' | 'extension' | 'fallback';
    environment: NodeJS.ProcessEnv;
    notes: string[];
}
export interface SimpleLspClientOptionsSnapshot {
    documentSelector: vscode.DocumentSelector;
    synchronize: {
        fileEvents: string;
    };
    traceOutput: string;
    initializationOptions: SimpleLspInitializationOptions;
}
export declare function readSimpleLspConfiguration(): SimpleLspConfigurationSnapshot;
export declare function createSimpleLspDocumentSelector(): vscode.DocumentSelector;
export declare function buildSimpleLspInitializationOptions(snapshot?: SimpleLspConfigurationSnapshot, wasmMode?: boolean): SimpleLspInitializationOptions;
export declare function buildSimpleLspClientOptions(snapshot?: SimpleLspConfigurationSnapshot, wasmMode?: boolean): SimpleLspClientOptionsSnapshot;
export interface ResolveSimpleLspServerCommandOptions {
    context: vscode.ExtensionContext;
    resolveFrom?: string;
    snapshot?: SimpleLspConfigurationSnapshot;
}
export declare function resolveSimpleLspServerCommand(options: ResolveSimpleLspServerCommandOptions): SimpleLspServerResolution;
