/**
 * Resolves image paths from img{} blocks to webview-safe URIs.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

/**
 * Parse the content of an img{} block.
 * Supports: img{"path.png"} or img{path.png}
 */
export function parseImageContent(content: string): { path: string; width?: number; height?: number } | null {
    // Strip surrounding quotes if present
    let imgPath = content.trim();
    if ((imgPath.startsWith('"') && imgPath.endsWith('"')) ||
        (imgPath.startsWith("'") && imgPath.endsWith("'"))) {
        imgPath = imgPath.slice(1, -1);
    }

    if (!imgPath) return null;

    return { path: imgPath };
}

function isPathInside(candidate: string, root: string): boolean {
    const relative = path.relative(root, candidate);
    return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolveContainedFile(root: string, imagePath: string): vscode.Uri | undefined {
    const rootPath = path.resolve(root);
    const candidate = path.resolve(rootPath, imagePath);
    if (!isPathInside(candidate, rootPath) || !fs.existsSync(candidate)) {
        return undefined;
    }
    return vscode.Uri.file(candidate);
}

/**
 * Resolve an image path relative to the document, and convert to a webview URI.
 */
export function resolveImageUri(
    imagePath: string,
    documentUri: vscode.Uri,
    webview: vscode.Webview,
): string | null {
    if (documentUri.scheme !== 'file' || !imagePath.trim()) {
        return null;
    }

    const docDir = path.dirname(documentUri.fsPath);
    const resolved = resolveContainedFile(docDir, imagePath);
    if (resolved) {
        return webview.asWebviewUri(resolved).toString();
    }

    for (const folder of vscode.workspace.workspaceFolders ?? []) {
        if (folder.uri.scheme !== 'file') {
            continue;
        }
        const wsResolved = resolveContainedFile(folder.uri.fsPath, imagePath);
        if (wsResolved) {
            return webview.asWebviewUri(wsResolved).toString();
        }
    }

    return null;
}
