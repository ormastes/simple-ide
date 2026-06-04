import * as vscode from 'vscode';

export const SIMPLE_AI_COMMANDS = {
    openChat: 'simple.ai.openChat',
    toggleInlineCompletions: 'simple.ai.toggleInlineCompletions',
    explainCode: 'simple.ai.explainCode',
    reviewCode: 'simple.ai.reviewCode',
    generateCode: 'simple.ai.generateCode',
    completionAccepted: 'simple.ai.completionAccepted',
} as const;

export interface SimpleAiChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface SimpleAiChatOptions {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    stopSequences?: string[];
}

export interface SimpleAiCompletionContext {
    code: string;
    position: vscode.Position;
    language: string;
    fileContext?: string;
}

export interface SimpleAiRegistrationOptions {
    extensionUri: vscode.Uri;
    documentSelector?: vscode.DocumentSelector;
    outputChannel?: vscode.OutputChannel;
    enableInlineCompletions?: boolean;
    enableChatPanel?: boolean;
}

export interface SimpleAiRegistrationHandle {
    outputChannel: vscode.OutputChannel;
    statusBarItem: vscode.StatusBarItem;
    inlineCompletionProvider: SimpleAiInlineCompletionProvider;
    client: SimpleAiLanguageModelClient;
    dispose(): void;
}

export interface SimpleAiLanguageModelClient {
    initialize(): Promise<void>;
    isAvailable(): boolean;
    getAvailableModels(): string[];
    chat(messages: SimpleAiChatMessage[], options?: SimpleAiChatOptions, cancellationToken?: vscode.CancellationToken): Promise<string>;
    complete(context: SimpleAiCompletionContext, cancellationToken?: vscode.CancellationToken): Promise<string>;
    explain(code: string, language?: string): Promise<string>;
    review(code: string, language?: string): Promise<string>;
    generate(description: string, language?: string): Promise<string>;
}

export interface SimpleAiInlineCompletionProvider extends vscode.InlineCompletionItemProvider {
    setEnabled(enabled: boolean): void;
    isEnabled(): boolean;
}
