import * as vscode from 'vscode';
import { SimpleAiRegistrationHandle, SimpleAiRegistrationOptions } from './types';
export { SIMPLE_AI_COMMANDS } from './types';
export { SimpleAiChatPanel } from './chatPanel';
export { SimpleAiLanguageModelClient } from './languageModelClient';
export { SimpleAiInlineCompletionProvider } from './inlineCompletionProvider';
export type { SimpleAiRegistrationHandle, SimpleAiRegistrationOptions } from './types';
export declare function registerSimpleAiSlice(context: vscode.ExtensionContext, options: SimpleAiRegistrationOptions): Promise<SimpleAiRegistrationHandle>;
export declare const activateSimpleAiSlice: typeof registerSimpleAiSlice;
