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
const assert = __importStar(require("assert"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const testWorkspacePanel_1 = require("../../testing/testWorkspacePanel");
suite('test workspace panel hardening', () => {
    let artifactRoot;
    setup(() => {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        assert.ok(workspaceRoot, 'expected workspace folder');
        artifactRoot = path.join(workspaceRoot, 'build', 'test-artifacts', `hardening-${Date.now()}`);
        fs.mkdirSync(artifactRoot, { recursive: true });
    });
    teardown(() => {
        if (artifactRoot && fs.existsSync(artifactRoot)) {
            fs.rmSync(artifactRoot, { recursive: true, force: true });
        }
        artifactRoot = undefined;
    });
    test('discovers valid entries while ignoring malformed json and outside source paths', () => {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        assert.ok(workspaceRoot && artifactRoot, 'expected workspace and artifact roots');
        const validSource = path.join(workspaceRoot, 'panel-source.spl');
        const outsideSource = path.join(os.tmpdir(), `simple-vscode-outside-source-${Date.now()}.spl`);
        fs.writeFileSync(validSource, 'fn ok(): i32 = 1', 'utf-8');
        fs.mkdirSync(path.join(artifactRoot, 'valid'), { recursive: true });
        fs.writeFileSync(path.join(artifactRoot, 'valid', 'result.json'), JSON.stringify({
            status: 'passed',
            source_path: validSource,
            artifact_directory: path.join(artifactRoot, 'valid'),
            counts: { passed: 1, failed: 0, skipped: 0, ignored: 0, duration_ms: 3 },
        }), 'utf-8');
        fs.mkdirSync(path.join(artifactRoot, 'outside'), { recursive: true });
        fs.writeFileSync(path.join(artifactRoot, 'outside', 'result.json'), JSON.stringify({
            status: 'passed',
            source_path: outsideSource,
            artifact_directory: path.join(artifactRoot, 'outside'),
        }), 'utf-8');
        fs.mkdirSync(path.join(artifactRoot, 'bad'), { recursive: true });
        fs.writeFileSync(path.join(artifactRoot, 'bad', 'result.json'), '{not json', 'utf-8');
        const entries = (0, testWorkspacePanel_1.discoverTestWorkspaceEntries)(vscode.workspace.workspaceFolders);
        const valid = entries.find((entry) => entry.resultJsonPath.includes(`${path.sep}valid${path.sep}`));
        const outside = entries.find((entry) => entry.resultJsonPath.includes(`${path.sep}outside${path.sep}`));
        assert.ok(valid);
        assert.strictEqual(valid?.sourcePath, validSource);
        assert.ok(outside);
        assert.strictEqual(outside?.sourcePath, '');
        assert.strictEqual(entries.some((entry) => entry.resultJsonPath.includes(`${path.sep}bad${path.sep}`)), false);
        fs.unlinkSync(validSource);
    });
    test('uses a fresh nonce for each rendered test workspace webview', () => {
        const first = (0, testWorkspacePanel_1.buildTestWorkspaceHtml)([]);
        const second = (0, testWorkspacePanel_1.buildTestWorkspaceHtml)([]);
        assert.notStrictEqual(first.match(/script-src 'nonce-([^']+)'/)?.[1], second.match(/script-src 'nonce-([^']+)'/)?.[1]);
    });
    test('path containment rejects sibling and parent escapes', () => {
        const root = path.join(os.tmpdir(), 'simple-root');
        assert.strictEqual((0, testWorkspacePanel_1.isPathInside)(path.join(root, 'child', 'file.txt'), root), true);
        assert.strictEqual((0, testWorkspacePanel_1.isPathInside)(path.join(root, '..', 'escape.txt'), root), false);
    });
});
//# sourceMappingURL=testWorkspacePanel.test.js.map