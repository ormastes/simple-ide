import * as vscode from 'vscode';
import { SimpleAiChatPanel } from './chatPanel';
import { SimpleAiLanguageModelClient } from './languageModelClient';
import { SimpleAiInlineCompletionProvider } from './inlineCompletionProvider';
import {
    SIMPLE_AI_COMMANDS,
    SimpleAiRegistrationHandle,
    SimpleAiRegistrationOptions,
} from './types';

export { SIMPLE_AI_COMMANDS } from './types';
export { SimpleAiChatPanel } from './chatPanel';
export { SimpleAiLanguageModelClient } from './languageModelClient';
export { SimpleAiInlineCompletionProvider } from './inlineCompletionProvider';
export type { SimpleAiRegistrationHandle, SimpleAiRegistrationOptions } from './types';

export async function registerSimpleAiSlice(
    context: vscode.ExtensionContext,
    options: SimpleAiRegistrationOptions,
): Promise<SimpleAiRegistrationHandle> {
    const outputChannel = options.outputChannel ?? vscode.window.createOutputChannel('Simple Assistant');
    context.subscriptions.push(outputChannel);

    const client = new SimpleAiLanguageModelClient(outputChannel);
    await client.initialize();

    const inlineCompletionProvider = new SimpleAiInlineCompletionProvider(client);
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    statusBarItem.command = SIMPLE_AI_COMMANDS.toggleInlineCompletions;
    context.subscriptions.push(statusBarItem);

    const updateStatusBar = () => {
        const available = client.isAvailable();
        const enabled = inlineCompletionProvider.isEnabled();

        if (!available) {
            statusBarItem.text = '$(warning) Simple AI';
            statusBarItem.tooltip = 'Simple AI unavailable (install a compatible language model extension)';
            statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        } else if (enabled) {
            statusBarItem.text = '$(sparkle) Simple AI';
            statusBarItem.tooltip = 'Simple AI inline completions enabled';
            statusBarItem.backgroundColor = undefined;
        } else {
            statusBarItem.text = '$(circle-slash) Simple AI';
            statusBarItem.tooltip = 'Simple AI inline completions disabled';
            statusBarItem.backgroundColor = undefined;
        }
        statusBarItem.show();
    };

    const openChatDisposable = options.enableChatPanel === false
        ? undefined
        : vscode.commands.registerCommand(SIMPLE_AI_COMMANDS.openChat, () => {
            SimpleAiChatPanel.show(options.extensionUri, client);
        });

    const toggleInlineCompletionsDisposable = vscode.commands.registerCommand(
        SIMPLE_AI_COMMANDS.toggleInlineCompletions,
        () => {
            if (!inlineCompletionProvider) {
                void vscode.window.showErrorMessage('Simple AI inline completions are not available');
                return;
            }

            const newState = !inlineCompletionProvider.isEnabled();
            inlineCompletionProvider.setEnabled(newState);
            updateStatusBar();
            void vscode.window.showInformationMessage(
                newState ? 'Simple AI inline completions enabled' : 'Simple AI inline completions disabled',
            );
        },
    );

    const explainCodeDisposable = vscode.commands.registerCommand(SIMPLE_AI_COMMANDS.explainCode, async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            void vscode.window.showErrorMessage('No active editor');
            return;
        }
        const selection = editor.selection;
        const code = editor.document.getText(selection);
        if (!code.trim()) {
            void vscode.window.showErrorMessage('No code selected');
            return;
        }

        try {
            const explanation = await client.explain(code, editor.document.languageId);
            const doc = await vscode.workspace.openTextDocument({
                content: `# Code Explanation\n\n${explanation}`,
                language: 'markdown',
            });
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
        } catch (error: any) {
            void vscode.window.showErrorMessage(`Failed to explain code: ${error?.message || String(error)}`);
        }
    });

    const reviewCodeDisposable = vscode.commands.registerCommand(SIMPLE_AI_COMMANDS.reviewCode, async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            void vscode.window.showErrorMessage('No active editor');
            return;
        }
        const selection = editor.selection;
        const code = editor.document.getText(selection);
        if (!code.trim()) {
            void vscode.window.showErrorMessage('No code selected');
            return;
        }

        try {
            const review = await client.review(code, editor.document.languageId);
            const doc = await vscode.workspace.openTextDocument({
                content: `# Code Review\n\n${review}`,
                language: 'markdown',
            });
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
        } catch (error: any) {
            void vscode.window.showErrorMessage(`Failed to review code: ${error?.message || String(error)}`);
        }
    });

    const generateCodeDisposable = vscode.commands.registerCommand(SIMPLE_AI_COMMANDS.generateCode, async () => {
        const description = await vscode.window.showInputBox({
            prompt: 'Describe the code you want to generate',
            placeHolder: 'e.g. "a function that sorts a list of numbers"',
        });
        if (!description) {
            return;
        }

        try {
            const generated = await client.generate(description, vscode.window.activeTextEditor?.document.languageId ?? 'simple');
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                await editor.edit((editBuilder) => {
                    editBuilder.insert(editor.selection.active, generated);
                });
            }
        } catch (error: any) {
            void vscode.window.showErrorMessage(`Failed to generate code: ${error?.message || String(error)}`);
        }
    });

    const completionAcceptedDisposable = vscode.commands.registerCommand(SIMPLE_AI_COMMANDS.completionAccepted, () => {
        outputChannel.appendLine(`${new Date().toISOString()} [INFO] Simple AI completion accepted`);
    });

    const inlineCompletionRegistration = options.enableInlineCompletions === false
        ? undefined
        : vscode.languages.registerInlineCompletionItemProvider(
            options.documentSelector ?? [
                { scheme: 'file', language: 'simple' },
                { scheme: 'untitled', language: 'simple' },
            ],
            inlineCompletionProvider,
        );

    const disposables = [
        openChatDisposable,
        toggleInlineCompletionsDisposable,
        explainCodeDisposable,
        reviewCodeDisposable,
        generateCodeDisposable,
        completionAcceptedDisposable,
        inlineCompletionRegistration,
        statusBarItem,
    ].filter((item): item is vscode.Disposable => Boolean(item));

    disposables.forEach((disposable) => context.subscriptions.push(disposable));
    updateStatusBar();

    return {
        outputChannel,
        statusBarItem,
        inlineCompletionProvider,
        client,
        dispose(): void {
            while (disposables.length) {
                disposables.pop()?.dispose();
            }
        },
    };
}

export const activateSimpleAiSlice = registerSimpleAiSlice;
