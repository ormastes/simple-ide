import * as vscode from 'vscode';
import { ExtensionHostServices } from '../services/extensionHostServices';
import { SimpleCliService } from '../services/simpleCliService';
export declare class SimpleTestController implements vscode.Disposable {
    private readonly cli;
    private readonly services;
    private readonly controller;
    private readonly output;
    private readonly profile;
    private readonly disposables;
    private readonly itemScopes;
    private readonly itemStates;
    private readonly didChangeTestStatesEmitter;
    readonly onDidChangeTestStates: vscode.Event<vscode.Uri>;
    constructor(cli: SimpleCliService, services: ExtensionHostServices);
    getController(): vscode.TestController;
    getStatesForDocument(documentUri: vscode.Uri): ReadonlyMap<string, 'idle' | 'running' | 'passed' | 'failed' | 'skipped'>;
    refreshWorkspace(): Promise<void>;
    dispose(): void;
    private refreshUri;
    private refreshDocument;
    private runTests;
    private collectRunnableTargets;
    private runTarget;
    private collectDescendants;
    private updateItemState;
}
