import * as assert from 'assert';
import * as vscode from 'vscode';
import type { DetectedBlock } from '../../blockDetector';
import { detectBlocks } from '../../blockDetector';
import { renderRichBlocks } from '../../richBlockRendering';
import { TestUtils } from '../helpers/testUtils';

suite('rich block rendering', () => {
    teardown(async () => {
        await TestUtils.closeAllEditors();
        TestUtils.deleteTestFile('rich-block-demo.spl');
    });

    test('renders valid math-like blocks and leaves warned blocks raw', async () => {
        const document = await TestUtils.createTestFile(
            'rich-block-demo.spl',
            [
                'let a = m{frac(1, 2)}',
                'let b = loss{sqrt(x)}',
            ].join('\n'),
        );
        const blocks = detectBlocks(document.getText());
        const warnedRange = new vscode.Range(
            document.positionAt(blocks[1].from),
            document.positionAt(blocks[1].to),
        );

        const rendered = renderRichBlocks({
            document,
            blocks,
            diagnostics: [
                new vscode.Diagnostic(warnedRange, 'warned block', vscode.DiagnosticSeverity.Warning),
            ],
        });

        assert.strictEqual(rendered[0].status, 'ok');
        assert.ok(rendered[0].renderedHtml.includes('∂{(1)/(2)}'));

        assert.strictEqual(rendered[1].status, 'error');
        assert.strictEqual(rendered[1].renderedHtml, '');
        assert.strictEqual(rendered[1].errorMessage, 'Block has warning or error');
    });

    test('resolves image blocks through the injected resolver', async () => {
        const document = await TestUtils.createTestFile(
            'rich-block-demo.spl',
            [
                'let a = img{ok.png}',
                'let b = img{missing.png}',
            ].join('\n'),
        );
        const blocks: DetectedBlock[] = [
            {
                kind: 'img',
                from: 8,
                to: 19,
                prefixEnd: 12,
                content: 'ok.png',
                prefix: 'img',
            },
            {
                kind: 'img',
                from: 28,
                to: 44,
                prefixEnd: 32,
                content: 'missing.png',
                prefix: 'img',
            },
        ];

        const rendered = renderRichBlocks({
            document,
            blocks,
            resolveImageUri: (imagePath) => imagePath === 'ok.png' ? 'vscode-webview://ok.png' : null,
        });

        assert.strictEqual(rendered[0].status, 'ok');
        assert.strictEqual(rendered[0].imageUri, 'vscode-webview://ok.png');
        assert.strictEqual(rendered[0].displayMode, 'block');

        assert.strictEqual(rendered[1].status, 'error');
        assert.strictEqual(rendered[1].imageUri, undefined);
        assert.strictEqual(rendered[1].errorMessage, 'Image not found: missing.png');
    });
});
