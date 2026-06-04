import * as vscode from 'vscode';
import { spawn, spawnSync } from 'child_process';
import {
    CloseAction,
    ErrorAction,
    LanguageClient,
    LanguageClientOptions,
    RevealOutputChannelOn,
    ServerOptions,
    State,
    TransportKind,
} from 'vscode-languageclient/node';
import { ExtensionHostServices } from '../services/extensionHostServices';
import { SimpleLspBootstrapHook, SimpleLspBootstrapRequest } from './simpleLspCompatibility';
import { createWasmServerOptions, isWasmLspAvailable } from '../wasm/wasmLspBridge';

const WASM_LSP_PATH = 'wasm/simple-lsp.wasm';

export interface LspFallbackControls {
    setEnabled(enabled: boolean): void;
}

export interface CreateSimpleLspClientBootstrapOptions {
    services: ExtensionHostServices;
    onRunningStateChanged?: (running: boolean) => void;
    fallbackControls?: LspFallbackControls[];
}

export function createSimpleLspClientBootstrap(
    options: CreateSimpleLspClientBootstrapOptions,
): SimpleLspBootstrapHook {
    return async (request: SimpleLspBootstrapRequest) => {
        const watcher = vscode.workspace.createFileSystemWatcher(request.clientOptions.synchronize.fileEvents);
        const outputChannel = options.services.outputChannel;
        const clientOptions: LanguageClientOptions = {
            documentSelector: request.clientOptions.documentSelector as LanguageClientOptions['documentSelector'],
            synchronize: {
                fileEvents: watcher,
            },
            outputChannel,
            traceOutputChannel: outputChannel,
            revealOutputChannelOn: RevealOutputChannelOn.Never,
            initializationOptions: request.initializationOptions,
            initializationFailedHandler: () => false,
            errorHandler: {
                error: () => ({ action: ErrorAction.Shutdown, handled: true }),
                closed: () => ({ action: CloseAction.DoNotRestart, handled: true }),
            },
        };
        let client: LanguageClient | undefined;
        let activeSource: 'native' | 'wasm' = request.server.usingWasm ? 'wasm' : 'native';

        const setFallbackEnabled = (enabled: boolean): void => {
            for (const control of options.fallbackControls ?? []) {
                control.setEnabled(enabled);
            }
        };

        const syncState = (state: State): void => {
            if (state === State.Running) {
                options.services.markReady('lsp', 'Simple LSP server running', activeSource);
                setFallbackEnabled(false);
                options.onRunningStateChanged?.(true);
                return;
            }

            if (state === State.Starting) {
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
                    options.services.markDegraded(
                        'lsp',
                        resolved.message,
                        'fallback',
                        resolved.detail,
                    );
                    return;
                }
                activeSource = resolved.source;
                client = new LanguageClient(
                    'simple-lsp',
                    'Simple Language Server',
                    resolved.serverOptions,
                    clientOptions,
                );
                client.onDidChangeState((event) => {
                    outputChannel.info(`Simple LSP state changed: ${State[event.oldState]} -> ${State[event.newState]}`);
                    syncState(event.newState);
                });
                syncState(State.Starting);

                if (activeSource === 'native') {
                    const probe = spawnSync(request.server.command, request.server.args, {
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
                        options.services.markDegraded(
                            'lsp',
                            'Simple LSP command exits immediately; fallback providers active',
                            'fallback',
                            probeOutput || `exit ${probe.status}`,
                        );
                        return;
                    }
                    const initializeProbe = await probeInitializeHandshake(request.server.command, request.server.args, request.server.environment);
                    if (!initializeProbe.ok) {
                        setFallbackEnabled(true);
                        options.onRunningStateChanged?.(false);
                        options.services.markDegraded(
                            'lsp',
                            'Simple LSP initialize probe failed; fallback providers active',
                            'fallback',
                            initializeProbe.detail,
                        );
                        return;
                    }
                }
                try {
                    await client.start();
                } catch (error) {
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

interface ResolvedServerOptions {
    ok: true;
    serverOptions: ServerOptions;
    source: 'native' | 'wasm';
}

interface FailedServerOptions {
    ok: false;
    message: string;
    detail?: string;
}

async function resolveServerOptions(
    request: SimpleLspBootstrapRequest,
    outputChannel: vscode.LogOutputChannel,
): Promise<ResolvedServerOptions | FailedServerOptions> {
    if (request.server.usingWasm) {
        const wasmAvailable = await isWasmLspAvailable(request.context, WASM_LSP_PATH);
        if (wasmAvailable) {
            const wasmOptions = await createWasmServerOptions({
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
            transport: TransportKind.stdio,
            options: {
                env: request.server.environment,
            },
        },
    };
}

interface LspInitializeProbeResult {
    ok: boolean;
    detail?: string;
}

function createJsonRpcMessage(payload: unknown): string {
    const body = JSON.stringify(payload);
    return `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
}

function tryReadJsonRpcBody(buffer: string): unknown | undefined {
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

async function probeInitializeHandshake(
    command: string,
    args: string[],
    environment: NodeJS.ProcessEnv,
): Promise<LspInitializeProbeResult> {
    return await new Promise<LspInitializeProbeResult>((resolve) => {
        const child = spawn(command, args, {
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

        const finish = (result: LspInitializeProbeResult): void => {
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
        child.stdout.on('data', (chunk: string) => {
            stdout += chunk;
            try {
                const payload = tryReadJsonRpcBody(stdout) as { error?: { message?: string; code?: number } } | undefined;
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
            } catch (error) {
                finish({
                    ok: false,
                    detail: error instanceof Error ? error.message : String(error),
                });
            }
        });
        child.stderr.on('data', (chunk: string) => {
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
