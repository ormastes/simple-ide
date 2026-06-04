import * as vscode from 'vscode';

export class SimpleDiagnosticsProvider implements vscode.Disposable {
    private readonly diagnosticCollection = vscode.languages.createDiagnosticCollection('simple-rich-fallback');
    private readonly disposables: vscode.Disposable[] = [];
    private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
    private enabled = true;

    public constructor() {
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument((event) => {
                if (event.document.languageId === 'simple') {
                    this.debounceDiagnose(event.document);
                }
            }),
            vscode.workspace.onDidOpenTextDocument((document) => {
                if (document.languageId === 'simple') {
                    this.diagnose(document);
                }
            }),
            vscode.workspace.onDidCloseTextDocument((document) => {
                this.diagnosticCollection.delete(document.uri);
                const key = document.uri.toString();
                const timer = this.debounceTimers.get(key);
                if (timer) {
                    clearTimeout(timer);
                    this.debounceTimers.delete(key);
                }
            }),
        );

        for (const document of vscode.workspace.textDocuments) {
            if (document.languageId === 'simple') {
                this.diagnose(document);
            }
        }
    }

    public diagnose(document: vscode.TextDocument): void {
        if (!this.enabled) {
            this.diagnosticCollection.delete(document.uri);
            return;
        }
        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();

        this.checkBrackets(text, document, diagnostics);
        this.checkBasicSyntax(text, diagnostics);
        this.checkRenderableBlockSyntax(document, diagnostics);

        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    public setEnabled(enabled: boolean): void {
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

    public dispose(): void {
        this.diagnosticCollection.dispose();
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
    }

    private debounceDiagnose(document: vscode.TextDocument): void {
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

    private checkRenderableBlockSyntax(document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
        const regex = /\b(m|loss|nograd|img|graph)\{/g;
        const text = document.getText();
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text)) !== null) {
            const start = match.index;
            let depth = 1;
            let index = regex.lastIndex;
            while (index < text.length && depth > 0) {
                const char = text[index];
                if (char === '{') depth++;
                if (char === '}') depth--;
                index++;
            }

            if (depth !== 0) {
                const position = document.positionAt(start);
                diagnostics.push(new vscode.Diagnostic(
                    new vscode.Range(position, position.translate(0, match[0].length)),
                    `Unclosed ${match[1]}{...} block`,
                    vscode.DiagnosticSeverity.Error,
                ));
            }
        }
    }

    private checkBasicSyntax(text: string, diagnostics: vscode.Diagnostic[]): void {
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
                    diagnostics.push(new vscode.Diagnostic(
                        new vscode.Range(lineIndex, charIndex, lineIndex, charIndex + doubleOperator[0].length),
                        'Unexpected operator sequence',
                        vscode.DiagnosticSeverity.Error,
                    ));
                }
            }

            if (/[+\-*/%]\s*$/.test(trimmed) && !trimmed.endsWith('\\')) {
                const operator = trimmed.match(/([+\-*/%])\s*$/)?.[1];
                if (operator) {
                    const charIndex = line.lastIndexOf(operator);
                    diagnostics.push(new vscode.Diagnostic(
                        new vscode.Range(lineIndex, charIndex, lineIndex, charIndex + 1),
                        `Trailing operator '${operator}'`,
                        vscode.DiagnosticSeverity.Warning,
                    ));
                }
            }
        }
    }

    private checkBrackets(text: string, document: vscode.TextDocument, diagnostics: vscode.Diagnostic[]): void {
        const stack: Array<{ char: string; pos: number }> = [];
        const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
        const reverse: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
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
            } else if (reverse[char]) {
                if (stack.length === 0 || stack[stack.length - 1].char !== reverse[char]) {
                    const position = document.positionAt(index);
                    diagnostics.push(new vscode.Diagnostic(
                        new vscode.Range(position, position.translate(0, 1)),
                        `Unexpected '${char}'`,
                        vscode.DiagnosticSeverity.Error,
                    ));
                } else {
                    stack.pop();
                }
            }
        }

        for (const item of stack) {
            const position = document.positionAt(item.pos);
            diagnostics.push(new vscode.Diagnostic(
                new vscode.Range(position, position.translate(0, 1)),
                `Unclosed '${item.char}'`,
                vscode.DiagnosticSeverity.Error,
            ));
        }
    }
}
