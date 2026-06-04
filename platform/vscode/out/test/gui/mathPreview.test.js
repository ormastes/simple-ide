"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const vscode = __importStar(require("vscode"));
const mathPreview_1 = require("../../mathPreview");
const blockDetector_1 = require("../../blockDetector");
const mathRenderPolicy_1 = require("../../mathRenderPolicy");
const nativeMathProvider_1 = require("../../nativeMathProvider");
const mathPanelHtml_1 = require("../../math/mathPanelHtml");
const mathPanelShared_1 = require("../../math/mathPanelShared");
const testUtils_1 = require("../helpers/testUtils");
suite('native math preview', () => {
    let provider;
    teardown(async () => {
        provider?.dispose();
        provider = undefined;
        await testUtils_1.TestUtils.closeAllEditors();
        testUtils_1.TestUtils.deleteTestFile('math-preview-demo.spl');
    });
    test('builds char previews for valid math-like blocks', () => {
        const mathPreview = (0, mathPreview_1.buildMathPreview)({ kind: 'math', content: 'frac(1, 2) + x' });
        const lossPreview = (0, mathPreview_1.buildMathPreview)({ kind: 'loss', content: 'sqrt(x)' });
        const nogradPreview = (0, mathPreview_1.buildMathPreview)({ kind: 'nograd', content: 'alpha^2' });
        assert.ok(mathPreview);
        assert.strictEqual(mathPreview?.displayText, '∂{(1)/(2) + x}');
        assert.ok(lossPreview);
        assert.strictEqual(lossPreview?.displayText, 'ℒ{√(x)}');
        assert.ok(nogradPreview);
        assert.strictEqual(nogradPreview?.displayText, '∅{α²}');
    });
    test('keeps malformed math-like blocks as raw source by refusing preview generation', () => {
        const malformed = (0, mathPreview_1.buildMathPreview)({ kind: 'math', content: 'frac(1, x' });
        assert.strictEqual(malformed, undefined);
    });
    test('finds math-like blocks at the caret position', async () => {
        const document = await testUtils_1.TestUtils.createTestFile('math-preview-demo.spl', [
            'fn demo():',
            '    let a = m{frac(1, 2) + x}',
            '    let b = loss{sqrt(x)}',
            '    let c = nograd{alpha^2}',
        ].join('\n'));
        provider = new nativeMathProvider_1.NativeMathProvider();
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
        const document = await testUtils_1.TestUtils.createTestFile('math-preview-demo.spl', [
            'fn demo():',
            '    let a = m{frac(1, 2) + x}',
        ].join('\n'));
        const block = (0, blockDetector_1.detectBlocks)(document.getText())[0];
        const warningRange = new vscode.Range(document.positionAt(block.from), document.positionAt(block.to));
        const decision = (0, mathRenderPolicy_1.resolveMathRenderPolicy)(document, block, [
            new vscode.Diagnostic(warningRange, 'warned block', vscode.DiagnosticSeverity.Warning),
        ]);
        assert.ok(decision);
        assert.strictEqual(decision?.shouldRender, false);
        assert.strictEqual(decision?.errorMessage, 'Block has warning or error');
    });
    test('block detector still discovers all math-like wrappers', () => {
        const blocks = (0, blockDetector_1.detectBlocks)([
            'let a = m{frac(1, 2)}',
            'let b = loss{sqrt(x)}',
            'let c = nograd{alpha^2}',
        ].join('\n'));
        assert.deepStrictEqual(blocks.map((block) => ({ kind: block.kind, content: block.content })), [
            { kind: 'math', content: 'frac(1, 2)' },
            { kind: 'loss', content: 'sqrt(x)' },
            { kind: 'nograd', content: 'alpha^2' },
        ]);
    });
    test('math webviews use fresh script nonces per render', () => {
        const firstPreview = (0, mathPanelHtml_1.buildMathPreviewPanelHtml)((0, mathPanelShared_1.buildEmptyPreviewState)(''));
        const secondPreview = (0, mathPanelHtml_1.buildMathPreviewPanelHtml)((0, mathPanelShared_1.buildEmptyPreviewState)(''));
        const firstSync = (0, mathPanelHtml_1.buildMathSyncPanelHtml)((0, mathPanelShared_1.buildEmptySyncState)(''));
        const secondSync = (0, mathPanelHtml_1.buildMathSyncPanelHtml)((0, mathPanelShared_1.buildEmptySyncState)(''));
        assert.notStrictEqual(firstPreview.match(/script-src 'nonce-([^']+)'/)?.[1], secondPreview.match(/script-src 'nonce-([^']+)'/)?.[1]);
        assert.notStrictEqual(firstSync.match(/script-src 'nonce-([^']+)'/)?.[1], secondSync.match(/script-src 'nonce-([^']+)'/)?.[1]);
    });
});
//# sourceMappingURL=mathPreview.test.js.map