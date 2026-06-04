import * as vscode from 'vscode';
export interface TestWorkspaceEntry {
    sourcePath: string;
    artifactDirectory: string;
    resultJsonPath: string;
    status: string;
    passed: number;
    failed: number;
    skipped: number;
    ignored: number;
    durationMs: number;
    updatedAt: number;
    label: string;
}
export declare function isPathInside(candidate: string, root: string): boolean;
export declare function collectArtifactRoots(workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined): string[];
export declare function discoverTestWorkspaceEntries(workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined): TestWorkspaceEntry[];
export declare function buildTestWorkspaceHtml(entries: TestWorkspaceEntry[]): string;
export declare class TestWorkspacePanel implements vscode.Disposable {
    static currentPanel: TestWorkspacePanel | undefined;
    private readonly panel;
    private readonly disposables;
    private entries;
    private constructor();
    static show(extensionUri: vscode.Uri): TestWorkspacePanel;
    refresh(): void;
    openLatestArtifacts(): void;
    dispose(): void;
    private handleMessage;
    private entryForIndex;
    private openSource;
    private openArtifacts;
    private rerun;
}
