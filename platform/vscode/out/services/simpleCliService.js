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
exports.SimpleCliService = exports.CLI_OUTPUT_LIMIT_BYTES = void 0;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
exports.CLI_OUTPUT_LIMIT_BYTES = 64 * 1024;
const CLI_OUTPUT_TRUNCATION_NOTICE = '\n[output truncated]';
function collectSearchRoots(fileOrDir) {
    if (!fileOrDir) {
        return [];
    }
    const roots = [];
    let current = fs.existsSync(fileOrDir) && fs.statSync(fileOrDir).isDirectory()
        ? fileOrDir
        : path.dirname(fileOrDir);
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
function appendLimited(current, chunk) {
    if (current.includes(CLI_OUTPUT_TRUNCATION_NOTICE)) {
        return current;
    }
    if (current.length + chunk.length < exports.CLI_OUTPUT_LIMIT_BYTES) {
        return current + chunk;
    }
    const available = Math.max(0, exports.CLI_OUTPUT_LIMIT_BYTES - current.length);
    return `${current}${chunk.slice(0, available)}${CLI_OUTPUT_TRUNCATION_NOTICE}`;
}
class SimpleCliService {
    constructor(services) {
        this.services = services;
    }
    resolveSimpleCommand(resolveFrom) {
        const cliConfig = vscode.workspace.getConfiguration('simple.cli');
        const explicitPath = cliConfig.get('path', '').trim();
        if (explicitPath) {
            return explicitPath;
        }
        const legacyPath = vscode.workspace.getConfiguration('simple').get('lsp.serverPath', '').trim();
        if (legacyPath && isSimpleCliCommand(legacyPath)) {
            return legacyPath;
        }
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceRoot) {
            for (const candidate of [
                path.join(workspaceRoot, 'bin', 'simple'),
                path.join(workspaceRoot, '..', 'bin', 'simple'),
                path.join(workspaceRoot, '..', '..', 'bin', 'simple'),
            ]) {
                if (fs.existsSync(candidate)) {
                    return candidate;
                }
            }
        }
        for (const root of collectSearchRoots(resolveFrom)) {
            const candidate = path.join(root, 'bin', 'simple');
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }
        return 'simple';
    }
    async run(args, options) {
        const command = this.resolveSimpleCommand(options?.resolveFrom);
        this.services.setStatus('cli', {
            health: 'starting',
            source: 'native',
            message: `${command} ${args.join(' ')}`,
        });
        return await new Promise((resolve, reject) => {
            const child = (0, child_process_1.spawn)(command, args, {
                cwd: options?.cwd ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
                env: process.env,
                shell: false,
            });
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (chunk) => {
                stdout = appendLimited(stdout, chunk.toString());
            });
            child.stderr.on('data', (chunk) => {
                stderr = appendLimited(stderr, chunk.toString());
            });
            child.on('error', (error) => {
                const detail = error instanceof Error ? error.message : String(error);
                this.services.markDegraded('cli', 'Simple CLI unavailable', 'native', detail);
                reject(error);
            });
            options?.token?.onCancellationRequested(() => {
                child.kill();
            });
            child.on('close', (exitCode) => {
                const combined = `${stdout}${stderr ? `\n${stderr}` : ''}`.trim();
                if ((exitCode ?? 1) === 0) {
                    this.services.markReady('cli', `Command succeeded: ${command} ${args.join(' ')}`);
                }
                else {
                    this.services.markDegraded('cli', `Command exited with ${exitCode ?? 1}`, 'native', combined || `${command} ${args.join(' ')}`);
                }
                resolve({
                    exitCode: exitCode ?? 1,
                    stdout,
                    stderr,
                    combined,
                });
            });
        });
    }
}
exports.SimpleCliService = SimpleCliService;
function isSimpleCliCommand(command) {
    const base = path.basename(command).toLowerCase();
    return base === 'simple' || base === 'simple.exe';
}
//# sourceMappingURL=simpleCliService.js.map