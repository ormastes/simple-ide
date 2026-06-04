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
exports.TestWorkspacePanel = void 0;
exports.isPathInside = isPathInside;
exports.collectArtifactRoots = collectArtifactRoots;
exports.discoverTestWorkspaceEntries = discoverTestWorkspaceEntries;
exports.buildTestWorkspaceHtml = buildTestWorkspaceHtml;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const webviewNonce_1 = require("../webviewNonce");
const MAX_ARTIFACT_SCAN_DIRECTORIES = 1000;
const MAX_ARTIFACT_RESULTS = 100;
function isPathInside(candidate, root) {
    const relative = path.relative(path.resolve(root), path.resolve(candidate));
    return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function collectArtifactRoots(workspaceFolders) {
    const roots = new Set();
    for (const folder of workspaceFolders ?? []) {
        if (folder.uri.scheme !== 'file') {
            continue;
        }
        roots.add(path.join(folder.uri.fsPath, 'build', 'test-artifacts'));
    }
    return Array.from(roots).filter((root) => fs.existsSync(root));
}
function walkResultJsonFiles(root, maxDirectories = MAX_ARTIFACT_SCAN_DIRECTORIES) {
    const results = [];
    const pending = [root];
    let scannedDirectories = 0;
    while (pending.length > 0 && scannedDirectories < maxDirectories && results.length < MAX_ARTIFACT_RESULTS) {
        const current = pending.pop();
        scannedDirectories += 1;
        let directoryEntries;
        try {
            directoryEntries = fs.readdirSync(current, { withFileTypes: true });
        }
        catch {
            continue;
        }
        for (const entry of directoryEntries) {
            const next = path.join(current, entry.name);
            if (entry.isDirectory()) {
                pending.push(next);
                continue;
            }
            if (entry.isFile() && entry.name === 'result.json') {
                results.push(next);
                if (results.length >= MAX_ARTIFACT_RESULTS) {
                    break;
                }
            }
        }
    }
    return results;
}
function resolveContainedPath(rawPath, relativeRoot, allowedRoots) {
    if (!rawPath) {
        return '';
    }
    const candidate = path.isAbsolute(rawPath)
        ? path.resolve(rawPath)
        : path.resolve(relativeRoot, rawPath);
    return allowedRoots.some((root) => isPathInside(candidate, root)) ? candidate : '';
}
function parseResultJson(resultJsonPath, artifactRoot, workspaceRoots) {
    try {
        const raw = fs.readFileSync(resultJsonPath, 'utf8');
        const parsed = JSON.parse(raw);
        const resultDirectory = path.dirname(resultJsonPath);
        const artifactDirectory = resolveContainedPath(parsed.artifact_directory, resultDirectory, [artifactRoot]) || resultDirectory;
        if (!isPathInside(artifactDirectory, artifactRoot)) {
            return undefined;
        }
        const sourcePath = resolveContainedPath(parsed.source_path, resultDirectory, workspaceRoots);
        const stats = fs.statSync(resultJsonPath);
        return {
            sourcePath,
            artifactDirectory,
            resultJsonPath,
            status: parsed.status ?? 'unknown',
            passed: parsed.counts?.passed ?? 0,
            failed: parsed.counts?.failed ?? 0,
            skipped: parsed.counts?.skipped ?? 0,
            ignored: parsed.counts?.ignored ?? 0,
            durationMs: parsed.counts?.duration_ms ?? 0,
            updatedAt: stats.mtimeMs,
            label: path.basename(sourcePath || artifactDirectory),
        };
    }
    catch {
        return undefined;
    }
}
function discoverTestWorkspaceEntries(workspaceFolders) {
    const entries = [];
    const workspaceRoots = (workspaceFolders ?? [])
        .filter((folder) => folder.uri.scheme === 'file')
        .map((folder) => folder.uri.fsPath);
    for (const root of collectArtifactRoots(workspaceFolders)) {
        for (const resultJsonPath of walkResultJsonFiles(root)) {
            const entry = parseResultJson(resultJsonPath, root, workspaceRoots);
            if (entry) {
                entries.push(entry);
            }
        }
    }
    entries.sort((left, right) => right.updatedAt - left.updatedAt);
    return entries.slice(0, 50);
}
function buildTestWorkspaceHtml(entries) {
    const nonce = (0, webviewNonce_1.createWebviewNonce)();
    const summary = {
        total: entries.length,
        passed: entries.reduce((sum, entry) => sum + entry.passed, 0),
        failed: entries.reduce((sum, entry) => sum + entry.failed, 0),
        latest: entries[0]?.label ?? '—',
    };
    const items = entries.map((entry, index) => `
        <article class="entry">
            <div class="head">
                <div>
                    <div class="title">${escapeHtml(entry.label)}</div>
                    <div class="path">${escapeHtml(entry.sourcePath)}</div>
                </div>
                <span class="badge ${escapeHtml(entry.status)}">${escapeHtml(entry.status)}</span>
            </div>
            <div class="stats">
                <span>passed ${entry.passed}</span>
                <span>failed ${entry.failed}</span>
                <span>skipped ${entry.skipped}</span>
                <span>${entry.durationMs} ms</span>
            </div>
            <div class="actions">
                <button data-action="open" data-index="${index}">Open Source</button>
                <button data-action="rerun" data-index="${index}">Rerun</button>
                <button data-action="artifacts" data-index="${index}">Artifacts</button>
            </div>
        </article>
    `).join('');
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <style>
        body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); margin: 0; padding: 16px; }
        h1 { font-size: 18px; margin: 0 0 8px; }
        .subtitle { color: var(--vscode-descriptionForeground); margin-bottom: 16px; }
        .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
        .card, .entry { background: var(--vscode-sideBar-background); border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 12px; }
        .label { color: var(--vscode-descriptionForeground); font-size: 11px; text-transform: uppercase; }
        .value { font-size: 20px; font-weight: 700; margin-top: 4px; }
        .toolbar, .actions, .stats { display: flex; gap: 8px; flex-wrap: wrap; }
        .toolbar { margin-bottom: 16px; }
        .entry { margin-bottom: 12px; }
        .head { display: flex; justify-content: space-between; gap: 12px; }
        .title { font-weight: 600; }
        .path { color: var(--vscode-descriptionForeground); font-size: 12px; word-break: break-all; }
        .badge { border-radius: 999px; padding: 2px 8px; font-size: 11px; text-transform: uppercase; font-weight: 700; }
        .badge.passed { background: rgba(63, 185, 80, 0.18); color: #3fb950; }
        .badge.failed { background: rgba(248, 81, 73, 0.18); color: #f85149; }
        button { border: 1px solid var(--vscode-button-border, transparent); background: var(--vscode-button-background); color: var(--vscode-button-foreground); border-radius: 4px; padding: 6px 10px; cursor: pointer; }
    </style>
</head>
<body>
    <h1>Simple Test Workspace</h1>
    <div class="subtitle">Latest test artifacts from the current workspace</div>
    <section class="summary">
        <div class="card"><div class="label">Results</div><div class="value">${summary.total}</div></div>
        <div class="card"><div class="label">Passed</div><div class="value">${summary.passed}</div></div>
        <div class="card"><div class="label">Failed</div><div class="value">${summary.failed}</div></div>
        <div class="card"><div class="label">Latest</div><div class="value">${escapeHtml(summary.latest)}</div></div>
    </section>
    <div class="toolbar">
        <button data-action="refresh">Refresh</button>
        <button data-action="open-last">Open Latest Source</button>
        <button data-action="open-last-artifacts">Open Latest Artifacts</button>
    </div>
    ${items || '<div class="card">No test results found yet.</div>'}
    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        document.querySelectorAll('button[data-action]').forEach((button) => {
            button.addEventListener('click', () => {
                vscode.postMessage({
                    type: button.dataset.action,
                    index: button.dataset.index ? Number(button.dataset.index) : undefined,
                });
            });
        });
    </script>
</body>
</html>`;
}
class TestWorkspacePanel {
    constructor(panel) {
        this.disposables = [];
        this.entries = [];
        this.panel = panel;
        this.panel.webview.html = buildTestWorkspaceHtml([]);
        this.panel.webview.onDidReceiveMessage((message) => void this.handleMessage(message), null, this.disposables);
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.refresh();
    }
    static show(extensionUri) {
        const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.Beside;
        if (TestWorkspacePanel.currentPanel) {
            TestWorkspacePanel.currentPanel.panel.reveal(column);
            TestWorkspacePanel.currentPanel.refresh();
            return TestWorkspacePanel.currentPanel;
        }
        const panel = vscode.window.createWebviewPanel('simpleTestWorkspace', 'Simple Test Workspace', column, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [extensionUri],
        });
        TestWorkspacePanel.currentPanel = new TestWorkspacePanel(panel);
        return TestWorkspacePanel.currentPanel;
    }
    refresh() {
        this.entries = discoverTestWorkspaceEntries(vscode.workspace.workspaceFolders);
        this.panel.webview.html = buildTestWorkspaceHtml(this.entries);
    }
    openLatestArtifacts() {
        this.openArtifacts(this.entries[0]);
    }
    dispose() {
        TestWorkspacePanel.currentPanel = undefined;
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
    }
    async handleMessage(message) {
        if (!message || typeof message.type !== 'string') {
            return;
        }
        const entry = this.entryForIndex(message.index);
        switch (message.type) {
            case 'refresh':
                this.refresh();
                break;
            case 'open-last':
                this.openSource(this.entries[0]);
                break;
            case 'open-last-artifacts':
                this.openArtifacts(this.entries[0]);
                break;
            case 'open':
                this.openSource(entry);
                break;
            case 'rerun':
                await this.rerun(entry);
                break;
            case 'artifacts':
                this.openArtifacts(entry);
                break;
        }
    }
    entryForIndex(index) {
        if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= this.entries.length) {
            return undefined;
        }
        return this.entries[index];
    }
    openSource(entry) {
        if (!entry?.sourcePath) {
            return;
        }
        void vscode.window.showTextDocument(vscode.Uri.file(entry.sourcePath), { preview: false });
    }
    openArtifacts(entry) {
        if (!entry?.artifactDirectory) {
            return;
        }
        void vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(entry.artifactDirectory));
    }
    async rerun(entry) {
        if (!entry?.sourcePath) {
            return;
        }
        const uri = vscode.Uri.file(entry.sourcePath);
        const isDocTest = /\.(md|markdown)$/i.test(entry.sourcePath);
        await vscode.commands.executeCommand(isDocTest ? 'simple.test.runSdoctest' : 'simple.test.runFile', uri);
    }
}
exports.TestWorkspacePanel = TestWorkspacePanel;
//# sourceMappingURL=testWorkspacePanel.js.map