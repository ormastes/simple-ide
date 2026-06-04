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
const blockDetector_1 = require("../../blockDetector");
const richBlockRendering_1 = require("../../richBlockRendering");
const testUtils_1 = require("../helpers/testUtils");
suite('rich block rendering', () => {
    teardown(async () => {
        await testUtils_1.TestUtils.closeAllEditors();
        testUtils_1.TestUtils.deleteTestFile('rich-block-demo.spl');
    });
    test('renders valid math-like blocks and leaves warned blocks raw', async () => {
        const document = await testUtils_1.TestUtils.createTestFile('rich-block-demo.spl', [
            'let a = m{frac(1, 2)}',
            'let b = loss{sqrt(x)}',
        ].join('\n'));
        const blocks = (0, blockDetector_1.detectBlocks)(document.getText());
        const warnedRange = new vscode.Range(document.positionAt(blocks[1].from), document.positionAt(blocks[1].to));
        const rendered = (0, richBlockRendering_1.renderRichBlocks)({
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
        const document = await testUtils_1.TestUtils.createTestFile('rich-block-demo.spl', [
            'let a = img{ok.png}',
            'let b = img{missing.png}',
        ].join('\n'));
        const blocks = [
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
        const rendered = (0, richBlockRendering_1.renderRichBlocks)({
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
//# sourceMappingURL=richBlockRendering.test.js.map