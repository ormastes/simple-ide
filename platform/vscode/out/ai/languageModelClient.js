"use strict";
/**
 * Simple AI language model client.
 *
 * This is the shared host-side model wrapper for chat, explanation,
 * review, generation, and inline completion prompts.
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
exports.SimpleAiLanguageModelClient = void 0;
const vscode = __importStar(require("vscode"));
class SimpleAiLanguageModelClient {
    constructor(outputChannel) {
        this.outputChannel = outputChannel;
        this.models = [];
        this.selectedModelId = null;
        this.initialized = false;
    }
    async initialize() {
        if (this.initialized) {
            return;
        }
        if (!this.initializePromise) {
            this.initializePromise = this.initializeInternal();
        }
        await this.initializePromise;
    }
    isAvailable() {
        return this.models.length > 0;
    }
    getAvailableModels() {
        return this.models.map((model) => `${model.vendor}/${model.family} (${model.id})`);
    }
    async chat(messages, options, cancellationToken) {
        await this.initialize();
        if (!this.isAvailable()) {
            throw new Error('No language models available. Install GitHub Copilot or a compatible language model extension.');
        }
        const model = this.models[0];
        const vscodeMessages = messages.map((message) => {
            if (message.role === 'assistant') {
                return vscode.LanguageModelChatMessage.Assistant(message.content);
            }
            return vscode.LanguageModelChatMessage.User(message.content);
        });
        const requestOptions = {};
        void options;
        const tokenSource = cancellationToken ? undefined : new vscode.CancellationTokenSource();
        try {
            const response = await model.sendRequest(vscodeMessages, requestOptions, cancellationToken ?? tokenSource.token);
            let result = '';
            for await (const fragment of response.text) {
                result += fragment;
            }
            this.log(`Received response from ${model.id}: ${result.slice(0, 120)}`);
            return result;
        }
        finally {
            tokenSource?.dispose();
        }
    }
    async complete(context, cancellationToken) {
        const prompt = this.buildCompletionPrompt(context);
        return this.chat([
            {
                role: 'system',
                content: 'You are a code completion assistant for the Simple programming language. Provide only the completion code without explanations.',
            },
            {
                role: 'user',
                content: prompt,
            },
        ], { maxTokens: 200 }, cancellationToken);
    }
    async explain(code, language = 'simple') {
        return this.chat([
            {
                role: 'system',
                content: 'You are an expert in the Simple programming language. Explain code clearly and concisely.',
            },
            {
                role: 'user',
                content: `Explain this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``,
            },
        ]);
    }
    async review(code, language = 'simple') {
        return this.chat([
            {
                role: 'system',
                content: 'You are a code reviewer for the Simple programming language. Focus on correctness, performance, and best practices.',
            },
            {
                role: 'user',
                content: `Review this ${language} code and suggest improvements:\n\n\`\`\`${language}\n${code}\n\`\`\``,
            },
        ]);
    }
    async generate(description, language = 'simple') {
        return this.chat([
            {
                role: 'system',
                content: 'You are a code generator for the Simple programming language. Generate clean, idiomatic code based on descriptions.',
            },
            {
                role: 'user',
                content: `Generate ${language} code for: ${description}`,
            },
        ]);
    }
    async initializeInternal() {
        try {
            const lm = vscode.lm;
            if (!lm?.selectChatModels) {
                this.log('VS Code language model API is unavailable.');
                this.models = [];
                return;
            }
            let models = await lm.selectChatModels({
                vendor: 'copilot',
                family: 'gpt-4',
            });
            if (models.length === 0) {
                models = await lm.selectChatModels();
            }
            this.models = models;
            if (this.models.length > 0) {
                this.selectedModelId = this.models[0].id;
                this.log(`Initialized with ${this.models.length} language model(s)`);
                this.log(`Selected model: ${this.selectedModelId}`);
            }
            else {
                this.log('No language models available.', 'error');
            }
        }
        catch (error) {
            this.models = [];
            this.log(`Error initializing language models: ${error}`, 'error');
        }
        finally {
            this.initialized = true;
            this.initializePromise = undefined;
        }
    }
    buildCompletionPrompt(context) {
        const lines = context.code.split('\n');
        const currentLine = context.position.line;
        const before = lines.slice(Math.max(0, currentLine - 10), currentLine + 1).join('\n');
        const after = lines.slice(currentLine + 1, Math.min(lines.length, currentLine + 5)).join('\n');
        let prompt = `Complete the following ${context.language} code:\n\n`;
        if (context.fileContext) {
            prompt += `File context:\n${context.fileContext}\n\n`;
        }
        prompt += `\`\`\`${context.language}\n`;
        prompt += before;
        prompt += '<CURSOR>';
        if (after) {
            prompt += '\n' + after;
        }
        prompt += '\n```\n\n';
        prompt += 'Provide only the code that should be inserted at <CURSOR>, without any explanations or markdown.';
        return prompt;
    }
    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = level === 'error' ? '[ERROR]' : '[INFO]';
        this.outputChannel.appendLine(`${timestamp} ${prefix} ${message}`);
    }
}
exports.SimpleAiLanguageModelClient = SimpleAiLanguageModelClient;
//# sourceMappingURL=languageModelClient.js.map