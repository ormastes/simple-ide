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
exports.escapeForHtml = escapeForHtml;
exports.serializeForScript = serializeForScript;
exports.replaceRangeInText = replaceRangeInText;
exports.detectMathBlocks = detectMathBlocks;
exports.findMathBlockAtPosition = findMathBlockAtPosition;
exports.findMathBlockAtOffset = findMathBlockAtOffset;
exports.buildHighlightedSourcePreview = buildHighlightedSourcePreview;
exports.buildMathPreviewPanelState = buildMathPreviewPanelState;
exports.buildMathSyncPanelState = buildMathSyncPanelState;
exports.buildEmptyPreviewState = buildEmptyPreviewState;
exports.buildEmptySyncState = buildEmptySyncState;
exports.fullDocumentRange = fullDocumentRange;
const vscode = __importStar(require("vscode"));
const blockDetector_1 = require("../blockDetector");
const mathPreview_1 = require("../mathPreview");
function clampOffset(text, offset) {
    return Math.max(0, Math.min(text.length, offset));
}
function escapeForHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
function serializeForScript(value) {
    return JSON.stringify(value).replace(/</g, '\\u003c');
}
function fullDocumentRange(document) {
    const lastLine = document.lineCount > 0 ? document.lineAt(document.lineCount - 1) : undefined;
    const end = lastLine
        ? new vscode.Position(document.lineCount - 1, lastLine.text.length)
        : new vscode.Position(0, 0);
    return new vscode.Range(new vscode.Position(0, 0), end);
}
function replaceRangeInText(text, range, replacement) {
    const start = clampOffset(text, textOffsetAt(text, range.start));
    const end = Math.max(start, clampOffset(text, textOffsetAt(text, range.end)));
    return `${text.slice(0, start)}${replacement}${text.slice(end)}`;
}
function textOffsetAt(text, position) {
    let line = 0;
    let character = 0;
    for (let i = 0; i < text.length; i += 1) {
        if (line === position.line && character === position.character) {
            return i;
        }
        if (text[i] === '\n') {
            line += 1;
            character = 0;
        }
        else {
            character += 1;
        }
    }
    return text.length;
}
function blockToSnapshot(block) {
    return {
        kind: block.kind,
        from: block.from,
        to: block.to,
        prefix: block.prefix,
        content: block.content,
        indicator: block.indicator,
        label: block.label,
        pretty: block.pretty,
    };
}
function detectMathBlocks(document) {
    const text = document.getText();
    const blocks = [];
    for (const block of (0, blockDetector_1.detectBlocks)(text)) {
        const preview = (0, mathPreview_1.buildMathPreview)(block);
        if (!preview) {
            continue;
        }
        const from = document.positionAt(block.from);
        const to = document.positionAt(block.to);
        const contentEnd = document.positionAt(Math.max(block.prefixEnd, block.to - 1));
        blocks.push({
            kind: preview.kind,
            from: block.from,
            to: block.to,
            prefix: block.prefix,
            content: block.content,
            indicator: preview.indicator,
            label: preview.label,
            pretty: preview.displayText,
            fullRange: new vscode.Range(from, to),
            contentRange: new vscode.Range(document.positionAt(block.prefixEnd), contentEnd),
        });
    }
    return blocks;
}
function findMathBlockAtPosition(document, position) {
    return detectMathBlocks(document).find(block => block.fullRange.contains(position));
}
function findMathBlockAtOffset(text, offset) {
    const block = (0, blockDetector_1.findBlockAtOffset)(text, offset);
    if (!block) {
        return undefined;
    }
    const preview = (0, mathPreview_1.buildMathPreview)(block);
    if (!preview) {
        return undefined;
    }
    return blockToSnapshot({
        kind: preview.kind,
        from: block.from,
        to: block.to,
        prefix: block.prefix,
        content: block.content,
        indicator: preview.indicator,
        label: preview.label,
        pretty: preview.displayText,
    });
}
function buildHighlightedSourcePreview(text, selectionStart, selectionEnd) {
    const start = clampOffset(text, selectionStart);
    const end = Math.max(start, clampOffset(text, selectionEnd));
    const before = escapeForHtml(text.slice(0, start));
    const selected = escapeForHtml(text.slice(start, end));
    const after = escapeForHtml(text.slice(end));
    const selectionHtml = selected.length > 0
        ? `<span class="selection-highlight">${selected}</span>`
        : '<span class="selection-caret">|</span>';
    return `${before}${selectionHtml}${after}`;
}
function buildMathPreviewPanelState(document, position) {
    if (document.languageId !== 'simple') {
        return {
            documentUri: document.uri.toString(),
            hasContent: false,
            block: null,
            statusKind: 'info',
            statusMessage: 'Move the caret into a math block to render it.',
        };
    }
    const activeBlock = findMathBlockAtPosition(document, position);
    if (!activeBlock) {
        return {
            documentUri: document.uri.toString(),
            hasContent: false,
            block: null,
            statusKind: 'info',
            statusMessage: 'Move the caret into a math block to render it.',
        };
    }
    return {
        documentUri: document.uri.toString(),
        hasContent: true,
        block: blockToSnapshot(activeBlock),
        statusKind: 'ok',
        statusMessage: 'Rendered active math block.',
    };
}
function buildMathSyncPanelState(document, selectionStartOffset, selectionEndOffset) {
    const text = document.getText();
    const selectionStart = clampOffset(text, selectionStartOffset);
    const selectionEnd = clampOffset(text, selectionEndOffset);
    const blocks = detectMathBlocks(document).map(blockToSnapshot);
    const activeBlock = findMathBlockAtOffset(text, selectionStart);
    if (!activeBlock) {
        return {
            documentUri: document.uri.toString(),
            sourceText: text,
            selectionStart,
            selectionEnd,
            blocks,
            hasContent: false,
            activeBlock: null,
            activeSelectionStart: 0,
            activeSelectionEnd: 0,
            statusKind: 'info',
            statusMessage: 'Move the cursor onto a math block in the source editor.',
        };
    }
    const activeSelectionStart = Math.max(0, selectionStart - activeBlock.from - activeBlock.prefix.length - 1);
    const activeSelectionEnd = Math.max(activeSelectionStart, selectionEnd - activeBlock.from - activeBlock.prefix.length - 1);
    return {
        documentUri: document.uri.toString(),
        sourceText: text,
        selectionStart,
        selectionEnd,
        blocks,
        hasContent: true,
        activeBlock,
        activeSelectionStart,
        activeSelectionEnd,
        statusKind: 'ok',
        statusMessage: 'Active math block is mirrored from the source editor.',
    };
}
function buildEmptyPreviewState(documentUri) {
    return {
        documentUri,
        hasContent: false,
        block: null,
        statusKind: 'info',
        statusMessage: 'Move the caret into a math block to render it.',
    };
}
function buildEmptySyncState(documentUri) {
    return {
        documentUri,
        sourceText: '',
        selectionStart: 0,
        selectionEnd: 0,
        blocks: [],
        hasContent: false,
        activeBlock: null,
        activeSelectionStart: 0,
        activeSelectionEnd: 0,
        statusKind: 'info',
        statusMessage: 'Move the cursor onto a math block in the source editor.',
    };
}
//# sourceMappingURL=mathPanelShared.js.map