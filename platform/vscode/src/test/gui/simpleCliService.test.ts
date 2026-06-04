import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { CLI_OUTPUT_LIMIT_BYTES, SimpleCliService } from '../../services/simpleCliService';
import { ExtensionHostServices } from '../../services/extensionHostServices';

suite('simple CLI service', () => {
    const service = new SimpleCliService({} as never);
    const runnableService = new SimpleCliService({
        setStatus: () => undefined,
        markReady: () => undefined,
        markDegraded: () => undefined,
    } as unknown as ExtensionHostServices);
    let workspaceRoot: string | undefined;

    setup(async () => {
        workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        await vscode.workspace.getConfiguration('simple.cli').update('path', undefined, vscode.ConfigurationTarget.Workspace);
        await vscode.workspace.getConfiguration('simple').update('lsp.serverPath', undefined, vscode.ConfigurationTarget.Workspace);
    });

    teardown(async () => {
        await vscode.workspace.getConfiguration('simple.cli').update('path', undefined, vscode.ConfigurationTarget.Workspace);
        await vscode.workspace.getConfiguration('simple').update('lsp.serverPath', undefined, vscode.ConfigurationTarget.Workspace);
        if (workspaceRoot) {
            const bin = path.join(workspaceRoot, 'bin');
            const simple = path.join(bin, 'simple');
            if (fs.existsSync(simple)) {
                fs.unlinkSync(simple);
            }
            if (fs.existsSync(bin) && fs.readdirSync(bin).length === 0) {
                fs.rmdirSync(bin);
            }
        }
    });

    test('uses explicit simple.cli.path before workspace discovery', async () => {
        await vscode.workspace.getConfiguration('simple.cli').update('path', '/custom/simple', vscode.ConfigurationTarget.Workspace);

        assert.strictEqual(service.resolveSimpleCommand(), '/custom/simple');
    });

    test('does not use simple.lsp.serverPath when it points at the LSP wrapper', async () => {
        assert.ok(workspaceRoot, 'expected workspace folder');
        const bin = path.join(workspaceRoot!, 'bin');
        const simple = path.join(bin, 'simple');
        fs.mkdirSync(bin, { recursive: true });
        fs.writeFileSync(simple, '#!/bin/sh\n', 'utf-8');
        fs.chmodSync(simple, 0o755);
        await vscode.workspace.getConfiguration('simple').update('lsp.serverPath', path.join(workspaceRoot!, 'bin', 'simple_lsp_server'), vscode.ConfigurationTarget.Workspace);

        assert.strictEqual(service.resolveSimpleCommand(), simple);
    });

    test('keeps backwards compatibility when simple.lsp.serverPath points at the CLI', async () => {
        await vscode.workspace.getConfiguration('simple').update('lsp.serverPath', '/custom/simple', vscode.ConfigurationTarget.Workspace);

        assert.strictEqual(service.resolveSimpleCommand(), '/custom/simple');
    });

    test('caps captured subprocess output', async function () {
        if (process.platform === 'win32') {
            this.skip();
        }
        await vscode.workspace.getConfiguration('simple.cli').update('path', '/bin/sh', vscode.ConfigurationTarget.Workspace);

        const result = await runnableService.run([
            '-c',
            'dd if=/dev/zero bs=1024 count=80 2>/dev/null | tr "\\0" x',
        ]);

        assert.strictEqual(result.exitCode, 0);
        assert.ok(result.stdout.length <= CLI_OUTPUT_LIMIT_BYTES + '\n[output truncated]'.length);
        assert.ok(result.stdout.includes('[output truncated]'));
    });
});
