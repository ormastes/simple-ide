/**
 * Simple AI inline completion provider.
 */
import * as vscode from 'vscode';
import { SimpleAiLanguageModelClient } from './languageModelClient';
export declare class SimpleAiInlineCompletionProvider implements vscode.InlineCompletionItemProvider {
    private readonly lmClient;
    private enabled;
    private lastRequestAt;
    private readonly debounceMs;
    private readonly minCharsForCompletion;
    constructor(lmClient: SimpleAiLanguageModelClient);
    setEnabled(enabled: boolean): void;
    isEnabled(): boolean;
    provideInlineCompletionItems(document: vscode.TextDocument, position: vscode.Position, _context: vscode.InlineCompletionContext, token: vscode.CancellationToken): Promise<vscode.InlineCompletionItem[] | vscode.InlineCompletionList | undefined>;
    private getFileContext;
    private cleanCompletion;
}
