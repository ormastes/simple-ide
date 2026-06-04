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
exports.SimpleDiagnosticsProvider = void 0;
const vscode = __importStar(require("vscode"));
class SimpleDiagnosticsProvider {
    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('simple-rich-fallback');
        this.disposables = [];
        this.debounceTimers = new Map();
        this.enabled = true;
        this.disposables.push(vscode.workspace.onDidChangeTextDocument((event) => {
            if (event.document.languageId === 'simple') {
                this.debounceDiagnose(event.document);
            }
        }), vscode.workspace.onDidOpenTextDocument((document) => {
            if (document.languageId === 'simple') {
                this.diagnose(document);
            }
        }), vscode.workspace.onDidCloseTextDocument((document) => {
            this.diagnosticCollection.delete(document.uri);
            const key = document.uri.toString();
            const timer = this.debounceTimers.get(key);
            if (timer) {
                clearTimeout(timer);
                this.debounceTimers.delete(key);
            }
        }));
        for (const document of vscode.workspace.textDocuments) {
            if (document.languageId === 'simple') {
                this.diagnose(document);
            }
        }
    }
    diagnose(document) {
        if (!this.enabled) {
            this.diagnosticCollection.delete(document.uri);
            return;
        }
        const diagnostics = [];
        const text = document.getText();
        this.checkBrackets(text, document, diagnostics);
        this.checkBasicSyntax(text, diagnostics);
        this.checkRenderableBlockSyntax(document, diagnostics);
        this.diagnosticCollection.set(document.uri, diagnostics);
    }
    setEnabled(enabled) {
        if (this.enabled === enabled) {
            return;
        }
        this.enabled = enabled;
        if (!enabled) {
            this.diagnosticCollection.clear();
            return;
        }
        for (const document of vscode.workspace.textDocuments) {
            if (document.languageId === 'simple') {
                this.diagnose(document);
            }
        }
    }
    dispose() {
        this.diagnosticCollection.dispose();
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
    }
    debounceDiagnose(document) {
        const key = document.uri.toString();
        const timer = this.debounceTimers.get(key);
        if (timer) {
            clearTimeout(timer);
        }
        this.debounceTimers.set(key, setTimeout(() => {
            this.debounceTimers.delete(key);
            this.diagnose(document);
        }, 250));
    }
    checkRenderableBlockSyntax(document, diagnostics) {
        const regex = /\b(m|loss|nograd|img|graph)\{/g;
        const text = document.getText();
        let match;
        while ((match = regex.exec(text)) !== null) {
            const start = match.index;
            let depth = 1;
            let index = regex.lastIndex;
            while (index < text.length && depth > 0) {
                const char = text[index];
                if (char === '{')
                    depth++;
                if (char === '}')
                    depth--;
                index++;
            }
            if (depth !== 0) {
                const position = document.positionAt(start);
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(position, position.translate(0, match[0].length)), `Unclosed ${match[1]}{...} block`, vscode.DiagnosticSeverity.Error));
            }
        }
    }
    checkBasicSyntax(text, diagnostics) {
        const lines = text.split('\n');
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            const trimmed = line.trimStart();
            if (!trimmed || trimmed.startsWith('#')) {
                continue;
            }
            const doubleOperator = trimmed.match(/[=+\-*/%](\s*)[=+\-*/%]{2,}/);
            if (doubleOperator) {
                const charIndex = line.indexOf(doubleOperator[0]);
                if (charIndex >= 0) {
                    diagnostics.push(new vscode.Diagnostic(new vscode.Range(lineIndex, charIndex, lineIndex, charIndex + doubleOperator[0].length), 'Unexpected operator sequence', vscode.DiagnosticSeverity.Error));
                }
            }
            if (/[+\-*/%]\s*$/.test(trimmed) && !trimmed.endsWith('\\')) {
                const operator = trimmed.match(/([+\-*/%])\s*$/)?.[1];
                if (operator) {
                    const charIndex = line.lastIndexOf(operator);
                    diagnostics.push(new vscode.Diagnostic(new vscode.Range(lineIndex, charIndex, lineIndex, charIndex + 1), `Trailing operator '${operator}'`, vscode.DiagnosticSeverity.Warning));
                }
            }
        }
    }
    checkBrackets(text, document, diagnostics) {
        const stack = [];
        const pairs = { '(': ')', '[': ']', '{': '}' };
        const reverse = { ')': '(', ']': '[', '}': '{' };
        let inString = false;
        let quote = '';
        let inComment = false;
        for (let index = 0; index < text.length; index++) {
            const char = text[index];
            if (inComment) {
                if (char === '\n') {
                    inComment = false;
                }
                continue;
            }
            if (!inString && char === '#') {
                inComment = true;
                continue;
            }
            if (inString) {
                if (char === '\\') {
                    index++;
                    continue;
                }
                if (char === quote) {
                    inString = false;
                }
                continue;
            }
            if (char === '"' || char === '\'') {
                inString = true;
                quote = char;
                continue;
            }
            if (pairs[char]) {
                stack.push({ char, pos: index });
            }
            else if (reverse[char]) {
                if (stack.length === 0 || stack[stack.length - 1].char !== reverse[char]) {
                    const position = document.positionAt(index);
                    diagnostics.push(new vscode.Diagnostic(new vscode.Range(position, position.translate(0, 1)), `Unexpected '${char}'`, vscode.DiagnosticSeverity.Error));
                }
                else {
                    stack.pop();
                }
            }
        }
        for (const item of stack) {
            const position = document.positionAt(item.pos);
            diagnostics.push(new vscode.Diagnostic(new vscode.Range(position, position.translate(0, 1)), `Unclosed '${item.char}'`, vscode.DiagnosticSeverity.Error));
        }
    }
}
exports.SimpleDiagnosticsProvider = SimpleDiagnosticsProvider;
//# sourceMappingURL=diagnosticsProvider.js.map