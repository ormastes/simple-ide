"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activateSimpleAiSlice = exports.SimpleAiInlineCompletionProvider = exports.SimpleAiLanguageModelClient = exports.SimpleAiChatPanel = exports.SIMPLE_AI_COMMANDS = void 0;
exports.registerSimpleAiSlice = registerSimpleAiSlice;
const vscode = __importStar(require("vscode"));
const chatPanel_1 = require("./chatPanel");
const languageModelClient_1 = require("./languageModelClient");
const inlineCompletionProvider_1 = require("./inlineCompletionProvider");
const types_1 = require("./types");
var types_2 = require("./types");
Object.defineProperty(exports, "SIMPLE_AI_COMMANDS", { enumerable: true, get: function () { return types_2.SIMPLE_AI_COMMANDS; } });
var chatPanel_2 = require("./chatPanel");
Object.defineProperty(exports, "SimpleAiChatPanel", { enumerable: true, get: function () { return chatPanel_2.SimpleAiChatPanel; } });
var languageModelClient_2 = require("./languageModelClient");
Object.defineProperty(exports, "SimpleAiLanguageModelClient", { enumerable: true, get: function () { return languageModelClient_2.SimpleAiLanguageModelClient; } });
var inlineCompletionProvider_2 = require("./inlineCompletionProvider");
Object.defineProperty(exports, "SimpleAiInlineCompletionProvider", { enumerable: true, get: function () { return inlineCompletionProvider_2.SimpleAiInlineCompletionProvider; } });
async function registerSimpleAiSlice(context, options) {
    const outputChannel = options.outputChannel ?? vscode.window.createOutputChannel('Simple Assistant');
    context.subscriptions.push(outputChannel);
    const client = new languageModelClient_1.SimpleAiLanguageModelClient(outputChannel);
    await client.initialize();
    const inlineCompletionProvider = new inlineCompletionProvider_1.SimpleAiInlineCompletionProvider(client);
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    statusBarItem.command = types_1.SIMPLE_AI_COMMANDS.toggleInlineCompletions;
    context.subscriptions.push(statusBarItem);
    const updateStatusBar = () => {
        const available = client.isAvailable();
        const enabled = inlineCompletionProvider.isEnabled();
        if (!available) {
            statusBarItem.text = '$(warning) Simple AI';
            statusBarItem.tooltip = 'Simple AI unavailable (install a compatible language model extension)';
            statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
        else if (enabled) {
            statusBarItem.text = '$(sparkle) Simple AI';
            statusBarItem.tooltip = 'Simple AI inline completions enabled';
            statusBarItem.backgroundColor = undefined;
        }
        else {
            statusBarItem.text = '$(circle-slash) Simple AI';
            statusBarItem.tooltip = 'Simple AI inline completions disabled';
            statusBarItem.backgroundColor = undefined;
        }
        statusBarItem.show();
    };
    const openChatDisposable = options.enableChatPanel === false
        ? undefined
        : vscode.commands.registerCommand(types_1.SIMPLE_AI_COMMANDS.openChat, () => {
            chatPanel_1.SimpleAiChatPanel.show(options.extensionUri, client);
        });
    const toggleInlineCompletionsDisposable = vscode.commands.registerCommand(types_1.SIMPLE_AI_COMMANDS.toggleInlineCompletions, () => {
        if (!inlineCompletionProvider) {
            void vscode.window.showErrorMessage('Simple AI inline completions are not available');
            return;
        }
        const newState = !inlineCompletionProvider.isEnabled();
        inlineCompletionProvider.setEnabled(newState);
        updateStatusBar();
        void vscode.window.showInformationMessage(newState ? 'Simple AI inline completions enabled' : 'Simple AI inline completions disabled');
    });
    const explainCodeDisposable = vscode.commands.registerCommand(types_1.SIMPLE_AI_COMMANDS.explainCode, async () => {
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
        }
        catch (error) {
            void vscode.window.showErrorMessage(`Failed to explain code: ${error?.message || String(error)}`);
        }
    });
    const reviewCodeDisposable = vscode.commands.registerCommand(types_1.SIMPLE_AI_COMMANDS.reviewCode, async () => {
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
        }
        catch (error) {
            void vscode.window.showErrorMessage(`Failed to review code: ${error?.message || String(error)}`);
        }
    });
    const generateCodeDisposable = vscode.commands.registerCommand(types_1.SIMPLE_AI_COMMANDS.generateCode, async () => {
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
        }
        catch (error) {
            void vscode.window.showErrorMessage(`Failed to generate code: ${error?.message || String(error)}`);
        }
    });
    const completionAcceptedDisposable = vscode.commands.registerCommand(types_1.SIMPLE_AI_COMMANDS.completionAccepted, () => {
        outputChannel.appendLine(`${new Date().toISOString()} [INFO] Simple AI completion accepted`);
    });
    const inlineCompletionRegistration = options.enableInlineCompletions === false
        ? undefined
        : vscode.languages.registerInlineCompletionItemProvider(options.documentSelector ?? [
            { scheme: 'file', language: 'simple' },
            { scheme: 'untitled', language: 'simple' },
        ], inlineCompletionProvider);
    const disposables = [
        openChatDisposable,
        toggleInlineCompletionsDisposable,
        explainCodeDisposable,
        reviewCodeDisposable,
        generateCodeDisposable,
        completionAcceptedDisposable,
        inlineCompletionRegistration,
        statusBarItem,
    ].filter((item) => Boolean(item));
    disposables.forEach((disposable) => context.subscriptions.push(disposable));
    updateStatusBar();
    return {
        outputChannel,
        statusBarItem,
        inlineCompletionProvider,
        client,
        dispose() {
            while (disposables.length) {
                disposables.pop()?.dispose();
            }
        },
    };
}
exports.activateSimpleAiSlice = registerSimpleAiSlice;
//# sourceMappingURL=index.js.map