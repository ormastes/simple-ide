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
exports.readSimpleLspConfiguration = readSimpleLspConfiguration;
exports.createSimpleLspDocumentSelector = createSimpleLspDocumentSelector;
exports.buildSimpleLspInitializationOptions = buildSimpleLspInitializationOptions;
exports.buildSimpleLspClientOptions = buildSimpleLspClientOptions;
exports.resolveSimpleLspServerCommand = resolveSimpleLspServerCommand;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
function readSimpleLspConfiguration() {
    const config = vscode.workspace.getConfiguration('simple');
    const rawMode = config.get('lsp.mode', 'auto');
    const mode = rawMode === 'native' || rawMode === 'wasm' ? rawMode : 'auto';
    return {
        serverPath: config.get('lsp.serverPath', '').trim(),
        mode,
        enableSemanticTokens: config.get('lsp.enableSemanticTokens', true),
        enableInlayHints: config.get('lsp.enableInlayHints', true),
        enableCodeActions: config.get('lsp.enableCodeActions', true),
        enablePullDiagnostics: config.get('lsp.enablePullDiagnostics', true),
        debounceDelay: config.get('lsp.debounceDelay', 300),
    };
}
function createSimpleLspDocumentSelector() {
    return [
        { scheme: 'file', language: 'simple' },
        { scheme: 'untitled', language: 'simple' },
        { scheme: 'vscode-vfs', language: 'simple' },
    ];
}
function buildSimpleLspInitializationOptions(snapshot = readSimpleLspConfiguration(), wasmMode = shouldUseWasmFromSnapshot(snapshot)) {
    return {
        semanticTokens: snapshot.enableSemanticTokens,
        inlayHints: snapshot.enableInlayHints,
        codeActions: snapshot.enableCodeActions,
        pullDiagnostics: snapshot.enablePullDiagnostics,
        debounceDelay: snapshot.debounceDelay,
        wasmMode,
    };
}
function buildSimpleLspClientOptions(snapshot = readSimpleLspConfiguration(), wasmMode = shouldUseWasmFromSnapshot(snapshot)) {
    return {
        documentSelector: createSimpleLspDocumentSelector(),
        synchronize: {
            fileEvents: '**/*.spl',
        },
        traceOutput: 'Simple LSP Compatibility',
        initializationOptions: buildSimpleLspInitializationOptions(snapshot, wasmMode),
    };
}
function resolveSimpleLspServerCommand(options) {
    const snapshot = options.snapshot ?? readSimpleLspConfiguration();
    const usingWasm = shouldUseWasmFromSnapshot(snapshot);
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const searchRoots = collectSearchRoots(options.resolveFrom, workspaceRoot, options.context.extensionUri.fsPath);
    const notes = [];
    let command = snapshot.serverPath;
    let source = 'config';
    let resolvedRoot;
    if (command) {
        notes.push('Using configured simple.lsp.serverPath.');
    }
    else {
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
    const environment = {
        ...process.env,
    };
    const repoRoot = resolvedRoot ?? (path.isAbsolute(command) ? findRepositoryRoot(command) : undefined);
    if (repoRoot) {
        environment.SIMPLE_LIB = path.join(repoRoot, 'src');
        notes.push(`Derived SIMPLE_LIB=${environment.SIMPLE_LIB}.`);
    }
    else if (workspaceRoot) {
        environment.SIMPLE_LIB = path.join(workspaceRoot, 'src');
        notes.push(`Using workspace SIMPLE_LIB=${environment.SIMPLE_LIB}.`);
    }
    else if (process.env.SIMPLE_LIB) {
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
function shouldUseWasmFromSnapshot(snapshot) {
    if (snapshot.mode === 'native') {
        return false;
    }
    if (snapshot.mode === 'wasm') {
        return true;
    }
    return vscode.env.uiKind === vscode.UIKind.Web;
}
function collectSearchRoots(resolveFrom, workspaceRoot, extensionRoot) {
    const roots = [];
    for (const candidate of [resolveFrom, workspaceRoot, extensionRoot]) {
        if (!candidate) {
            continue;
        }
        const origin = candidate === resolveFrom
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
function walkUpwards(start) {
    const roots = [];
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
function dedupe(values) {
    const seen = new Set();
    const unique = [];
    for (const value of values) {
        if (seen.has(value.root)) {
            continue;
        }
        seen.add(value.root);
        unique.push(value);
    }
    return unique;
}
function isExecutable(candidate) {
    try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return true;
    }
    catch {
        return false;
    }
}
function isSimpleLspWrapper(command) {
    const base = path.basename(command).toLowerCase();
    return base === 'simple_lsp_server' || base === 'simple_lsp_server.exe';
}
function findRepositoryRoot(command) {
    if (!path.isAbsolute(command)) {
        return undefined;
    }
    const parent = path.dirname(command);
    const grandParent = path.dirname(parent);
    return grandParent && grandParent !== parent ? grandParent : undefined;
}
//# sourceMappingURL=simpleLspServerResolver.js.map