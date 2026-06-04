import * as vscode from 'vscode';
import {
    CloseAction,
    ErrorAction,
    LanguageClient,
    RevealOutputChannelOn,
    State,
} from 'vscode-languageclient/browser';
import { ExtensionHostServices } from '../services/extensionHostServices';
import { createWasmServerOptions, isWasmLspAvailable } from '../wasm/wasmLspBridge';

const WASM_LSP_PATH = 'wasm/simple-lsp.wasm';

export interface BrowserLspFallbackControl {
    setEnabled(enabled: boolean): void;
}

export interface BrowserLspOperationResult {
    ok: boolean;
    message: string;
    detail?: string;
}

export interface CreateSimpleBrowserLspControllerOptions {
    context: vscode.ExtensionContext;
    services: ExtensionHostServices;
    fallbackControls?: BrowserLspFallbackControl[];
}

function createDocumentSelector(): vscode.DocumentSelector {
    return [
        { scheme: 'file', language: 'simple' },
        { scheme: 'untitled', language: 'simple' },
        { scheme: 'vscode-vfs', language: 'simple' },
    ];
}

function readConfiguration(): {
    mode: 'auto' | 'native' | 'wasm';
    enableSemanticTokens: boolean;
    enableInlayHints: boolean;
    enableCodeActions: boolean;
    enablePullDiagnostics: boolean;
    debounceDelay: number;
} {
    const config = vscode.workspace.getConfiguration('simple');
    const rawMode = config.get<string>('lsp.mode', 'auto');
    return {
        mode: rawMode === 'native' || rawMode === 'wasm' ? rawMode : 'auto',
        enableSemanticTokens: config.get<boolean>('lsp.enableSemanticTokens', true),
        enableInlayHints: config.get<boolean>('lsp.enableInlayHints', true),
        enableCodeActions: config.get<boolean>('lsp.enableCodeActions', true),
        enablePullDiagnostics: config.get<boolean>('lsp.enablePullDiagnostics', true),
        debounceDelay: config.get<number>('lsp.debounceDelay', 300),
    };
}

export interface SimpleBrowserLspController extends vscode.Disposable {
    bootstrapClient(): Promise<BrowserLspOperationResult>;
    restartClient(): Promise<BrowserLspOperationResult>;
    showOutputChannel(): void;
}

export function createSimpleBrowserLspController(
    options: CreateSimpleBrowserLspControllerOptions,
): SimpleBrowserLspController {
    const outputChannel = vscode.window.createOutputChannel('Simple LSP Compatibility', { log: true });
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.spl');
    let client: LanguageClient | undefined;

    const setFallbackEnabled = (enabled: boolean): void => {
        for (const control of options.fallbackControls ?? []) {
            control.setEnabled(enabled);
        }
    };

    const syncState = (state: State): void => {
        if (state === State.Running) {
            options.services.markReady('lsp', 'Simple LSP server running', 'wasm');
            setFallbackEnabled(false);
            return;
        }

        if (state === State.Starting) {
            options.services.setStatus('lsp', {
                health: 'starting',
                source: 'wasm',
                message: 'Starting Simple LSP server (wasm)',
            });
            return;
        }

        options.services.markDegraded('lsp', 'Simple LSP unavailable; fallback providers active', 'fallback');
        setFallbackEnabled(true);
    };

    const bootstrapClient = async (): Promise<BrowserLspOperationResult> => {
        const configuration = readConfiguration();
        if (configuration.mode === 'native') {
            setFallbackEnabled(true);
            options.services.markDegraded('lsp', 'Native LSP mode is not supported in browser hosts; fallback providers active', 'fallback');
            return {
                ok: false,
                message: 'Native LSP mode is not supported in browser hosts; fallback providers active',
            };
        }

        const wasmAvailable = await isWasmLspAvailable(options.context, WASM_LSP_PATH);
        if (!wasmAvailable) {
            setFallbackEnabled(true);
            options.services.markDegraded('lsp', 'Simple LSP WASM artifact is unavailable; fallback providers active', 'fallback', `Expected ${WASM_LSP_PATH}`);
            return {
                ok: false,
                message: 'Simple LSP WASM artifact is unavailable; fallback providers active',
                detail: `Expected ${WASM_LSP_PATH}`,
            };
        }

        const wasmOptions = await createWasmServerOptions({
            wasmPath: WASM_LSP_PATH,
            context: options.context,
            outputChannel,
        });
        if (!wasmOptions.serverOptions) {
            setFallbackEnabled(true);
            options.services.markDegraded(
                'lsp',
                'Simple LSP WASM mode is enabled but the WASM runtime is unavailable; fallback providers active',
                'fallback',
                wasmOptions.detail,
            );
            return {
                ok: false,
                message: 'Simple LSP WASM mode is enabled but the WASM runtime is unavailable; fallback providers active',
                detail: wasmOptions.detail,
            };
        }

        const clientOptions = {
            documentSelector: createDocumentSelector() as never,
            synchronize: {
                fileEvents: watcher,
            },
            outputChannel,
            traceOutputChannel: outputChannel,
            revealOutputChannelOn: RevealOutputChannelOn.Never,
            initializationOptions: {
                semanticTokens: configuration.enableSemanticTokens,
                inlayHints: configuration.enableInlayHints,
                codeActions: configuration.enableCodeActions,
                pullDiagnostics: configuration.enablePullDiagnostics,
                debounceDelay: configuration.debounceDelay,
                wasmMode: true,
            },
            initializationFailedHandler: () => false,
            errorHandler: {
                error: () => ({ action: ErrorAction.Shutdown, handled: true }),
                closed: () => ({ action: CloseAction.DoNotRestart, handled: true }),
            },
        };

        client = new LanguageClient(
            'simple-lsp',
            'Simple Language Server',
            wasmOptions.serverOptions as never,
            clientOptions,
        );
        client.onDidChangeState((event) => {
            outputChannel.info(`Simple LSP state changed: ${State[event.oldState]} -> ${State[event.newState]}`);
            syncState(event.newState);
        });
        syncState(State.Starting);

        try {
            await client.start();
            return {
                ok: true,
                message: 'LSP client bootstrap completed.',
            };
        } catch (error) {
            setFallbackEnabled(true);
            const detail = error instanceof Error ? error.stack ?? error.message : String(error);
            options.services.markDegraded('lsp', 'Failed to start Simple LSP server; fallback providers active', 'fallback', detail);
            return {
                ok: false,
                message: 'Failed to start Simple LSP server; fallback providers active',
                detail,
            };
        }
    };

    return {
        async bootstrapClient(): Promise<BrowserLspOperationResult> {
            return bootstrapClient();
        },
        async restartClient(): Promise<BrowserLspOperationResult> {
            if (!client) {
                return bootstrapClient();
            }
            try {
                await client.stop();
                client = undefined;
                return bootstrapClient();
            } catch (error) {
                const detail = error instanceof Error ? error.stack ?? error.message : String(error);
                options.services.markDegraded('lsp', 'Failed to restart attached LSP client.', 'fallback', detail);
                setFallbackEnabled(true);
                return {
                    ok: false,
                    message: 'Failed to restart attached LSP client.',
                    detail,
                };
            }
        },
        showOutputChannel(): void {
            outputChannel.show(true);
        },
        dispose(): void {
            setFallbackEnabled(true);
            watcher.dispose();
            void client?.stop();
            outputChannel.dispose();
        },
    };
}
