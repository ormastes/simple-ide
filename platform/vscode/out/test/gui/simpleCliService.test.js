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
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const simpleCliService_1 = require("../../services/simpleCliService");
suite('simple CLI service', () => {
    const service = new simpleCliService_1.SimpleCliService({});
    const runnableService = new simpleCliService_1.SimpleCliService({
        setStatus: () => undefined,
        markReady: () => undefined,
        markDegraded: () => undefined,
    });
    let workspaceRoot;
    setup(async () => {
        workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        await vscode.workspace.getConfiguration('simple.cli').update('path', undefined, vscode.ConfigurationTarget.Workspace);
        await vscode.workspace.getConfiguration('simple').update('lsp.serverPath', undefined, vscode.ConfigurationTarget.Workspace);
    });
    teardown(async () => {
        await vscode.workspace.getConfiguration('simple.cli').update('path', undefined, vscode.ConfigurationTarget.Workspace);
        await vscode.workspace.getConfiguration('simple').update('lsp.serverPath', undefined, vscode.ConfigurationTarget.Workspace);
        if (workspaceRoot) {
            const bin = path.join(workspaceRoot, 'bin');
            const simple = path.join(bin, 'simple');
            if (fs.existsSync(simple)) {
                fs.unlinkSync(simple);
            }
            if (fs.existsSync(bin) && fs.readdirSync(bin).length === 0) {
                fs.rmdirSync(bin);
            }
        }
    });
    test('uses explicit simple.cli.path before workspace discovery', async () => {
        await vscode.workspace.getConfiguration('simple.cli').update('path', '/custom/simple', vscode.ConfigurationTarget.Workspace);
        assert.strictEqual(service.resolveSimpleCommand(), '/custom/simple');
    });
    test('does not use simple.lsp.serverPath when it points at the LSP wrapper', async () => {
        assert.ok(workspaceRoot, 'expected workspace folder');
        const bin = path.join(workspaceRoot, 'bin');
        const simple = path.join(bin, 'simple');
        fs.mkdirSync(bin, { recursive: true });
        fs.writeFileSync(simple, '#!/bin/sh\n', 'utf-8');
        fs.chmodSync(simple, 0o755);
        await vscode.workspace.getConfiguration('simple').update('lsp.serverPath', path.join(workspaceRoot, 'bin', 'simple_lsp_server'), vscode.ConfigurationTarget.Workspace);
        assert.strictEqual(service.resolveSimpleCommand(), simple);
    });
    test('keeps backwards compatibility when simple.lsp.serverPath points at the CLI', async () => {
        await vscode.workspace.getConfiguration('simple').update('lsp.serverPath', '/custom/simple', vscode.ConfigurationTarget.Workspace);
        assert.strictEqual(service.resolveSimpleCommand(), '/custom/simple');
    });
    test('caps captured subprocess output', async function () {
        if (process.platform === 'win32') {
            this.skip();
        }
        await vscode.workspace.getConfiguration('simple.cli').update('path', '/bin/sh', vscode.ConfigurationTarget.Workspace);
        const result = await runnableService.run([
            '-c',
            'dd if=/dev/zero bs=1024 count=80 2>/dev/null | tr "\\0" x',
        ]);
        assert.strictEqual(result.exitCode, 0);
        assert.ok(result.stdout.length <= simpleCliService_1.CLI_OUTPUT_LIMIT_BYTES + '\n[output truncated]'.length);
        assert.ok(result.stdout.includes('[output truncated]'));
    });
});
//# sourceMappingURL=simpleCliService.test.js.map