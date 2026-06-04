import * as vscode from 'vscode';
import { ExtensionHostServices } from './extensionHostServices';
export declare const CLI_OUTPUT_LIMIT_BYTES: number;
export interface CliRunResult {
    exitCode: number;
    stdout: string;
    stderr: string;
    combined: string;
}
export declare class SimpleCliService {
    private readonly services;
    constructor(services: ExtensionHostServices);
    resolveSimpleCommand(resolveFrom?: string): string;
    run(args: string[], options?: {
        cwd?: string;
        token?: vscode.CancellationToken;
        resolveFrom?: string;
    }): Promise<CliRunResult>;
}
