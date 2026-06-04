import * as vscode from 'vscode';
import type { ServerOptions } from 'vscode-languageclient/node';
export interface WasmLspOptions {
    wasmPath: string;
    context: vscode.ExtensionContext;
    outputChannel: vscode.OutputChannel;
}
export interface WasmServerOptionsResult {
    serverOptions?: ServerOptions;
    detail?: string;
}
export declare function createWasmServerOptions(options: WasmLspOptions): Promise<WasmServerOptionsResult>;
export declare function isWasmLspAvailable(context: vscode.ExtensionContext, wasmPath: string): Promise<boolean>;
