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
exports.createSimpleLspClientBootstrap = createSimpleLspClientBootstrap;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const node_1 = require("vscode-languageclient/node");
const wasmLspBridge_1 = require("../wasm/wasmLspBridge");
const WASM_LSP_PATH = 'wasm/simple-lsp.wasm';
function createSimpleLspClientBootstrap(options) {
    return async (request) => {
        const watcher = vscode.workspace.createFileSystemWatcher(request.clientOptions.synchronize.fileEvents);
        const outputChannel = options.services.outputChannel;
        const clientOptions = {
            documentSelector: request.clientOptions.documentSelector,
            synchronize: {
                fileEvents: watcher,
            },
            outputChannel,
            traceOutputChannel: outputChannel,
            revealOutputChannelOn: node_1.RevealOutputChannelOn.Never,
            initializationOptions: request.initializationOptions,
            initializationFailedHandler: () => false,
            errorHandler: {
                error: () => ({ action: node_1.ErrorAction.Shutdown, handled: true }),
                closed: () => ({ action: node_1.CloseAction.DoNotRestart, handled: true }),
            },
        };
        let client;
        let activeSource = request.server.usingWasm ? 'wasm' : 'native';
        const setFallbackEnabled = (enabled) => {
            for (const control of options.fallbackControls ?? []) {
                control.setEnabled(enabled);
            }
        };
        const syncState = (state) => {
            if (state === node_1.State.Running) {
                options.services.markReady('lsp', 'Simple LSP server running', activeSource);
                setFallbackEnabled(false);
                options.onRunningStateChanged?.(true);
                return;
            }
            if (state === node_1.State.Starting) {
                options.services.setStatus('lsp', {
                    health: 'starting',
                    source: activeSource,
                    message: `Starting Simple LSP server (${activeSource})`,
                });
                options.onRunningStateChanged?.(false);
                return;
            }
            options.services.markDegraded('lsp', 'Simple LSP unavailable; fallback providers active', 'fallback');
            setFallbackEnabled(true);
            options.onRunningStateChanged?.(false);
        };
        return {
            start: async () => {
                const resolved = await resolveServerOptions(request, outputChannel);
                if (!resolved.ok) {
                    setFallbackEnabled(true);
                    options.onRunningStateChanged?.(false);
                    options.services.markDegraded('lsp', resolved.message, 'fallback', resolved.detail);
                    return;
                }
                activeSource = resolved.source;
                client = new node_1.LanguageClient('simple-lsp', 'Simple Language Server', resolved.serverOptions, clientOptions);
                client.onDidChangeState((event) => {
                    outputChannel.info(`Simple LSP state changed: ${node_1.State[event.oldState]} -> ${node_1.State[event.newState]}`);
                    syncState(event.newState);
                });
                syncState(node_1.State.Starting);
                if (activeSource === 'native') {
                    const probe = (0, child_process_1.spawnSync)(request.server.command, request.server.args, {
                        env: request.server.environment,
                        encoding: 'utf-8',
                        timeout: 500,
                    });
                    const probeOutput = [probe.stdout, probe.stderr].filter(Boolean).join('\n').trim();
                    const exitedQuicklyWithError = probe.status !== null && probe.status !== 0;
                    const timedOut = probe.error && 'code' in probe.error && probe.error.code === 'ETIMEDOUT';
                    if (exitedQuicklyWithError && !timedOut) {
                        setFallbackEnabled(true);
                        options.onRunningStateChanged?.(false);
                        options.services.markDegraded('lsp', 'Simple LSP command exits immediately; fallback providers active', 'fallback', probeOutput || `exit ${probe.status}`);
                        return;
                    }
                    const initializeProbe = await probeInitializeHandshake(request.server.command, request.server.args, request.server.environment);
                    if (!initializeProbe.ok) {
                        setFallbackEnabled(true);
                        options.onRunningStateChanged?.(false);
                        options.services.markDegraded('lsp', 'Simple LSP initialize probe failed; fallback providers active', 'fallback', initializeProbe.detail);
                        return;
                    }
                }
                try {
                    await client.start();
                }
                catch (error) {
                    setFallbackEnabled(true);
                    options.onRunningStateChanged?.(false);
                    const detail = error instanceof Error ? error.stack ?? error.message : String(error);
                    options.services.markDegraded('lsp', 'Failed to start Simple LSP server; fallback providers active', 'fallback', detail);
                    throw error;
                }
            },
            restart: async () => {
                if (!client) {
                    return;
                }
                await client.restart();
            },
            stop: async () => {
                setFallbackEnabled(true);
                options.onRunningStateChanged?.(false);
                if (client) {
                    await client.stop();
                }
            },
            dispose: async () => {
                setFallbackEnabled(true);
                options.onRunningStateChanged?.(false);
                watcher.dispose();
                if (client) {
                    await client.stop();
                }
            },
        };
    };
}
async function resolveServerOptions(request, outputChannel) {
    if (request.server.usingWasm) {
        const wasmAvailable = await (0, wasmLspBridge_1.isWasmLspAvailable)(request.context, WASM_LSP_PATH);
        if (wasmAvailable) {
            const wasmOptions = await (0, wasmLspBridge_1.createWasmServerOptions)({
                wasmPath: WASM_LSP_PATH,
                context: request.context,
                outputChannel,
            });
            if (wasmOptions.serverOptions) {
                return {
                    ok: true,
                    serverOptions: wasmOptions.serverOptions,
                    source: 'wasm',
                };
            }
            if (request.configuration.mode === 'wasm') {
                return {
                    ok: false,
                    message: 'Simple LSP WASM mode is enabled but the WASM runtime is unavailable; fallback providers active',
                    detail: wasmOptions.detail ?? `Expected ${WASM_LSP_PATH}`,
                };
            }
        }
        if (request.configuration.mode === 'wasm') {
            return {
                ok: false,
                message: 'Simple LSP WASM mode is enabled but the WASM server is unavailable; fallback providers active',
                detail: wasmAvailable ? undefined : `Expected ${WASM_LSP_PATH}`,
            };
        }
        outputChannel.warn('Simple LSP WASM mode unavailable; falling back to native subprocess.');
    }
    return {
        ok: true,
        source: 'native',
        serverOptions: {
            command: request.server.command,
            args: request.server.args,
            transport: node_1.TransportKind.stdio,
            options: {
                env: request.server.environment,
            },
        },
    };
}
function createJsonRpcMessage(payload) {
    const body = JSON.stringify(payload);
    return `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
}
function tryReadJsonRpcBody(buffer) {
    const marker = '\r\n\r\n';
    const headerEnd = buffer.indexOf(marker);
    if (headerEnd < 0) {
        return undefined;
    }
    const header = buffer.slice(0, headerEnd);
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
        return undefined;
    }
    const contentLength = Number(match[1]);
    const bodyStart = headerEnd + marker.length;
    const body = buffer.slice(bodyStart);
    if (Buffer.byteLength(body, 'utf8') < contentLength) {
        return undefined;
    }
    return JSON.parse(body.slice(0, contentLength));
}
async function probeInitializeHandshake(command, args, environment) {
    return await new Promise((resolve) => {
        const child = (0, child_process_1.spawn)(command, args, {
            env: environment,
            stdio: 'pipe',
        });
        let settled = false;
        let stdout = '';
        let stderr = '';
        const timeout = setTimeout(() => {
            finish({
                ok: false,
                detail: 'initialize timeout',
            });
        }, 1500);
        const finish = (result) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timeout);
            child.kill('SIGKILL');
            resolve(result);
        };
        child.on('error', (error) => {
            finish({ ok: false, detail: error.message });
        });
        child.on('exit', (code, signal) => {
            if (settled) {
                return;
            }
            finish({
                ok: false,
                detail: [stderr.trim(), stdout.trim()].filter(Boolean).join('\n') || `exit ${code ?? signal ?? 'unknown'}`,
            });
        });
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (chunk) => {
            stdout += chunk;
            try {
                const payload = tryReadJsonRpcBody(stdout);
                if (!payload) {
                    return;
                }
                if (payload.error) {
                    finish({
                        ok: false,
                        detail: `${payload.error.message ?? 'initialize failed'}${typeof payload.error.code === 'number' ? ` (${payload.error.code})` : ''}`,
                    });
                    return;
                }
                finish({ ok: true });
            }
            catch (error) {
                finish({
                    ok: false,
                    detail: error instanceof Error ? error.message : String(error),
                });
            }
        });
        child.stderr.on('data', (chunk) => {
            stderr += chunk;
        });
        const initializeRequest = createJsonRpcMessage({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
                processId: process.pid,
                clientInfo: { name: 'simple-vscode-probe', version: '0.1.0' },
                rootUri: vscode.workspace.workspaceFolders?.[0]?.uri.toString() ?? null,
                capabilities: {},
                workspaceFolders: (vscode.workspace.workspaceFolders ?? []).map((folder) => ({
                    uri: folder.uri.toString(),
                    name: folder.name,
                })),
            },
        });
        child.stdin.write(initializeRequest);
    });
}
//# sourceMappingURL=simpleLspClientLifecycle.js.map