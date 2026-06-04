import * as vscode from 'vscode';
export declare function uriToWasiPath(uri: vscode.Uri): string;
export declare function wasiPathToUri(wasiPath: string): vscode.Uri | undefined;
export declare function convertDocumentUri(uri: vscode.Uri, isWasm: boolean): string;
export declare function convertLspUri(lspUri: string, isWasm: boolean): vscode.Uri;
export declare function getWasiPreopens(): Array<{
    host: string;
    wasi: string;
}>;
