import * as vscode from 'vscode';
import type { ServerOptions } from 'vscode-languageclient/node';
import { getWasiPreopens } from './uriConverter';

const WASM_WASI_CORE_EXTENSION_ID = 'ms-vscode.wasm-wasi-core';

export interface WasmLspOptions {
    wasmPath: string;
    context: vscode.ExtensionContext;
    outputChannel: vscode.OutputChannel;
}

export interface WasmServerOptionsResult {
    serverOptions?: ServerOptions;
    detail?: string;
}

export async function createWasmServerOptions(options: WasmLspOptions): Promise<WasmServerOptionsResult> {
    const { wasmPath, context, outputChannel } = options;

    const coreExtension = vscode.extensions.getExtension(WASM_WASI_CORE_EXTENSION_ID);
    if (!coreExtension) {
        outputChannel.appendLine(`WASM WASI core extension ${WASM_WASI_CORE_EXTENSION_ID} is not installed`);
        return {
            detail: `Missing required VS Code extension: ${WASM_WASI_CORE_EXTENSION_ID}`,
        };
    }

    let wasmWasi: any;
    try {
        wasmWasi = await import('@vscode/wasm-wasi');
    } catch {
        outputChannel.appendLine('WASM WASI module not available - falling back to native LSP');
        return { detail: 'VS Code WASM WASI module is not installed in this host.' };
    }

    const wasmUri = vscode.Uri.joinPath(context.extensionUri, wasmPath);
    outputChannel.appendLine(`Loading WASM LSP from ${wasmUri.toString()}`);

    let wasmBytes: Uint8Array;
    try {
        wasmBytes = await vscode.workspace.fs.readFile(wasmUri);
    } catch {
        outputChannel.appendLine(`Failed to read WASM binary at ${wasmUri.toString()}`);
        return { detail: `Failed to read WASM binary at ${wasmUri.toString()}` };
    }

    const preopens = getWasiPreopens();
    const processOptions: any = {
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
            kind: 'workspaceFolder' as const,
            mountPoint: p.wasi,
        }));
    }

    try {
        const wasm = await wasmWasi.Wasm.load();
        const wasiProcess = await wasm.createProcess('simple-lsp', wasmBytes, processOptions);
        outputChannel.appendLine('WASM LSP process created successfully');

        let wasmLsp: any;
        try {
            wasmLsp = await import('@vscode/wasm-wasi-lsp');
        } catch {
            outputChannel.appendLine('WASM WASI LSP module not available');
            return { detail: 'VS Code WASM WASI LSP module is not installed in this host.' };
        }

        return { serverOptions: wasmLsp.createServerOptions(wasiProcess) };
    } catch (error: any) {
        outputChannel.appendLine(`Failed to create WASM LSP process: ${error.message}`);
        return { detail: error.message };
    }
}

export async function isWasmLspAvailable(
    context: vscode.ExtensionContext,
    wasmPath: string,
): Promise<boolean> {
    if (!vscode.extensions.getExtension(WASM_WASI_CORE_EXTENSION_ID)) {
        return false;
    }
    const wasmUri = vscode.Uri.joinPath(context.extensionUri, wasmPath);
    try {
        await vscode.workspace.fs.stat(wasmUri);
        return true;
    } catch {
        return false;
    }
}
