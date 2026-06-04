import * as vscode from 'vscode';
import { analyzeDocument } from '../analysis/simpleAnalysisIndex';

export class TestCodeLensProvider implements vscode.CodeLensProvider, vscode.Disposable {
    private readonly disposables: vscode.Disposable[] = [];
    private readonly emitter = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses = this.emitter.event;

    public constructor() {
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(() => this.emitter.fire()),
        );
    }

    public provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
        if (document.languageId !== 'simple') {
            return [];
        }

        return analyzeDocument(document).tests.map((block) => {
            const range = new vscode.Range(block.line, 0, block.line, 0);
            if (block.runnableScope !== 'file' && block.runnableScope !== 'doctest') {
                return new vscode.CodeLens(range, {
                    title: '$(circle-large-outline) Structure only',
                    command: 'simple.test.showScopeInfo',
                    arguments: [block.kind],
                    tooltip: `${block.kind} is discovered for structure and navigation, but exact-node execution is not implemented yet.`,
                });
            }
            const command = block.runnableScope === 'doctest' ? 'simple.test.runSdoctest' : 'simple.test.runFile';
            const title = block.runnableScope === 'doctest'
                ? '$(play) Run Doctest'
                : '$(play) Run File';
            return new vscode.CodeLens(range, {
                title,
                command,
                arguments: [document.uri],
                tooltip: block.runnableScope === 'doctest'
                    ? `Run doctests from ${document.fileName}`
                    : `Run ${document.fileName} from this scope`,
            });
        });
    }

    public dispose(): void {
        this.emitter.dispose();
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
    }
}
