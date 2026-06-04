/**
 * Simple AI language model client.
 *
 * This is the shared host-side model wrapper for chat, explanation,
 * review, generation, and inline completion prompts.
 */
import * as vscode from 'vscode';
import { SimpleAiChatMessage, SimpleAiChatOptions, SimpleAiCompletionContext } from './types';
export declare class SimpleAiLanguageModelClient {
    private readonly outputChannel;
    private models;
    private selectedModelId;
    private initialized;
    private initializePromise;
    constructor(outputChannel: vscode.OutputChannel);
    initialize(): Promise<void>;
    isAvailable(): boolean;
    getAvailableModels(): string[];
    chat(messages: SimpleAiChatMessage[], options?: SimpleAiChatOptions, cancellationToken?: vscode.CancellationToken): Promise<string>;
    complete(context: SimpleAiCompletionContext, cancellationToken?: vscode.CancellationToken): Promise<string>;
    explain(code: string, language?: string): Promise<string>;
    review(code: string, language?: string): Promise<string>;
    generate(description: string, language?: string): Promise<string>;
    private initializeInternal;
    private buildCompletionPrompt;
    private log;
}
