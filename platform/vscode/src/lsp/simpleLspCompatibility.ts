import * as vscode from 'vscode';
import {
    buildSimpleLspClientOptions,
    buildSimpleLspInitializationOptions,
    createSimpleLspDocumentSelector,
    readSimpleLspConfiguration,
    resolveSimpleLspServerCommand,
    SimpleLspClientOptionsSnapshot,
    SimpleLspConfigurationSnapshot,
    SimpleLspInitializationOptions,
    SimpleLspServerResolution,
} from '../services/simpleLspServerResolver';

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

export type SimpleLspBootstrapHook =
    (request: SimpleLspBootstrapRequest) => Promise<SimpleLspClientLifecycle | undefined> | SimpleLspClientLifecycle | undefined;

export interface SimpleLspOperationResult {
    ok: boolean;
    message: string;
    detail?: string;
}

export class SimpleLspCompatibilitySurface implements vscode.Disposable {
    private readonly outputChannel: vscode.LogOutputChannel;
    private readonly documentSelector = createSimpleLspDocumentSelector();
    private bootstrapHook?: SimpleLspBootstrapHook;
    private client?: SimpleLspClientLifecycle;
    private disposed = false;

    public constructor(private readonly context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('Simple LSP Compatibility', { log: true });
        this.log('Compatibility surface created.');
    }

    public get configuration(): SimpleLspConfigurationSnapshot {
        return readSimpleLspConfiguration();
    }

    public get initializationOptions(): SimpleLspInitializationOptions {
        return buildSimpleLspInitializationOptions(this.configuration);
    }

    public get clientOptions(): SimpleLspClientOptionsSnapshot {
        return buildSimpleLspClientOptions(this.configuration);
    }

    public showOutputChannel(): void {
        this.outputChannel.show(true);
    }

    public resolveServerCommand(resolveFrom?: string): SimpleLspServerResolution {
        const server = resolveSimpleLspServerCommand({
            context: this.context,
            resolveFrom,
            snapshot: this.configuration,
        });
        this.log(`Resolved LSP server command: ${server.command} ${server.args.join(' ')}`.trim());
        for (const note of server.notes) {
            this.log(note);
        }
        return server;
    }

    public getDocumentSelector(): vscode.DocumentSelector {
        return this.documentSelector;
    }

    public setClientBootstrap(hook: SimpleLspBootstrapHook | undefined): void {
        this.bootstrapHook = hook;
        this.log(hook ? 'Client bootstrap hook registered.' : 'Client bootstrap hook cleared.');
    }

    public attachClient(client: SimpleLspClientLifecycle | undefined): void {
        this.client = client;
        if (client) {
            this.log('Client lifecycle attached.');
        } else {
            this.log('Client lifecycle detached.');
        }
    }

    public async bootstrapClient(resolveFrom?: string): Promise<SimpleLspOperationResult> {
        if (!this.bootstrapHook) {
            return this.fail('Client bootstrap hook is not registered.');
        }

        const server = this.resolveServerCommand(resolveFrom);
        const configuration = this.configuration;
        const request: SimpleLspBootstrapRequest = {
            context: this.context,
            configuration,
            initializationOptions: buildSimpleLspInitializationOptions(configuration, server.usingWasm),
            clientOptions: buildSimpleLspClientOptions(configuration, server.usingWasm),
            server,
        };

        try {
            this.log('Bootstrapping LSP client...');
            const client = await this.bootstrapHook(request);
            if (!client) {
                this.client = undefined;
                return this.fail('Bootstrap hook returned no client lifecycle.');
            }

            this.client = client;
            if (client.start) {
                await client.start();
            }

            this.log('LSP client bootstrap completed.');
            return {
                ok: true,
                message: 'LSP client bootstrap completed.',
            };
        } catch (error) {
            return this.fail('Failed to bootstrap LSP client.', error);
        }
    }

    public async restartClient(): Promise<SimpleLspOperationResult> {
        if (!this.client) {
            return this.fail('No client lifecycle is attached.');
        }

        try {
            if (this.client.restart) {
                await this.client.restart();
                this.log('Attached LSP client restarted.');
                return {
                    ok: true,
                    message: 'Attached LSP client restarted.',
                };
            }

            if (this.client.stop) {
                await this.client.stop();
                this.log('Attached LSP client stopped before restart fallback.');
            }

            return this.fail('Attached client does not expose a restart method.');
        } catch (error) {
            return this.fail('Failed to restart attached LSP client.', error);
        }
    }

    public async dispose(): Promise<void> {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        try {
            await this.client?.dispose?.();
        } finally {
            this.outputChannel.dispose();
        }
    }

    private log(message: string): void {
        this.outputChannel.info(message);
    }

    private fail(message: string, error?: unknown): SimpleLspOperationResult {
        const detail = error instanceof Error
            ? error.stack ?? error.message
            : typeof error === 'string'
                ? error
                : error === undefined
                    ? undefined
                    : String(error);
        const suffix = detail ? `: ${detail}` : '';
        this.outputChannel.warn(`${message}${suffix}`);
        return {
            ok: false,
            message,
            detail,
        };
    }
}

export function createSimpleLspCompatibilitySurface(
    context: vscode.ExtensionContext,
): SimpleLspCompatibilitySurface {
    return new SimpleLspCompatibilitySurface(context);
}
