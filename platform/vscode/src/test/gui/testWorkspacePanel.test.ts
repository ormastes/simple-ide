import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    buildTestWorkspaceHtml,
    discoverTestWorkspaceEntries,
    isPathInside,
} from '../../testing/testWorkspacePanel';

suite('test workspace panel hardening', () => {
    let artifactRoot: string | undefined;

    setup(() => {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        assert.ok(workspaceRoot, 'expected workspace folder');
        artifactRoot = path.join(workspaceRoot!, 'build', 'test-artifacts', `hardening-${Date.now()}`);
        fs.mkdirSync(artifactRoot, { recursive: true });
    });

    teardown(() => {
        if (artifactRoot && fs.existsSync(artifactRoot)) {
            fs.rmSync(artifactRoot, { recursive: true, force: true });
        }
        artifactRoot = undefined;
    });

    test('discovers valid entries while ignoring malformed json and outside source paths', () => {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        assert.ok(workspaceRoot && artifactRoot, 'expected workspace and artifact roots');
        const validSource = path.join(workspaceRoot!, 'panel-source.spl');
        const outsideSource = path.join(os.tmpdir(), `simple-vscode-outside-source-${Date.now()}.spl`);
        fs.writeFileSync(validSource, 'fn ok(): i32 = 1', 'utf-8');

        fs.mkdirSync(path.join(artifactRoot!, 'valid'), { recursive: true });
        fs.writeFileSync(path.join(artifactRoot!, 'valid', 'result.json'), JSON.stringify({
            status: 'passed',
            source_path: validSource,
            artifact_directory: path.join(artifactRoot!, 'valid'),
            counts: { passed: 1, failed: 0, skipped: 0, ignored: 0, duration_ms: 3 },
        }), 'utf-8');
        fs.mkdirSync(path.join(artifactRoot!, 'outside'), { recursive: true });
        fs.writeFileSync(path.join(artifactRoot!, 'outside', 'result.json'), JSON.stringify({
            status: 'passed',
            source_path: outsideSource,
            artifact_directory: path.join(artifactRoot!, 'outside'),
        }), 'utf-8');
        fs.mkdirSync(path.join(artifactRoot!, 'bad'), { recursive: true });
        fs.writeFileSync(path.join(artifactRoot!, 'bad', 'result.json'), '{not json', 'utf-8');

        const entries = discoverTestWorkspaceEntries(vscode.workspace.workspaceFolders);
        const valid = entries.find((entry) => entry.resultJsonPath.includes(`${path.sep}valid${path.sep}`));
        const outside = entries.find((entry) => entry.resultJsonPath.includes(`${path.sep}outside${path.sep}`));

        assert.ok(valid);
        assert.strictEqual(valid?.sourcePath, validSource);
        assert.ok(outside);
        assert.strictEqual(outside?.sourcePath, '');
        assert.strictEqual(entries.some((entry) => entry.resultJsonPath.includes(`${path.sep}bad${path.sep}`)), false);

        fs.unlinkSync(validSource);
    });

    test('uses a fresh nonce for each rendered test workspace webview', () => {
        const first = buildTestWorkspaceHtml([]);
        const second = buildTestWorkspaceHtml([]);

        assert.notStrictEqual(first.match(/script-src 'nonce-([^']+)'/)?.[1], second.match(/script-src 'nonce-([^']+)'/)?.[1]);
    });

    test('path containment rejects sibling and parent escapes', () => {
        const root = path.join(os.tmpdir(), 'simple-root');
        assert.strictEqual(isPathInside(path.join(root, 'child', 'file.txt'), root), true);
        assert.strictEqual(isPathInside(path.join(root, '..', 'escape.txt'), root), false);
    });
});
