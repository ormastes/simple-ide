/**
 * Simple AI chat panel.
 */
import * as vscode from 'vscode';
import { SimpleAiLanguageModelClient } from './languageModelClient';
export declare class SimpleAiChatPanel {
    private readonly panel;
    private readonly extensionUri;
    private readonly lmClient;
    static currentPanel: SimpleAiChatPanel | undefined;
    private readonly disposables;
    private readonly chatHistory;
    private constructor();
    static show(extensionUri: vscode.Uri, lmClient: SimpleAiLanguageModelClient): void;
    private handleMessage;
    private handleChatMessage;
    private handleSelectionAction;
    private handleGenerateCode;
    private sendMessage;
    private getHtmlContent;
    private getNonce;
    dispose(): void;
}
