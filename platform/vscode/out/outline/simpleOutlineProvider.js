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
exports.SimpleOutlineProvider = void 0;
const vscode = __importStar(require("vscode"));
const simpleAnalysisIndex_1 = require("../analysis/simpleAnalysisIndex");
class OutlineItem extends vscode.TreeItem {
    constructor(document, symbol) {
        super(symbol.name, vscode.TreeItemCollapsibleState.None);
        this.document = document;
        this.symbol = symbol;
        this.children = [];
        this.description = symbol.detail;
        this.iconPath = new vscode.ThemeIcon(OutlineItem.iconFor(symbol.kind));
        this.command = {
            command: 'simple.outline.revealSymbol',
            title: 'Reveal Symbol',
            arguments: [document.uri, symbol.selectionRange],
        };
    }
    static iconFor(kind) {
        switch (kind) {
            case vscode.SymbolKind.Class:
                return 'symbol-class';
            case vscode.SymbolKind.Struct:
                return 'symbol-struct';
            case vscode.SymbolKind.Enum:
                return 'symbol-enum';
            case vscode.SymbolKind.Interface:
                return 'symbol-interface';
            case vscode.SymbolKind.Namespace:
                return 'symbol-namespace';
            case vscode.SymbolKind.Method:
                return 'symbol-method';
            default:
                return 'symbol-function';
        }
    }
}
class SimpleOutlineProvider {
    constructor() {
        this.emitter = new vscode.EventEmitter();
        this.onDidChangeTreeData = this.emitter.event;
    }
    setActiveDocument(document) {
        this.activeDocument = document?.languageId === 'simple' || document?.uri.fsPath.endsWith('.spl')
            ? document
            : undefined;
        this.refresh();
    }
    refresh() {
        this.emitter.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!this.activeDocument) {
            return [];
        }
        if (element) {
            return element.children;
        }
        const items = (0, simpleAnalysisIndex_1.analyzeDocument)(this.activeDocument).symbols
            .map((symbol) => new OutlineItem(this.activeDocument, symbol));
        const byId = new Map(items.map((item) => [item.symbol.id, item]));
        const roots = [];
        for (const item of items) {
            const parent = item.symbol.parentId ? byId.get(item.symbol.parentId) : undefined;
            if (parent) {
                parent.children.push(item);
                parent.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
                continue;
            }
            roots.push(item);
        }
        return roots;
    }
}
exports.SimpleOutlineProvider = SimpleOutlineProvider;
//# sourceMappingURL=simpleOutlineProvider.js.map