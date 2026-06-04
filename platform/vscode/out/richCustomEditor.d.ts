/**
 * Rich Custom Editor Provider for Simple language files.
 *
 * Provides a CodeMirror 6-based webview editor with:
 * - Variable line heights (math/images expand lines naturally)
 * - Cursor-aware view mode (non-cursor blocks render as widgets)
 * - Image embedding via img{} blocks
 * - Bi-directional sync with VSCode TextDocument
 */
import * as vscode from 'vscode';
import type { EditorMarkerState } from './testing/editorMarkers';
export declare class RichCustomEditorProvider implements vscode.CustomTextEditorProvider {
    private readonly extensionUri;
    private readonly onActiveDocument?;
    private readonly getMarkerState?;
    private readonly onDidChangeMarkers?;
    private readonly getTestStates?;
    private readonly onDidChangeTestStates?;
    static readonly viewType = "simple.richSourceEditor";
    constructor(extensionUri: vscode.Uri, onActiveDocument?: ((document: vscode.TextDocument) => void) | undefined, getMarkerState?: ((documentUri: vscode.Uri) => EditorMarkerState) | undefined, onDidChangeMarkers?: vscode.Event<vscode.Uri> | undefined, getTestStates?: ((documentUri: vscode.Uri) => ReadonlyMap<string, "idle" | "running" | "passed" | "failed" | "skipped">) | undefined, onDidChangeTestStates?: vscode.Event<vscode.Uri> | undefined);
    resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel, _token: vscode.CancellationToken): Promise<void>;
}
