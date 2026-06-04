import * as assert from 'assert';
import * as vscode from 'vscode';
import { buildMathPreview } from '../../mathPreview';
import { detectBlocks } from '../../blockDetector';
import { resolveMathRenderPolicy } from '../../mathRenderPolicy';
import { NativeMathProvider } from '../../nativeMathProvider';
import { buildMathPreviewPanelHtml, buildMathSyncPanelHtml } from '../../math/mathPanelHtml';
import { buildEmptyPreviewState, buildEmptySyncState } from '../../math/mathPanelShared';
import { TestUtils } from '../helpers/testUtils';

suite('native math preview', () => {
    let provider: NativeMathProvider | undefined;

    teardown(async () => {
        provider?.dispose();
        provider = undefined;
        await TestUtils.closeAllEditors();
        TestUtils.deleteTestFile('math-preview-demo.spl');
    });

    test('builds char previews for valid math-like blocks', () => {
        const mathPreview = buildMathPreview({ kind: 'math', content: 'frac(1, 2) + x' });
        const lossPreview = buildMathPreview({ kind: 'loss', content: 'sqrt(x)' });
        const nogradPreview = buildMathPreview({ kind: 'nograd', content: 'alpha^2' });

        assert.ok(mathPreview);
        assert.strictEqual(mathPreview?.displayText, '∂{(1)/(2) + x}');

        assert.ok(lossPreview);
        assert.strictEqual(lossPreview?.displayText, 'ℒ{√(x)}');

        assert.ok(nogradPreview);
        assert.strictEqual(nogradPreview?.displayText, '∅{α²}');
    });

    test('keeps malformed math-like blocks as raw source by refusing preview generation', () => {
        const malformed = buildMathPreview({ kind: 'math', content: 'frac(1, x' });
        assert.strictEqual(malformed, undefined);
    });

    test('finds math-like blocks at the caret position', async () => {
        const document = await TestUtils.createTestFile(
            'math-preview-demo.spl',
            [
                'fn demo():',
                '    let a = m{frac(1, 2) + x}',
                '    let b = loss{sqrt(x)}',
                '    let c = nograd{alpha^2}',
            ].join('\n'),
        );

        provider = new NativeMathProvider();

        const mathBlock = provider.findMathBlockAtPosition(document, new vscode.Position(1, 16));
        const lossBlock = provider.findMathBlockAtPosition(document, new vscode.Position(2, 19));
        const nogradBlock = provider.findMathBlockAtPosition(document, new vscode.Position(3, 21));

        assert.ok(mathBlock);
        assert.strictEqual(mathBlock?.kind, 'math');
        assert.strictEqual(mathBlock?.content, 'frac(1, 2) + x');

        assert.ok(lossBlock);
        assert.strictEqual(lossBlock?.kind, 'loss');
        assert.strictEqual(lossBlock?.content, 'sqrt(x)');

        assert.ok(nogradBlock);
        assert.strictEqual(nogradBlock?.kind, 'nograd');
        assert.strictEqual(nogradBlock?.content, 'alpha^2');
    });

    test('shared render policy keeps warned blocks as raw source', async () => {
        const document = await TestUtils.createTestFile(
            'math-preview-demo.spl',
            [
                'fn demo():',
                '    let a = m{frac(1, 2) + x}',
            ].join('\n'),
        );
        const block = detectBlocks(document.getText())[0];
        const warningRange = new vscode.Range(
            document.positionAt(block.from),
            document.positionAt(block.to),
        );

        const decision = resolveMathRenderPolicy(document, block, [
            new vscode.Diagnostic(warningRange, 'warned block', vscode.DiagnosticSeverity.Warning),
        ]);

        assert.ok(decision);
        assert.strictEqual(decision?.shouldRender, false);
        assert.strictEqual(decision?.errorMessage, 'Block has warning or error');
    });

    test('block detector still discovers all math-like wrappers', () => {
        const blocks = detectBlocks([
            'let a = m{frac(1, 2)}',
            'let b = loss{sqrt(x)}',
            'let c = nograd{alpha^2}',
        ].join('\n'));

        assert.deepStrictEqual(
            blocks.map((block) => ({ kind: block.kind, content: block.content })),
            [
                { kind: 'math', content: 'frac(1, 2)' },
                { kind: 'loss', content: 'sqrt(x)' },
                { kind: 'nograd', content: 'alpha^2' },
            ],
        );
    });

    test('math webviews use fresh script nonces per render', () => {
        const firstPreview = buildMathPreviewPanelHtml(buildEmptyPreviewState(''));
        const secondPreview = buildMathPreviewPanelHtml(buildEmptyPreviewState(''));
        const firstSync = buildMathSyncPanelHtml(buildEmptySyncState(''));
        const secondSync = buildMathSyncPanelHtml(buildEmptySyncState(''));

        assert.notStrictEqual(firstPreview.match(/script-src 'nonce-([^']+)'/)?.[1], secondPreview.match(/script-src 'nonce-([^']+)'/)?.[1]);
        assert.notStrictEqual(firstSync.match(/script-src 'nonce-([^']+)'/)?.[1], secondSync.match(/script-src 'nonce-([^']+)'/)?.[1]);
    });
});
