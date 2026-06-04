import * as vscode from 'vscode';

export enum EnvironmentKind {
    Desktop = 'desktop',
    Web = 'web',
    Remote = 'remote',
}

export enum LspMode {
    Auto = 'auto',
    Native = 'native',
    Wasm = 'wasm',
}

export function detectEnvironment(): EnvironmentKind {
    if (vscode.env.uiKind === vscode.UIKind.Web) {
        return EnvironmentKind.Web;
    }
    if (vscode.env.remoteName) {
        return EnvironmentKind.Remote;
    }
    return EnvironmentKind.Desktop;
}

export function determineLspMode(): LspMode {
    const config = vscode.workspace.getConfiguration('simple');
    const userMode = config.get<string>('lsp.mode', 'auto');
    switch (userMode) {
        case 'native':
            return LspMode.Native;
        case 'wasm':
            return LspMode.Wasm;
        default:
            return LspMode.Auto;
    }
}

export function shouldUseWasm(): boolean {
    const mode = determineLspMode();
    const env = detectEnvironment();
    switch (mode) {
        case LspMode.Native:
            return false;
        case LspMode.Wasm:
            return true;
        case LspMode.Auto:
            return env === EnvironmentKind.Web;
    }
}

export function getEnvironmentDescription(): string {
    return `Environment: ${detectEnvironment()}, Mode: ${determineLspMode()}, Using WASM: ${shouldUseWasm()}`;
}
