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
exports.SimpleHoverProvider = exports.SimpleReferenceProvider = exports.SimpleDefinitionProvider = exports.SimpleWorkspaceSymbolProvider = exports.SimpleDocumentSymbolProvider = void 0;
const vscode = __importStar(require("vscode"));
const simpleAnalysisIndex_1 = require("../analysis/simpleAnalysisIndex");
const blockDetector_1 = require("../blockDetector");
const mathPreview_1 = require("../mathPreview");
function wordRange(document, position) {
    return document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_]*/);
}
async function collectWorkspaceSymbols(query) {
    const uris = await vscode.workspace.findFiles('**/*.spl', '**/{node_modules,out,.git,target,build}/**', 200);
    const symbols = [];
    for (const uri of uris) {
        const document = await vscode.workspace.openTextDocument(uri);
        symbols.push(...(0, simpleAnalysisIndex_1.analyzeDocument)(document).symbols);
    }
    if (!query) {
        return symbols;
    }
    const lowered = query.toLowerCase();
    return symbols.filter((symbol) => symbol.name.toLowerCase().includes(lowered));
}
function exactSymbolMatches(symbols, name) {
    return symbols.filter((symbol) => symbol.name === name);
}
class SimpleDocumentSymbolProvider {
    constructor() {
        this.enabled = true;
    }
    provideDocumentSymbols(document) {
        if (!this.enabled) {
            return [];
        }
        const indexedSymbols = (0, simpleAnalysisIndex_1.analyzeDocument)(document).symbols;
        const symbols = indexedSymbols.map((symbol) => new vscode.DocumentSymbol(symbol.name, symbol.detail, symbol.kind, symbol.range, symbol.selectionRange));
        const byId = new Map();
        const roots = [];
        for (let i = 0; i < indexedSymbols.length; i++) {
            byId.set(indexedSymbols[i].id, symbols[i]);
        }
        for (let i = 0; i < indexedSymbols.length; i++) {
            const symbol = indexedSymbols[i];
            const node = symbols[i];
            const parent = symbol.parentId ? byId.get(symbol.parentId) : undefined;
            if (parent) {
                parent.children.push(node);
                continue;
            }
            roots.push(node);
        }
        return roots;
    }
    setEnabled(enabled) {
        this.enabled = enabled;
    }
}
exports.SimpleDocumentSymbolProvider = SimpleDocumentSymbolProvider;
class SimpleWorkspaceSymbolProvider {
    constructor() {
        this.enabled = true;
    }
    async provideWorkspaceSymbols(query) {
        if (!this.enabled) {
            return [];
        }
        const symbols = await collectWorkspaceSymbols(query);
        return symbols.map((symbol) => new vscode.SymbolInformation(symbol.name, symbol.kind, symbol.detail, new vscode.Location(symbol.uri, symbol.selectionRange)));
    }
    setEnabled(enabled) {
        this.enabled = enabled;
    }
}
exports.SimpleWorkspaceSymbolProvider = SimpleWorkspaceSymbolProvider;
class SimpleDefinitionProvider {
    constructor() {
        this.enabled = true;
    }
    async provideDefinition(document, position) {
        if (!this.enabled) {
            return undefined;
        }
        const range = wordRange(document, position);
        if (!range) {
            return undefined;
        }
        const word = document.getText(range);
        const currentDocumentHit = (0, simpleAnalysisIndex_1.analyzeDocument)(document).symbols.find((symbol) => symbol.name === word);
        if (currentDocumentHit) {
            return new vscode.Location(currentDocumentHit.uri, currentDocumentHit.selectionRange);
        }
        const workspaceHits = await collectWorkspaceSymbols(word);
        const exact = exactSymbolMatches(workspaceHits, word);
        return exact.map((symbol) => new vscode.Location(symbol.uri, symbol.selectionRange));
    }
    setEnabled(enabled) {
        this.enabled = enabled;
    }
}
exports.SimpleDefinitionProvider = SimpleDefinitionProvider;
class SimpleReferenceProvider {
    constructor() {
        this.enabled = true;
    }
    async provideReferences(document, position, context) {
        if (!this.enabled) {
            return [];
        }
        const range = wordRange(document, position);
        if (!range) {
            return [];
        }
        const word = document.getText(range);
        const workspaceHits = exactSymbolMatches(await collectWorkspaceSymbols(word), word);
        const currentDocumentHits = exactSymbolMatches((0, simpleAnalysisIndex_1.analyzeDocument)(document).symbols, word);
        const merged = [...currentDocumentHits, ...workspaceHits];
        const seen = new Set();
        const locations = [];
        for (const symbol of merged) {
            const key = `${symbol.uri.toString()}:${symbol.selectionRange.start.line}:${symbol.selectionRange.start.character}`;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            locations.push(new vscode.Location(symbol.uri, symbol.selectionRange));
        }
        if (context.includeDeclaration) {
            return locations;
        }
        return locations.filter((location) => !location.range.isEqual(range) || location.uri.toString() !== document.uri.toString());
    }
    setEnabled(enabled) {
        this.enabled = enabled;
    }
}
exports.SimpleReferenceProvider = SimpleReferenceProvider;
class SimpleHoverProvider {
    constructor() {
        this.enabled = true;
    }
    async provideHover(document, position) {
        if (!this.enabled) {
            return undefined;
        }
        const offset = document.offsetAt(position);
        const isInsideMath = (0, blockDetector_1.detectBlocks)(document.getText()).some((block) => (0, mathPreview_1.isMathLikeBlock)(block.kind) && offset >= block.from && offset <= block.to);
        if (isInsideMath) {
            return undefined;
        }
        const range = wordRange(document, position);
        if (!range) {
            return undefined;
        }
        const word = document.getText(range);
        const allSymbols = [
            ...(0, simpleAnalysisIndex_1.analyzeDocument)(document).symbols,
            ...(await collectWorkspaceSymbols(word)),
        ];
        const symbol = allSymbols.find((candidate) => candidate.name === word);
        if (!symbol) {
            return undefined;
        }
        const markdown = new vscode.MarkdownString(undefined, true);
        markdown.appendMarkdown(`**${symbol.name}**\n\n`);
        markdown.appendMarkdown(`Kind: \`${vscode.SymbolKind[symbol.kind]}\`\n\n`);
        markdown.appendMarkdown(`Source: \`${symbol.uri.fsPath}\`:${symbol.selectionRange.start.line + 1}`);
        return new vscode.Hover(markdown, range);
    }
    setEnabled(enabled) {
        this.enabled = enabled;
    }
}
exports.SimpleHoverProvider = SimpleHoverProvider;
//# sourceMappingURL=simpleSymbolProviders.js.map