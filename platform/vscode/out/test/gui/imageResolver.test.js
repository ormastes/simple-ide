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
const imageResolver_1 = require("../../imageResolver");
const testUtils_1 = require("../helpers/testUtils");
suite('image resolver hardening', () => {
    let tempOutsideFile;
    teardown(async () => {
        await testUtils_1.TestUtils.closeAllEditors();
        testUtils_1.TestUtils.deleteTestFile('image-resolver-demo.spl');
        testUtils_1.TestUtils.deleteTestFile('inside-image.png');
        if (tempOutsideFile && fs.existsSync(tempOutsideFile)) {
            fs.unlinkSync(tempOutsideFile);
        }
        tempOutsideFile = undefined;
    });
    test('resolves workspace images and rejects paths outside allowed roots', async () => {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        assert.ok(workspaceRoot, 'expected workspace folder');
        const document = await testUtils_1.TestUtils.createTestFile('image-resolver-demo.spl', 'let image = img{inside-image.png}');
        const insideImage = path.join(workspaceRoot, 'inside-image.png');
        fs.writeFileSync(insideImage, 'not really a png', 'utf-8');
        tempOutsideFile = path.join(os.tmpdir(), `simple-vscode-outside-${Date.now()}.png`);
        fs.writeFileSync(tempOutsideFile, 'outside', 'utf-8');
        const webview = {
            asWebviewUri: (uri) => uri,
        };
        assert.strictEqual((0, imageResolver_1.resolveImageUri)('inside-image.png', document.uri, webview), vscode.Uri.file(insideImage).toString());
        assert.strictEqual((0, imageResolver_1.resolveImageUri)(tempOutsideFile, document.uri, webview), null);
        assert.strictEqual((0, imageResolver_1.resolveImageUri)('../outside-image.png', document.uri, webview), null);
    });
});
//# sourceMappingURL=imageResolver.test.js.map