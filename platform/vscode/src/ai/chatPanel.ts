/**
 * Simple AI chat panel.
 */

import * as vscode from 'vscode';
import { SimpleAiLanguageModelClient } from './languageModelClient';
import { SimpleAiChatMessage } from './types';

type SimpleAiPanelMessage =
    | { type: 'ready' }
    | { type: 'chat'; text: string }
    | { type: 'clear' }
    | { type: 'explainSelection' }
    | { type: 'reviewSelection' }
    | { type: 'generateCode' };

export class SimpleAiChatPanel {
    public static currentPanel: SimpleAiChatPanel | undefined;

    private readonly disposables: vscode.Disposable[] = [];
    private readonly chatHistory: SimpleAiChatMessage[] = [];

    private constructor(
        private readonly panel: vscode.WebviewPanel,
        private readonly extensionUri: vscode.Uri,
        private readonly lmClient: SimpleAiLanguageModelClient,
    ) {
        this.panel.webview.html = this.getHtmlContent();
        this.panel.webview.onDidReceiveMessage((message: SimpleAiPanelMessage) => this.handleMessage(message), null, this.disposables);
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    }

    public static show(extensionUri: vscode.Uri, lmClient: SimpleAiLanguageModelClient): void {
        const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.Beside;
        if (SimpleAiChatPanel.currentPanel) {
            SimpleAiChatPanel.currentPanel.panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'simpleAiChatPanel',
            'Simple Assistant',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri],
            },
        );

        SimpleAiChatPanel.currentPanel = new SimpleAiChatPanel(panel, extensionUri, lmClient);
    }

    private async handleMessage(message: SimpleAiPanelMessage): Promise<void> {
        switch (message.type) {
            case 'chat':
                await this.handleChatMessage(message.text);
                break;
            case 'clear':
                this.chatHistory.length = 0;
                this.sendMessage({ type: 'cleared' });
                break;
            case 'explainSelection':
                await this.handleSelectionAction((code, language) => this.lmClient.explain(code, language), 'Explanation of selected code');
                break;
            case 'reviewSelection':
                await this.handleSelectionAction((code, language) => this.lmClient.review(code, language), 'Code Review');
                break;
            case 'generateCode':
                await this.handleGenerateCode();
                break;
            case 'ready':
                this.sendMessage({
                    type: 'init',
                    modelsAvailable: this.lmClient.isAvailable(),
                    models: this.lmClient.getAvailableModels(),
                });
                break;
        }
    }

    private async handleChatMessage(text: string): Promise<void> {
        if (!text.trim()) {
            return;
        }

        const userMessage: SimpleAiChatMessage = { role: 'user', content: text };
        this.chatHistory.push(userMessage);
        this.sendMessage({ type: 'userMessage', text });
        this.sendMessage({ type: 'thinking', value: true });

        try {
            const response = await this.lmClient.chat(this.chatHistory);
            this.chatHistory.push({ role: 'assistant', content: response });
            this.sendMessage({ type: 'assistantMessage', text: response });
        } catch (error: any) {
            this.sendMessage({
                type: 'error',
                text: error?.message || 'An error occurred while communicating with the language model.',
            });
        } finally {
            this.sendMessage({ type: 'thinking', value: false });
        }
    }

    private async handleSelectionAction(
        action: (code: string, language: string) => Promise<string>,
        title: string,
    ): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            this.sendMessage({ type: 'error', text: 'No active editor' });
            return;
        }

        const code = editor.document.getText(editor.selection);
        if (!code.trim()) {
            this.sendMessage({ type: 'error', text: 'No code selected' });
            return;
        }

        this.sendMessage({ type: 'thinking', value: true });
        try {
            const response = await action(code, editor.document.languageId);
            this.sendMessage({
                type: 'assistantMessage',
                text: `**${title}:**\n\n${response}`,
            });
        } catch (error: any) {
            this.sendMessage({ type: 'error', text: error?.message || String(error) });
        } finally {
            this.sendMessage({ type: 'thinking', value: false });
        }
    }

    private async handleGenerateCode(): Promise<void> {
        const description = await vscode.window.showInputBox({
            prompt: 'Describe the code you want to generate',
            placeHolder: 'e.g. "a function that sorts a list of numbers"',
        });

        if (!description) {
            return;
        }

        this.sendMessage({ type: 'thinking', value: true });
        try {
            const generated = await this.lmClient.generate(description, vscode.window.activeTextEditor?.document.languageId ?? 'simple');
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                await editor.edit((editBuilder) => {
                    editBuilder.insert(editor.selection.active, generated);
                });
            }
            this.sendMessage({ type: 'assistantMessage', text: generated });
        } catch (error: any) {
            this.sendMessage({ type: 'error', text: error?.message || String(error) });
        } finally {
            this.sendMessage({ type: 'thinking', value: false });
        }
    }

    private sendMessage(message: unknown): void {
        void this.panel.webview.postMessage(message);
    }

    private getHtmlContent(): string {
        const nonce = this.getNonce();
        const csp = [
            "default-src 'none'",
            `img-src ${this.panel.webview.cspSource} https: data:`,
            `style-src ${this.panel.webview.cspSource} 'unsafe-inline'`,
            `script-src 'nonce-${nonce}'`,
        ].join('; ');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Simple Assistant</title>
    <style>
        :root {
            color-scheme: var(--vscode-color-scheme, dark);
        }

        body {
            margin: 0;
            height: 100vh;
            display: flex;
            flex-direction: column;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background: linear-gradient(180deg, var(--vscode-editor-background), var(--vscode-sideBar-background));
        }

        #header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 12px 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background: color-mix(in srgb, var(--vscode-sideBar-background) 88%, transparent);
            backdrop-filter: blur(10px);
        }

        #header h2 {
            margin: 0;
            font-size: 13px;
            font-weight: 600;
        }

        #modelBadge {
            font-size: 11px;
            padding: 4px 8px;
            border-radius: 999px;
            border: 1px solid var(--vscode-panel-border);
            color: var(--vscode-descriptionForeground);
        }

        #chatContainer {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
        }

        .message {
            margin-bottom: 14px;
            padding: 12px 14px;
            border-radius: 8px;
            border: 1px solid transparent;
            line-height: 1.45;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
        }

        .message.user {
            background: var(--vscode-input-background);
            border-color: var(--vscode-input-border);
        }

        .message.assistant {
            background: color-mix(in srgb, var(--vscode-editor-inactiveSelectionBackground) 70%, transparent);
            border-color: color-mix(in srgb, var(--vscode-focusBorder) 30%, transparent);
        }

        .message.error {
            background: var(--vscode-inputValidation-errorBackground);
            border-color: var(--vscode-inputValidation-errorBorder);
            color: var(--vscode-errorForeground);
        }

        .message pre {
            margin: 10px 0 0;
            padding: 10px;
            overflow-x: auto;
            background: var(--vscode-textBlockQuote-background);
            border-radius: 6px;
        }

        .message code {
            font-family: var(--vscode-editor-font-family);
            font-size: 0.95em;
        }

        #thinking {
            display: none;
            padding: 0 16px 10px;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }

        #thinking.visible {
            display: block;
        }

        #inputContainer {
            padding: 14px 16px 16px;
            border-top: 1px solid var(--vscode-panel-border);
            background: color-mix(in srgb, var(--vscode-sideBar-background) 88%, transparent);
        }

        #inputBox {
            width: 100%;
            min-height: 72px;
            resize: vertical;
            box-sizing: border-box;
            padding: 10px 12px;
            border-radius: 8px;
            border: 1px solid var(--vscode-input-border);
            color: var(--vscode-input-foreground);
            background: var(--vscode-input-background);
            font: inherit;
        }

        #inputBox:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: 1px;
        }

        #actionButtons {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 10px;
        }

        button {
            border: 0;
            border-radius: 999px;
            padding: 7px 12px;
            cursor: pointer;
            font: inherit;
            color: var(--vscode-button-foreground);
            background: var(--vscode-button-background);
        }

        button:hover {
            background: var(--vscode-button-hoverBackground);
        }

        button.secondary {
            color: var(--vscode-button-secondaryForeground);
            background: var(--vscode-button-secondaryBackground);
        }

        button.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
    </style>
</head>
<body>
    <div id="header">
        <h2>Simple Assistant</h2>
        <div id="modelBadge">Loading models...</div>
    </div>

    <div id="chatContainer"></div>
    <div id="thinking">Thinking...</div>

    <div id="inputContainer">
        <textarea id="inputBox" placeholder="Ask about Simple code, request an explanation, or generate a snippet..."></textarea>
        <div id="actionButtons">
            <button id="sendBtn">Send</button>
            <button id="clearBtn" class="secondary">Clear</button>
            <button id="explainBtn" class="secondary">Explain Selection</button>
            <button id="reviewBtn" class="secondary">Review Selection</button>
            <button id="generateBtn" class="secondary">Generate Code</button>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const chatContainer = document.getElementById('chatContainer');
        const inputBox = document.getElementById('inputBox');
        const thinkingIndicator = document.getElementById('thinking');
        const modelBadge = document.getElementById('modelBadge');

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'init':
                    if (message.modelsAvailable && message.models && message.models.length) {
                        modelBadge.textContent = message.models[0];
                    } else {
                        modelBadge.textContent = 'No language model available';
                        addMessage('error', 'No language models available. Install GitHub Copilot or another compatible extension.');
                    }
                    break;
                case 'userMessage':
                    addMessage('user', message.text);
                    break;
                case 'assistantMessage':
                    addMessage('assistant', message.text);
                    break;
                case 'error':
                    addMessage('error', message.text);
                    break;
                case 'thinking':
                    thinkingIndicator.classList.toggle('visible', !!message.value);
                    break;
                case 'cleared':
                    chatContainer.innerHTML = '';
                    break;
            }
        });

        function sendChatMessage() {
            const text = inputBox.value.trim();
            if (!text) {
                return;
            }
            vscode.postMessage({ type: 'chat', text });
            inputBox.value = '';
        }

        function escapeHtml(text) {
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function renderMarkdown(text) {
            const tick = String.fromCharCode(96);
            const codeBlockRegex = new RegExp(tick + tick + tick + '([\\\\w-]+)?\\\\n([\\\\s\\\\S]*?)' + tick + tick + tick, 'g');
            const inlineCodeRegex = new RegExp(tick + '([^' + tick + ']+)' + tick, 'g');
            // Stash code spans behind sentinel tokens so the inline/bold/newline
            // passes below cannot corrupt code content (e.g. ** turned into <strong>,
            // or code newlines turned into <br> inside <pre>).
            const placeholders = [];
            const stash = (value) => {
                const token = '\\uE000' + placeholders.length + '\\uE000';
                placeholders.push(value);
                return token;
            };
            let html = escapeHtml(text);
            html = html.replace(codeBlockRegex, (_, lang, code) => stash('<pre><code>' + code + '</code></pre>'));
            html = html.replace(inlineCodeRegex, (_, code) => stash('<code>' + code + '</code>'));
            html = html.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
            html = html.replace(/\\n/g, '<br>');
            placeholders.forEach((value, index) => {
                html = html.replace('\\uE000' + index + '\\uE000', () => value);
            });
            return html;
        }

        function addMessage(type, text) {
            const el = document.createElement('div');
            el.className = 'message ' + type;
            el.innerHTML = renderMarkdown(text);
            chatContainer.appendChild(el);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        document.getElementById('sendBtn').addEventListener('click', sendChatMessage);
        document.getElementById('clearBtn').addEventListener('click', () => vscode.postMessage({ type: 'clear' }));
        document.getElementById('explainBtn').addEventListener('click', () => vscode.postMessage({ type: 'explainSelection' }));
        document.getElementById('reviewBtn').addEventListener('click', () => vscode.postMessage({ type: 'reviewSelection' }));
        document.getElementById('generateBtn').addEventListener('click', () => vscode.postMessage({ type: 'generateCode' }));

        inputBox.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                sendChatMessage();
            }
        });

        vscode.postMessage({ type: 'ready' });
    </script>
</body>
</html>`;
    }

    private getNonce(): string {
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let text = '';
        for (let i = 0; i < 32; i += 1) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    public dispose(): void {
        SimpleAiChatPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            disposable?.dispose();
        }
    }
}
