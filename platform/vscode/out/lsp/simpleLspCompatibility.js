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
exports.SimpleLspCompatibilitySurface = void 0;
exports.createSimpleLspCompatibilitySurface = createSimpleLspCompatibilitySurface;
const vscode = __importStar(require("vscode"));
const simpleLspServerResolver_1 = require("../services/simpleLspServerResolver");
class SimpleLspCompatibilitySurface {
    constructor(context) {
        this.context = context;
        this.documentSelector = (0, simpleLspServerResolver_1.createSimpleLspDocumentSelector)();
        this.disposed = false;
        this.outputChannel = vscode.window.createOutputChannel('Simple LSP Compatibility', { log: true });
        this.log('Compatibility surface created.');
    }
    get configuration() {
        return (0, simpleLspServerResolver_1.readSimpleLspConfiguration)();
    }
    get initializationOptions() {
        return (0, simpleLspServerResolver_1.buildSimpleLspInitializationOptions)(this.configuration);
    }
    get clientOptions() {
        return (0, simpleLspServerResolver_1.buildSimpleLspClientOptions)(this.configuration);
    }
    showOutputChannel() {
        this.outputChannel.show(true);
    }
    resolveServerCommand(resolveFrom) {
        const server = (0, simpleLspServerResolver_1.resolveSimpleLspServerCommand)({
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
    getDocumentSelector() {
        return this.documentSelector;
    }
    setClientBootstrap(hook) {
        this.bootstrapHook = hook;
        this.log(hook ? 'Client bootstrap hook registered.' : 'Client bootstrap hook cleared.');
    }
    attachClient(client) {
        this.client = client;
        if (client) {
            this.log('Client lifecycle attached.');
        }
        else {
            this.log('Client lifecycle detached.');
        }
    }
    async bootstrapClient(resolveFrom) {
        if (!this.bootstrapHook) {
            return this.fail('Client bootstrap hook is not registered.');
        }
        const server = this.resolveServerCommand(resolveFrom);
        const configuration = this.configuration;
        const request = {
            context: this.context,
            configuration,
            initializationOptions: (0, simpleLspServerResolver_1.buildSimpleLspInitializationOptions)(configuration, server.usingWasm),
            clientOptions: (0, simpleLspServerResolver_1.buildSimpleLspClientOptions)(configuration, server.usingWasm),
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
        }
        catch (error) {
            return this.fail('Failed to bootstrap LSP client.', error);
        }
    }
    async restartClient() {
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
        }
        catch (error) {
            return this.fail('Failed to restart attached LSP client.', error);
        }
    }
    async dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        try {
            await this.client?.dispose?.();
        }
        finally {
            this.outputChannel.dispose();
        }
    }
    log(message) {
        this.outputChannel.info(message);
    }
    fail(message, error) {
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
exports.SimpleLspCompatibilitySurface = SimpleLspCompatibilitySurface;
function createSimpleLspCompatibilitySurface(context) {
    return new SimpleLspCompatibilitySurface(context);
}
//# sourceMappingURL=simpleLspCompatibility.js.map