import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ExtensionHostServices } from './extensionHostServices';

export const CLI_OUTPUT_LIMIT_BYTES = 64 * 1024;
const CLI_OUTPUT_TRUNCATION_NOTICE = '\n[output truncated]';

export interface CliRunResult {
    exitCode: number;
    stdout: string;
    stderr: string;
    combined: string;
}

function collectSearchRoots(fileOrDir?: string): string[] {
    if (!fileOrDir) {
        return [];
    }

    const roots: string[] = [];
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

function appendLimited(current: string, chunk: string): string {
    if (current.includes(CLI_OUTPUT_TRUNCATION_NOTICE)) {
        return current;
    }
    if (current.length + chunk.length < CLI_OUTPUT_LIMIT_BYTES) {
        return current + chunk;
    }
    const available = Math.max(0, CLI_OUTPUT_LIMIT_BYTES - current.length);
    return `${current}${chunk.slice(0, available)}${CLI_OUTPUT_TRUNCATION_NOTICE}`;
}

export class SimpleCliService {
    public constructor(private readonly services: ExtensionHostServices) {}

    public resolveSimpleCommand(resolveFrom?: string): string {
        const cliConfig = vscode.workspace.getConfiguration('simple.cli');
        const explicitPath = cliConfig.get<string>('path', '').trim();
        if (explicitPath) {
            return explicitPath;
        }

        const legacyPath = vscode.workspace.getConfiguration('simple').get<string>('lsp.serverPath', '').trim();
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

    public async run(args: string[], options?: { cwd?: string; token?: vscode.CancellationToken; resolveFrom?: string }): Promise<CliRunResult> {
        const command = this.resolveSimpleCommand(options?.resolveFrom);
        this.services.setStatus('cli', {
            health: 'starting',
            source: 'native',
            message: `${command} ${args.join(' ')}`,
        });

        return await new Promise<CliRunResult>((resolve, reject) => {
            const child = spawn(command, args, {
                cwd: options?.cwd ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
                env: process.env,
                shell: false,
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (chunk: Buffer | string) => {
                stdout = appendLimited(stdout, chunk.toString());
            });
            child.stderr.on('data', (chunk: Buffer | string) => {
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
                } else {
                    this.services.markDegraded(
                        'cli',
                        `Command exited with ${exitCode ?? 1}`,
                        'native',
                        combined || `${command} ${args.join(' ')}`,
                    );
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

function isSimpleCliCommand(command: string): boolean {
    const base = path.basename(command).toLowerCase();
    return base === 'simple' || base === 'simple.exe';
}
