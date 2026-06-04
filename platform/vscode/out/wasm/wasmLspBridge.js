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
exports.createWasmServerOptions = createWasmServerOptions;
exports.isWasmLspAvailable = isWasmLspAvailable;
const vscode = __importStar(require("vscode"));
const uriConverter_1 = require("./uriConverter");
const WASM_WASI_CORE_EXTENSION_ID = 'ms-vscode.wasm-wasi-core';
async function createWasmServerOptions(options) {
    const { wasmPath, context, outputChannel } = options;
    const coreExtension = vscode.extensions.getExtension(WASM_WASI_CORE_EXTENSION_ID);
    if (!coreExtension) {
        outputChannel.appendLine(`WASM WASI core extension ${WASM_WASI_CORE_EXTENSION_ID} is not installed`);
        return {
            detail: `Missing required VS Code extension: ${WASM_WASI_CORE_EXTENSION_ID}`,
        };
    }
    let wasmWasi;
    try {
        wasmWasi = await import('@vscode/wasm-wasi');
    }
    catch {
        outputChannel.appendLine('WASM WASI module not available - falling back to native LSP');
        return { detail: 'VS Code WASM WASI module is not installed in this host.' };
    }
    const wasmUri = vscode.Uri.joinPath(context.extensionUri, wasmPath);
    outputChannel.appendLine(`Loading WASM LSP from ${wasmUri.toString()}`);
    let wasmBytes;
    try {
        wasmBytes = await vscode.workspace.fs.readFile(wasmUri);
    }
    catch {
        outputChannel.appendLine(`Failed to read WASM binary at ${wasmUri.toString()}`);
        return { detail: `Failed to read WASM binary at ${wasmUri.toString()}` };
    }
    const preopens = (0, uriConverter_1.getWasiPreopens)();
    const processOptions = {
        stdio: {
            in: { kind: 'pipeIn' },
            out: { kind: 'pipeOut' },
            err: { kind: 'pipeOut' },
        },
        args: [],
        env: {
            SIMPLE_RUNTIME_MODE: 'wasi',
            SIMPLE_LSP_DEBUG: '0',
        },
    };
    if (preopens.length > 0) {
        processOptions.mountPoints = preopens.map((p) => ({
            kind: 'workspaceFolder',
            mountPoint: p.wasi,
        }));
    }
    try {
        const wasm = await wasmWasi.Wasm.load();
        const wasiProcess = await wasm.createProcess('simple-lsp', wasmBytes, processOptions);
        outputChannel.appendLine('WASM LSP process created successfully');
        let wasmLsp;
        try {
            wasmLsp = await import('@vscode/wasm-wasi-lsp');
        }
        catch {
            outputChannel.appendLine('WASM WASI LSP module not available');
            return { detail: 'VS Code WASM WASI LSP module is not installed in this host.' };
        }
        return { serverOptions: wasmLsp.createServerOptions(wasiProcess) };
    }
    catch (error) {
        outputChannel.appendLine(`Failed to create WASM LSP process: ${error.message}`);
        return { detail: error.message };
    }
}
async function isWasmLspAvailable(context, wasmPath) {
    if (!vscode.extensions.getExtension(WASM_WASI_CORE_EXTENSION_ID)) {
        return false;
    }
    const wasmUri = vscode.Uri.joinPath(context.extensionUri, wasmPath);
    try {
        await vscode.workspace.fs.stat(wasmUri);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=wasmLspBridge.js.map