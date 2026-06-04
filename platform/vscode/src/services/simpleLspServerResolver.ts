import * as fs from 'fs';
import * as path from 'path';
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

export function readSimpleLspConfiguration(): SimpleLspConfigurationSnapshot {
    const config = vscode.workspace.getConfiguration('simple');
    const rawMode = config.get<string>('lsp.mode', 'auto');
    const mode: SimpleLspMode = rawMode === 'native' || rawMode === 'wasm' ? rawMode : 'auto';

    return {
        serverPath: config.get<string>('lsp.serverPath', '').trim(),
        mode,
        enableSemanticTokens: config.get<boolean>('lsp.enableSemanticTokens', true),
        enableInlayHints: config.get<boolean>('lsp.enableInlayHints', true),
        enableCodeActions: config.get<boolean>('lsp.enableCodeActions', true),
        enablePullDiagnostics: config.get<boolean>('lsp.enablePullDiagnostics', true),
        debounceDelay: config.get<number>('lsp.debounceDelay', 300),
    };
}

export function createSimpleLspDocumentSelector(): vscode.DocumentSelector {
    return [
        { scheme: 'file', language: 'simple' },
        { scheme: 'untitled', language: 'simple' },
        { scheme: 'vscode-vfs', language: 'simple' },
    ];
}

export function buildSimpleLspInitializationOptions(
    snapshot: SimpleLspConfigurationSnapshot = readSimpleLspConfiguration(),
    wasmMode: boolean = shouldUseWasmFromSnapshot(snapshot),
): SimpleLspInitializationOptions {
    return {
        semanticTokens: snapshot.enableSemanticTokens,
        inlayHints: snapshot.enableInlayHints,
        codeActions: snapshot.enableCodeActions,
        pullDiagnostics: snapshot.enablePullDiagnostics,
        debounceDelay: snapshot.debounceDelay,
        wasmMode,
    };
}

export function buildSimpleLspClientOptions(
    snapshot: SimpleLspConfigurationSnapshot = readSimpleLspConfiguration(),
    wasmMode: boolean = shouldUseWasmFromSnapshot(snapshot),
): SimpleLspClientOptionsSnapshot {
    return {
        documentSelector: createSimpleLspDocumentSelector(),
        synchronize: {
            fileEvents: '**/*.spl',
        },
        traceOutput: 'Simple LSP Compatibility',
        initializationOptions: buildSimpleLspInitializationOptions(snapshot, wasmMode),
    };
}

export interface ResolveSimpleLspServerCommandOptions {
    context: vscode.ExtensionContext;
    resolveFrom?: string;
    snapshot?: SimpleLspConfigurationSnapshot;
}

export function resolveSimpleLspServerCommand(
    options: ResolveSimpleLspServerCommandOptions,
): SimpleLspServerResolution {
    const snapshot = options.snapshot ?? readSimpleLspConfiguration();
    const usingWasm = shouldUseWasmFromSnapshot(snapshot);
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const searchRoots = collectSearchRoots(options.resolveFrom, workspaceRoot, options.context.extensionUri.fsPath);

    const notes: string[] = [];
    let command = snapshot.serverPath;
    let source: SimpleLspServerResolution['source'] = 'config';
    let resolvedRoot: string | undefined;

    if (command) {
        notes.push('Using configured simple.lsp.serverPath.');
    } else {
        const candidates = ['simple_lsp_server', 'simple'];
        for (const searchRoot of searchRoots) {
            const { root, origin } = searchRoot;
            for (const candidateName of candidates) {
                const candidate = path.join(root, 'bin', candidateName);
                if (isExecutable(candidate)) {
                    command = candidate;
                    resolvedRoot = findRepositoryRoot(candidate);
                    source = origin;
                    notes.push(`Resolved native LSP server from ${candidate}.`);
                    break;
                }
            }
            if (command) {
                break;
            }
        }
    }

    if (!command) {
        command = 'simple';
        source = 'fallback';
        notes.push('Falling back to simple from PATH.');
    }

    const isWrapper = isSimpleLspWrapper(command);
    const args = isWrapper ? [] : ['lsp'];
    const environment: NodeJS.ProcessEnv = {
        ...process.env,
    };

    const repoRoot = resolvedRoot ?? (path.isAbsolute(command) ? findRepositoryRoot(command) : undefined);
    if (repoRoot) {
        environment.SIMPLE_LIB = path.join(repoRoot, 'src');
        notes.push(`Derived SIMPLE_LIB=${environment.SIMPLE_LIB}.`);
    } else if (workspaceRoot) {
        environment.SIMPLE_LIB = path.join(workspaceRoot, 'src');
        notes.push(`Using workspace SIMPLE_LIB=${environment.SIMPLE_LIB}.`);
    } else if (process.env.SIMPLE_LIB) {
        environment.SIMPLE_LIB = process.env.SIMPLE_LIB;
        notes.push('Using existing SIMPLE_LIB environment value.');
    }

    if (usingWasm) {
        notes.push('LSP mode prefers WASM; native command kept as fallback/bootstrap hint.');
    }

    return {
        command,
        args,
        transport: 'stdio',
        usingWasm,
        source,
        environment,
        notes,
    };
}

function shouldUseWasmFromSnapshot(snapshot: SimpleLspConfigurationSnapshot): boolean {
    if (snapshot.mode === 'native') {
        return false;
    }

    if (snapshot.mode === 'wasm') {
        return true;
    }

    return vscode.env.uiKind === vscode.UIKind.Web;
}

function collectSearchRoots(
    resolveFrom: string | undefined,
    workspaceRoot: string | undefined,
    extensionRoot: string,
): Array<{ root: string; origin: SimpleLspServerResolution['source'] }> {
    const roots: Array<{ root: string; origin: SimpleLspServerResolution['source'] }> = [];
    for (const candidate of [resolveFrom, workspaceRoot, extensionRoot]) {
        if (!candidate) {
            continue;
        }
        const origin: SimpleLspServerResolution['source'] = candidate === resolveFrom
            ? 'resolveFrom'
            : candidate === workspaceRoot
                ? 'workspace'
                : 'extension';
        for (const root of walkUpwards(candidate)) {
            roots.push({ root, origin });
        }
    }
    return dedupe(roots);
}

function walkUpwards(start: string): string[] {
    const roots: string[] = [];
    let current = fs.existsSync(start) && fs.statSync(start).isDirectory() ? start : path.dirname(start);

    while (true) {
        roots.push(current);
        const parent = path.dirname(current);
        if (parent === current) {
            break;
        }
        current = parent;
    }

    return roots;
}

function dedupe(values: Array<{ root: string; origin: SimpleLspServerResolution['source'] }>): Array<{ root: string; origin: SimpleLspServerResolution['source'] }> {
    const seen = new Set<string>();
    const unique: Array<{ root: string; origin: SimpleLspServerResolution['source'] }> = [];
    for (const value of values) {
        if (seen.has(value.root)) {
            continue;
        }
        seen.add(value.root);
        unique.push(value);
    }
    return unique;
}

function isExecutable(candidate: string): boolean {
    try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return true;
    } catch {
        return false;
    }
}

function isSimpleLspWrapper(command: string): boolean {
    const base = path.basename(command).toLowerCase();
    return base === 'simple_lsp_server' || base === 'simple_lsp_server.exe';
}

function findRepositoryRoot(command: string): string | undefined {
    if (!path.isAbsolute(command)) {
        return undefined;
    }

    const parent = path.dirname(command);
    const grandParent = path.dirname(parent);
    return grandParent && grandParent !== parent ? grandParent : undefined;
}
