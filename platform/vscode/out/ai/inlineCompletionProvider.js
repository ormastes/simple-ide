"use strict";
/**
 * Simple AI inline completion provider.
 */
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
exports.SimpleAiInlineCompletionProvider = void 0;
const vscode = __importStar(require("vscode"));
class SimpleAiInlineCompletionProvider {
    constructor(lmClient) {
        this.lmClient = lmClient;
        this.enabled = true;
        this.lastRequestAt = 0;
        this.debounceMs = 300;
        this.minCharsForCompletion = 10;
    }
    setEnabled(enabled) {
        this.enabled = enabled;
    }
    isEnabled() {
        return this.enabled;
    }
    async provideInlineCompletionItems(document, position, _context, token) {
        if (!this.enabled || !this.lmClient.isAvailable()) {
            return undefined;
        }
        if (document.languageId !== 'simple') {
            return undefined;
        }
        if (token.isCancellationRequested) {
            return undefined;
        }
        const now = Date.now();
        if (now - this.lastRequestAt < this.debounceMs) {
            return undefined;
        }
        this.lastRequestAt = now;
        const line = document.lineAt(position.line);
        if (position.character !== line.text.length || line.text.trim().length < this.minCharsForCompletion) {
            return undefined;
        }
        if (position.character === 0) {
            return undefined;
        }
        const previousCharacter = document.getText(new vscode.Range(position.translate(0, -1), position));
        if (['.', '(', '[', '{', ','].includes(previousCharacter)) {
            return undefined;
        }
        try {
            const completionContext = {
                code: document.getText(),
                position,
                language: document.languageId,
                fileContext: this.getFileContext(document),
            };
            const completion = await this.lmClient.complete(completionContext, token);
            const cleanedCompletion = this.cleanCompletion(completion);
            if (!cleanedCompletion) {
                return undefined;
            }
            const item = new vscode.InlineCompletionItem(cleanedCompletion, new vscode.Range(position, position));
            item.command = {
                command: 'simple.ai.completionAccepted',
                title: 'AI Completion Accepted',
            };
            return [item];
        }
        catch (error) {
            console.error('Simple AI inline completion error:', error);
            return undefined;
        }
    }
    getFileContext(document) {
        const text = document.getText();
        const lines = text.split('\n');
        const imports = lines
            .slice(0, Math.min(20, lines.length))
            .filter((line) => line.trim().startsWith('import') || line.trim().startsWith('from'))
            .join('\n');
        const signatures = lines
            .filter((line) => {
            const trimmed = line.trim();
            return (trimmed.startsWith('fn ') ||
                trimmed.startsWith('class ') ||
                trimmed.startsWith('trait ') ||
                trimmed.startsWith('enum '));
        })
            .join('\n');
        return `${imports}\n\n${signatures}`.trim();
    }
    cleanCompletion(completion) {
        let cleaned = completion;
        cleaned = cleaned.replace(/```[\w]*\n/g, '');
        cleaned = cleaned.replace(/```/g, '');
        const lines = cleaned.split('\n');
        const codeLines = lines.filter((line) => {
            const trimmed = line.trim();
            return (!trimmed.startsWith('#') &&
                !trimmed.startsWith('//') &&
                !trimmed.toLowerCase().includes('explanation') &&
                !trimmed.toLowerCase().includes('here is') &&
                !trimmed.toLowerCase().includes('this code'));
        });
        cleaned = codeLines.join('\n').trim();
        if (cleaned.split('\n').length > 5) {
            cleaned = cleaned.split('\n').slice(0, 5).join('\n');
        }
        return cleaned;
    }
}
exports.SimpleAiInlineCompletionProvider = SimpleAiInlineCompletionProvider;
//# sourceMappingURL=inlineCompletionProvider.js.map