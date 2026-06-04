import * as vscode from 'vscode';
import { ExtensionHostServices } from '../services/extensionHostServices';
import { SimpleCliService } from '../services/simpleCliService';
import { analyzeDocument, type TestBlock } from '../analysis/simpleAnalysisIndex';

function collectItems(collection: vscode.TestItemCollection): vscode.TestItem[] {
    const items: vscode.TestItem[] = [];
    collection.forEach((item) => {
        items.push(item);
    });
    return items;
}

export class SimpleTestController implements vscode.Disposable {
    private readonly controller: vscode.TestController;
    private readonly output = vscode.window.createOutputChannel('Simple Test Runner');
    private readonly profile: vscode.TestRunProfile;
    private readonly disposables: vscode.Disposable[] = [];
    private readonly itemScopes = new Map<string, { scope: 'file' | 'doctest' | 'exact' | 'none'; fileId: string }>();
    private readonly itemStates = new Map<string, 'idle' | 'running' | 'passed' | 'failed' | 'skipped'>();
    private readonly didChangeTestStatesEmitter = new vscode.EventEmitter<vscode.Uri>();
    public readonly onDidChangeTestStates = this.didChangeTestStatesEmitter.event;

    public constructor(
        private readonly cli: SimpleCliService,
        private readonly services: ExtensionHostServices,
    ) {
        this.controller = vscode.tests.createTestController('simpleTests', 'Simple Tests');
        this.controller.resolveHandler = async (item) => {
            if (item) {
                await this.refreshUri(item.uri ?? vscode.Uri.parse(item.id.split('::')[0]));
                return;
            }
            await this.refreshWorkspace();
        };
        this.profile = this.controller.createRunProfile(
            'Run',
            vscode.TestRunProfileKind.Run,
            (request, token) => void this.runTests(request, token),
            true,
        );

        this.disposables.push(
            this.controller,
            this.profile,
            this.output,
            vscode.workspace.onDidOpenTextDocument((document) => {
                if (document.languageId === 'simple') {
                    void this.refreshDocument(document);
                }
            }),
            vscode.workspace.onDidChangeTextDocument((event) => {
                if (event.document.languageId === 'simple') {
                    void this.refreshDocument(event.document);
                }
            }),
            vscode.workspace.onDidDeleteFiles((event) => {
                for (const uri of event.files) {
                    this.controller.items.delete(uri.toString());
                }
            }),
        );

        for (const document of vscode.workspace.textDocuments) {
            if (document.languageId === 'simple') {
                void this.refreshDocument(document);
            }
        }
    }

    public getController(): vscode.TestController {
        return this.controller;
    }

    public getStatesForDocument(documentUri: vscode.Uri): ReadonlyMap<string, 'idle' | 'running' | 'passed' | 'failed' | 'skipped'> {
        const prefix = `${documentUri.toString()}::`;
        const states = new Map<string, 'idle' | 'running' | 'passed' | 'failed' | 'skipped'>();
        for (const [id, state] of this.itemStates.entries()) {
            if (id.startsWith(prefix)) {
                states.set(id, state);
            }
        }
        return states;
    }

    public async refreshWorkspace(): Promise<void> {
        const uris = await vscode.workspace.findFiles('**/*.spl', '**/{node_modules,out,.git,target,build}/**', 200);
        for (const uri of uris) {
            await this.refreshUri(uri);
        }
    }

    public dispose(): void {
        this.didChangeTestStatesEmitter.dispose();
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
    }

    private async refreshUri(uri: vscode.Uri): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            await this.refreshDocument(document);
        } catch {
            this.controller.items.delete(uri.toString());
        }
    }

    private async refreshDocument(document: vscode.TextDocument): Promise<void> {
        if (document.languageId !== 'simple') {
            return;
        }

        const fileId = document.uri.toString();
        const fileItem = this.controller.items.get(fileId)
            ?? this.controller.createTestItem(fileId, document.fileName.split(/[\\/]/).pop() ?? document.fileName, document.uri);
        fileItem.canResolveChildren = false;
        this.controller.items.add(fileItem);
        fileItem.children.replace([]);
        this.itemScopes.set(fileId, { scope: 'file', fileId });
        const blockItems = new Map<string, vscode.TestItem>();
        for (const key of Array.from(this.itemScopes.keys())) {
            if (key.startsWith(`${fileId}::`)) {
                this.itemScopes.delete(key);
                this.itemStates.delete(key);
            }
        }

        const tests = analyzeDocument(document).tests;
        for (const block of tests) {
            const child = this.controller.createTestItem(
                block.id,
                block.label,
                document.uri,
            );
            child.range = new vscode.Range(block.line, 0, block.line, document.lineAt(block.line).text.length);
            child.canResolveChildren = false;
            child.description = block.kind === 'sdoctest'
                ? 'doctest'
                : block.runnableScope === 'file'
                    ? 'runs file'
                    : 'structure only';
            blockItems.set(block.id, child);
            this.itemScopes.set(block.id, { scope: block.runnableScope, fileId });
            this.itemStates.set(block.id, this.itemStates.get(block.id) ?? 'idle');
        }

        for (const block of tests) {
            const child = blockItems.get(block.id);
            if (!child) {
                continue;
            }
            const parent = block.parentId
                ? blockItems.get(block.parentId)
                : fileItem;
            (parent ?? fileItem).children.add(child);
        }
        this.didChangeTestStatesEmitter.fire(document.uri);
    }

    private async runTests(request: vscode.TestRunRequest, token: vscode.CancellationToken): Promise<void> {
        const run = this.controller.createTestRun(request);
        const targets = this.collectRunnableTargets(request, run);

        try {
            this.services.setStatus('tests', { health: 'starting', source: 'native', message: 'Running Simple tests' });
            for (const target of targets) {
                await this.runTarget(target, run, token);
            }
            this.services.markReady('tests', `Ran ${targets.length} test target(s)`);
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            this.services.markDegraded('tests', 'Test run failed', 'native', detail);
        } finally {
            run.end();
        }
    }

    private collectRunnableTargets(
        request: vscode.TestRunRequest,
        run: vscode.TestRun,
    ): Array<{ anchorItem: vscode.TestItem; fileItem: vscode.TestItem; mode: 'file' | 'doctest' }> {
        const included = request.include && request.include.length > 0
            ? request.include
            : collectItems(this.controller.items);
        const targets = new Map<string, { anchorItem: vscode.TestItem; fileItem: vscode.TestItem; mode: 'file' | 'doctest' }>();

        for (const item of included) {
            const scope = this.itemScopes.get(item.id)?.scope ?? 'file';
            let fileItem = item;
            while (fileItem.parent) {
                fileItem = fileItem.parent;
            }
            if (scope === 'none' || scope === 'exact') {
                run.appendOutput('Exact test execution is not implemented yet. Run the file or doctest node instead.\n', undefined, item);
                run.skipped(item);
                this.updateItemState(item, 'skipped');
                continue;
            }
            const mode = scope === 'doctest' ? 'doctest' : 'file';
            targets.set(`${fileItem.id}::${mode}`, { anchorItem: item, fileItem, mode });
        }

        return Array.from(targets.values()).filter((target) => target.fileItem.uri);
    }

    private async runTarget(
        target: { anchorItem: vscode.TestItem; fileItem: vscode.TestItem; mode: 'file' | 'doctest' },
        run: vscode.TestRun,
        token: vscode.CancellationToken,
    ): Promise<void> {
        const targetItem = target.anchorItem;
        const childItems = this.collectDescendants(targetItem);
        run.enqueued(targetItem);
        run.started(targetItem);
        this.updateItemState(targetItem, 'running');
        for (const child of childItems) {
            run.enqueued(child);
            run.started(child);
            this.updateItemState(child, 'running');
        }

        const args = target.mode === 'doctest'
            ? ['test', '--sdoctest', target.fileItem.uri!.fsPath]
            : ['test', target.fileItem.uri!.fsPath];

        const result = await this.cli.run(args, {
            cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
            token,
            resolveFrom: target.fileItem.uri!.fsPath,
        });
        const duration = Math.max(1, result.combined.length > 0 ? result.combined.length : 1);
        this.output.appendLine(`$ simple ${args.join(' ')}`);
        if (result.stdout.trim()) {
            this.output.appendLine(result.stdout.trim());
        }
        if (result.stderr.trim()) {
            this.output.appendLine(result.stderr.trim());
        }
        run.appendOutput(`${result.combined || '(no output)'}\n`, undefined, targetItem);

        if (result.exitCode === 0) {
            run.passed(targetItem, duration);
            this.updateItemState(targetItem, 'passed');
            for (const child of childItems) {
                run.passed(child, duration);
                this.updateItemState(child, 'passed');
            }
        } else {
            const message = new vscode.TestMessage(result.combined || 'Simple test command failed');
            run.failed(targetItem, message, duration);
            this.updateItemState(targetItem, 'failed');
            for (const child of childItems) {
                run.failed(child, message, duration);
                this.updateItemState(child, 'failed');
            }
        }
    }

    private collectDescendants(root: vscode.TestItem): vscode.TestItem[] {
        const items: vscode.TestItem[] = [];
        const pending = collectItems(root.children);
        while (pending.length > 0) {
            const item = pending.shift()!;
            items.push(item);
            pending.push(...collectItems(item.children));
        }
        return items;
    }

    private updateItemState(item: vscode.TestItem, state: 'idle' | 'running' | 'passed' | 'failed' | 'skipped'): void {
        this.itemStates.set(item.id, state);
        if (item.uri) {
            this.didChangeTestStatesEmitter.fire(item.uri);
            return;
        }
        const fileId = this.itemScopes.get(item.id)?.fileId;
        if (fileId) {
            this.didChangeTestStatesEmitter.fire(vscode.Uri.parse(fileId));
        }
    }
}
