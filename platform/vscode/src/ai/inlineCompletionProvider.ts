/**
 * Simple AI inline completion provider.
 */

import * as vscode from 'vscode';
import { SimpleAiLanguageModelClient } from './languageModelClient';
import { SimpleAiCompletionContext } from './types';

export class SimpleAiInlineCompletionProvider implements vscode.InlineCompletionItemProvider {
    private enabled = true;
    private lastRequestAt = 0;
    private readonly debounceMs = 300;
    private readonly minCharsForCompletion = 10;

    constructor(private readonly lmClient: SimpleAiLanguageModelClient) {}

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    async provideInlineCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _context: vscode.InlineCompletionContext,
        token: vscode.CancellationToken,
    ): Promise<vscode.InlineCompletionItem[] | vscode.InlineCompletionList | undefined> {
        if (!this.enabled || !this.lmClient.isAvailable()) {
            return undefined;
        }

        if (document.languageId !== 'simple') {
            return undefined;
        }

        if (token.isCancellationRequested) {
            return undefined;
        }

        const now = Date.now();
        if (now - this.lastRequestAt < this.debounceMs) {
            return undefined;
        }
        this.lastRequestAt = now;

        const line = document.lineAt(position.line);
        if (position.character !== line.text.length || line.text.trim().length < this.minCharsForCompletion) {
            return undefined;
        }

        if (position.character === 0) {
            return undefined;
        }

        const previousCharacter = document.getText(new vscode.Range(position.translate(0, -1), position));
        if (['.', '(', '[', '{', ','].includes(previousCharacter)) {
            return undefined;
        }

        try {
            const completionContext: SimpleAiCompletionContext = {
                code: document.getText(),
                position,
                language: document.languageId,
                fileContext: this.getFileContext(document),
            };

            const completion = await this.lmClient.complete(completionContext, token);
            const cleanedCompletion = this.cleanCompletion(completion);
            if (!cleanedCompletion) {
                return undefined;
            }

            const item = new vscode.InlineCompletionItem(cleanedCompletion, new vscode.Range(position, position));
            item.command = {
                command: 'simple.ai.completionAccepted',
                title: 'AI Completion Accepted',
            };
            return [item];
        } catch (error) {
            console.error('Simple AI inline completion error:', error);
            return undefined;
        }
    }

    private getFileContext(document: vscode.TextDocument): string {
        const text = document.getText();
        const lines = text.split('\n');

        const imports = lines
            .slice(0, Math.min(20, lines.length))
            .filter((line) => line.trim().startsWith('import') || line.trim().startsWith('from'))
            .join('\n');

        const signatures = lines
            .filter((line) => {
                const trimmed = line.trim();
                return (
                    trimmed.startsWith('fn ') ||
                    trimmed.startsWith('class ') ||
                    trimmed.startsWith('trait ') ||
                    trimmed.startsWith('enum ')
                );
            })
            .join('\n');

        return `${imports}\n\n${signatures}`.trim();
    }

    private cleanCompletion(completion: string): string {
        let cleaned = completion;
        cleaned = cleaned.replace(/```[\w]*\n/g, '');
        cleaned = cleaned.replace(/```/g, '');

        const lines = cleaned.split('\n');
        const codeLines = lines.filter((line) => {
            const trimmed = line.trim();
            return (
                !trimmed.startsWith('#') &&
                !trimmed.startsWith('//') &&
                !trimmed.toLowerCase().includes('explanation') &&
                !trimmed.toLowerCase().includes('here is') &&
                !trimmed.toLowerCase().includes('this code')
            );
        });

        cleaned = codeLines.join('\n').trim();
        if (cleaned.split('\n').length > 5) {
            cleaned = cleaned.split('\n').slice(0, 5).join('\n');
        }
        return cleaned;
    }
}
