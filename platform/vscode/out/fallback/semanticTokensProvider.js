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
exports.SimpleSemanticTokensProvider = exports.TOKEN_LEGEND = void 0;
const vscode = __importStar(require("vscode"));
exports.TOKEN_LEGEND = new vscode.SemanticTokensLegend([
    'keyword',
    'function',
    'type',
    'variable',
    'parameter',
    'property',
    'number',
    'string',
    'comment',
    'operator',
    'namespace',
], [
    'declaration',
    'definition',
    'readonly',
    'static',
    'deprecated',
    'abstract',
    'async',
    'modification',
    'documentation',
]);
const KEYWORDS = new Set([
    'if', 'else', 'elif', 'match', 'case', 'for', 'while', 'loop',
    'break', 'continue', 'return', 'fn', 'let', 'class', 'enum',
    'trait', 'impl', 'type', 'import', 'export', 'from', 'as', 'pub',
    'mut', 'iso', 'ref', 'move', 'async', 'await', 'actor', 'use',
    'mixin', 'alias', 'in', 'and', 'or', 'not', 'true', 'false', 'none',
    'nil', 'describe', 'context', 'it', 'suite', 'test', 'sdoctest',
]);
const BUILTIN_TYPES = new Set([
    'i8', 'i16', 'i32', 'i64', 'u8', 'u16', 'u32', 'u64',
    'f32', 'f64', 'bool', 'text', 'char', 'String', 'List', 'Map',
    'Set', 'Option', 'Result', 'Tensor', 'Matrix',
]);
class SimpleSemanticTokensProvider {
    constructor() {
        this.emitter = new vscode.EventEmitter();
        this.onDidChangeSemanticTokens = this.emitter.event;
        this.enabled = true;
    }
    provideDocumentSemanticTokens(document) {
        if (!this.enabled) {
            return null;
        }
        const builder = new vscode.SemanticTokensBuilder(exports.TOKEN_LEGEND);
        const lines = document.getText().split('\n');
        for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
            const tokens = this.tokenizeLine(lines[lineNumber], lineNumber);
            for (const token of tokens) {
                builder.push(token.line, token.startChar, token.length, token.tokenType, token.tokenModifiers);
            }
        }
        return builder.build();
    }
    setEnabled(enabled) {
        if (this.enabled === enabled) {
            return;
        }
        this.enabled = enabled;
        this.emitter.fire();
    }
    tokenizeLine(line, lineNumber) {
        const matches = [];
        const covered = new Set();
        const commentIndex = this.findCommentStart(line);
        if (commentIndex >= 0) {
            matches.push({
                line: lineNumber,
                startChar: commentIndex,
                length: line.length - commentIndex,
                tokenType: 8,
                tokenModifiers: 0,
            });
            this.markCovered(covered, commentIndex, line.length - commentIndex);
        }
        this.collectStrings(line, lineNumber, matches, covered);
        const numberRegex = /\b(0x[0-9a-fA-F_]+|0b[01_]+|[0-9][0-9_]*(?:\.[0-9_]+)?)\b/g;
        let match;
        while ((match = numberRegex.exec(line)) !== null) {
            if (this.isCovered(covered, match.index, match[0].length)) {
                continue;
            }
            matches.push({
                line: lineNumber,
                startChar: match.index,
                length: match[0].length,
                tokenType: 6,
                tokenModifiers: 0,
            });
            this.markCovered(covered, match.index, match[0].length);
        }
        const wordRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\b/g;
        while ((match = wordRegex.exec(line)) !== null) {
            if (this.isCovered(covered, match.index, match[0].length)) {
                continue;
            }
            const word = match[1];
            const afterWord = line.substring(match.index + word.length).trimStart();
            const tokenType = KEYWORDS.has(word)
                ? 0
                : BUILTIN_TYPES.has(word) || /^[A-Z]/.test(word)
                    ? 2
                    : afterWord.startsWith('(')
                        ? 1
                        : 3;
            matches.push({
                line: lineNumber,
                startChar: match.index,
                length: word.length,
                tokenType,
                tokenModifiers: 0,
            });
            this.markCovered(covered, match.index, word.length);
        }
        const operatorRegex = /[=+\-*/%<>!&|^~?:@.]+/g;
        while ((match = operatorRegex.exec(line)) !== null) {
            if (this.isCovered(covered, match.index, match[0].length)) {
                continue;
            }
            matches.push({
                line: lineNumber,
                startChar: match.index,
                length: match[0].length,
                tokenType: 9,
                tokenModifiers: 0,
            });
            this.markCovered(covered, match.index, match[0].length);
        }
        matches.sort((left, right) => left.startChar - right.startChar);
        return matches;
    }
    findCommentStart(line) {
        let inString = false;
        let quote = '';
        for (let index = 0; index < line.length; index++) {
            const char = line[index];
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
            if (char === '#') {
                return index;
            }
        }
        return -1;
    }
    collectStrings(line, lineNumber, matches, covered) {
        for (let index = 0; index < line.length; index++) {
            if (covered.has(index)) {
                continue;
            }
            const char = line[index];
            if (char !== '"' && char !== '\'') {
                continue;
            }
            const start = index;
            index++;
            while (index < line.length) {
                if (line[index] === '\\') {
                    index += 2;
                    continue;
                }
                if (line[index] === char) {
                    index++;
                    break;
                }
                index++;
            }
            matches.push({
                line: lineNumber,
                startChar: start,
                length: index - start,
                tokenType: 7,
                tokenModifiers: 0,
            });
            this.markCovered(covered, start, index - start);
        }
    }
    isCovered(covered, start, length) {
        for (let index = start; index < start + length; index++) {
            if (covered.has(index)) {
                return true;
            }
        }
        return false;
    }
    markCovered(covered, start, length) {
        for (let index = start; index < start + length; index++) {
            covered.add(index);
        }
    }
}
exports.SimpleSemanticTokensProvider = SimpleSemanticTokensProvider;
//# sourceMappingURL=semanticTokensProvider.js.map