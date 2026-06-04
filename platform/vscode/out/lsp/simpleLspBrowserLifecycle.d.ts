import * as vscode from 'vscode';
import { ExtensionHostServices } from '../services/extensionHostServices';
export interface BrowserLspFallbackControl {
    setEnabled(enabled: boolean): void;
}
export interface BrowserLspOperationResult {
    ok: boolean;
    message: string;
    detail?: string;
}
export interface CreateSimpleBrowserLspControllerOptions {
    context: vscode.ExtensionContext;
    services: ExtensionHostServices;
    fallbackControls?: BrowserLspFallbackControl[];
}
export interface SimpleBrowserLspController extends vscode.Disposable {
    bootstrapClient(): Promise<BrowserLspOperationResult>;
    restartClient(): Promise<BrowserLspOperationResult>;
    showOutputChannel(): void;
}
export declare function createSimpleBrowserLspController(options: CreateSimpleBrowserLspControllerOptions): SimpleBrowserLspController;
