/**
 * Resolves image paths from img{} blocks to webview-safe URIs.
 */
import * as vscode from 'vscode';
/**
 * Parse the content of an img{} block.
 * Supports: img{"path.png"} or img{path.png}
 */
export declare function parseImageContent(content: string): {
    path: string;
    width?: number;
    height?: number;
} | null;
/**
 * Resolve an image path relative to the document, and convert to a webview URI.
 */
export declare function resolveImageUri(imagePath: string, documentUri: vscode.Uri, webview: vscode.Webview): string | null;
