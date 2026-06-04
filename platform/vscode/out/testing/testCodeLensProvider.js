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
exports.TestCodeLensProvider = void 0;
const vscode = __importStar(require("vscode"));
const simpleAnalysisIndex_1 = require("../analysis/simpleAnalysisIndex");
class TestCodeLensProvider {
    constructor() {
        this.disposables = [];
        this.emitter = new vscode.EventEmitter();
        this.onDidChangeCodeLenses = this.emitter.event;
        this.disposables.push(vscode.workspace.onDidChangeTextDocument(() => this.emitter.fire()));
    }
    provideCodeLenses(document) {
        if (document.languageId !== 'simple') {
            return [];
        }
        return (0, simpleAnalysisIndex_1.analyzeDocument)(document).tests.map((block) => {
            const range = new vscode.Range(block.line, 0, block.line, 0);
            if (block.runnableScope !== 'file' && block.runnableScope !== 'doctest') {
                return new vscode.CodeLens(range, {
                    title: '$(circle-large-outline) Structure only',
                    command: 'simple.test.showScopeInfo',
                    arguments: [block.kind],
                    tooltip: `${block.kind} is discovered for structure and navigation, but exact-node execution is not implemented yet.`,
                });
            }
            const command = block.runnableScope === 'doctest' ? 'simple.test.runSdoctest' : 'simple.test.runFile';
            const title = block.runnableScope === 'doctest'
                ? '$(play) Run Doctest'
                : '$(play) Run File';
            return new vscode.CodeLens(range, {
                title,
                command,
                arguments: [document.uri],
                tooltip: block.runnableScope === 'doctest'
                    ? `Run doctests from ${document.fileName}`
                    : `Run ${document.fileName} from this scope`,
            });
        });
    }
    dispose() {
        this.emitter.dispose();
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
    }
}
exports.TestCodeLensProvider = TestCodeLensProvider;
//# sourceMappingURL=testCodeLensProvider.js.map