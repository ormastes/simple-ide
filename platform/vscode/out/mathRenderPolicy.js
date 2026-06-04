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
exports.resolveMathRenderPolicy = resolveMathRenderPolicy;
const vscode = __importStar(require("vscode"));
const mathPreview_1 = require("./mathPreview");
function makeRange(document, from, to) {
    return new vscode.Range(document.positionAt(from), document.positionAt(to));
}
function rangesOverlap(a, b) {
    return !(a.end.isBeforeOrEqual(b.start) || b.end.isBeforeOrEqual(a.start));
}
function hasBlockingDiagnostic(diagnostics, range) {
    return diagnostics.some((diagnostic) => rangesOverlap(diagnostic.range, range)
        && (diagnostic.severity === vscode.DiagnosticSeverity.Error
            || diagnostic.severity === vscode.DiagnosticSeverity.Warning));
}
function resolveMathRenderPolicy(document, block, diagnostics) {
    if (!(0, mathPreview_1.isMathLikeBlock)(block.kind)) {
        return undefined;
    }
    const preview = (0, mathPreview_1.buildMathPreview)(block);
    if (!preview) {
        return {
            shouldRender: false,
            errorMessage: 'Invalid block syntax',
        };
    }
    if (hasBlockingDiagnostic(diagnostics, makeRange(document, block.from, block.to))) {
        return {
            preview,
            shouldRender: false,
            errorMessage: 'Block has warning or error',
        };
    }
    return {
        preview,
        shouldRender: true,
    };
}
//# sourceMappingURL=mathRenderPolicy.js.map