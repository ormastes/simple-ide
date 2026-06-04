import * as vscode from 'vscode';

const WASI_WORKSPACE_ROOT = '/workspace';

export function uriToWasiPath(uri: vscode.Uri): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
        const relativePath = vscode.workspace.asRelativePath(uri, false);
        if (relativePath !== uri.toString()) {
            return `${WASI_WORKSPACE_ROOT}/${relativePath}`;
        }
    }
    const segments = uri.path.split('/');
    const fileName = segments[segments.length - 1];
    return `${WASI_WORKSPACE_ROOT}/${fileName}`;
}

export function wasiPathToUri(wasiPath: string): vscode.Uri | undefined {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        return undefined;
    }
    let relativePath = wasiPath;
    if (relativePath.startsWith(`${WASI_WORKSPACE_ROOT}/`)) {
        relativePath = relativePath.substring(WASI_WORKSPACE_ROOT.length + 1);
    } else if (relativePath.startsWith(WASI_WORKSPACE_ROOT)) {
        relativePath = relativePath.substring(WASI_WORKSPACE_ROOT.length);
    }
    return vscode.Uri.joinPath(workspaceFolder.uri, relativePath);
}

export function convertDocumentUri(uri: vscode.Uri, isWasm: boolean): string {
    return isWasm ? uriToWasiPath(uri) : uri.toString();
}

export function convertLspUri(lspUri: string, isWasm: boolean): vscode.Uri {
    if (isWasm && lspUri.startsWith('/')) {
        const converted = wasiPathToUri(lspUri);
        if (converted) {
            return converted;
        }
    }
    return vscode.Uri.parse(lspUri);
}

export function getWasiPreopens(): Array<{ host: string; wasi: string }> {
    const preopens: Array<{ host: string; wasi: string }> = [];
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
        preopens.push({
            host: workspaceFolder.uri.fsPath,
            wasi: WASI_WORKSPACE_ROOT,
        });
    }
    return preopens;
}
