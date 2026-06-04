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
exports.renderRichBlocks = renderRichBlocks;
exports.createWebviewImageResolver = createWebviewImageResolver;
const vscode = __importStar(require("vscode"));
const imageResolver_1 = require("./imageResolver");
const mathRenderPolicy_1 = require("./mathRenderPolicy");
function escapeForHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
function renderRichBlocks(options) {
    const diagnostics = options.diagnostics ?? vscode.languages.getDiagnostics(options.document.uri);
    const imageResolver = options.resolveImageUri ?? (() => null);
    return options.blocks.map((block) => {
        if (block.kind === 'img') {
            const parsed = (0, imageResolver_1.parseImageContent)(block.content);
            if (!parsed) {
                return {
                    ...block,
                    renderedHtml: '',
                    imageUri: undefined,
                    displayMode: 'block',
                    status: 'error',
                    errorMessage: 'Invalid image path',
                };
            }
            const uri = imageResolver(parsed.path, options.document.uri);
            return {
                ...block,
                renderedHtml: '',
                imageUri: uri ?? undefined,
                displayMode: 'block',
                status: uri ? 'ok' : 'error',
                errorMessage: uri ? undefined : `Image not found: ${parsed.path}`,
            };
        }
        const renderPolicy = (0, mathRenderPolicy_1.resolveMathRenderPolicy)(options.document, block, diagnostics);
        if (!renderPolicy?.shouldRender || !renderPolicy.preview) {
            return {
                ...block,
                renderedHtml: '',
                displayMode: 'inline',
                status: 'error',
                errorMessage: renderPolicy?.errorMessage ?? 'Invalid block syntax',
            };
        }
        return {
            ...block,
            renderedHtml: `<span class="cm-math-pretty-text">${escapeForHtml(renderPolicy.preview.displayText)}</span>`,
            displayMode: 'inline',
            status: 'ok',
        };
    });
}
function createWebviewImageResolver(webview) {
    return (imagePath, documentUri) => (0, imageResolver_1.resolveImageUri)(imagePath, documentUri, webview);
}
//# sourceMappingURL=richBlockRendering.js.map