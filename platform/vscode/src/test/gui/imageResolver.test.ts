import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { resolveImageUri } from '../../imageResolver';
import { TestUtils } from '../helpers/testUtils';

suite('image resolver hardening', () => {
    let tempOutsideFile: string | undefined;

    teardown(async () => {
        await TestUtils.closeAllEditors();
        TestUtils.deleteTestFile('image-resolver-demo.spl');
        TestUtils.deleteTestFile('inside-image.png');
        if (tempOutsideFile && fs.existsSync(tempOutsideFile)) {
            fs.unlinkSync(tempOutsideFile);
        }
        tempOutsideFile = undefined;
    });

    test('resolves workspace images and rejects paths outside allowed roots', async () => {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        assert.ok(workspaceRoot, 'expected workspace folder');
        const document = await TestUtils.createTestFile('image-resolver-demo.spl', 'let image = img{inside-image.png}');
        const insideImage = path.join(workspaceRoot!, 'inside-image.png');
        fs.writeFileSync(insideImage, 'not really a png', 'utf-8');
        tempOutsideFile = path.join(os.tmpdir(), `simple-vscode-outside-${Date.now()}.png`);
        fs.writeFileSync(tempOutsideFile, 'outside', 'utf-8');
        const webview = {
            asWebviewUri: (uri: vscode.Uri) => uri,
        } as unknown as vscode.Webview;

        assert.strictEqual(resolveImageUri('inside-image.png', document.uri, webview), vscode.Uri.file(insideImage).toString());
        assert.strictEqual(resolveImageUri(tempOutsideFile, document.uri, webview), null);
        assert.strictEqual(resolveImageUri('../outside-image.png', document.uri, webview), null);
    });
});
