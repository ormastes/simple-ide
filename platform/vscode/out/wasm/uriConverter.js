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
exports.uriToWasiPath = uriToWasiPath;
exports.wasiPathToUri = wasiPathToUri;
exports.convertDocumentUri = convertDocumentUri;
exports.convertLspUri = convertLspUri;
exports.getWasiPreopens = getWasiPreopens;
const vscode = __importStar(require("vscode"));
const WASI_WORKSPACE_ROOT = '/workspace';
function uriToWasiPath(uri) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
        const relativePath = vscode.workspace.asRelativePath(uri, false);
        if (relativePath !== uri.toString()) {
            return `${WASI_WORKSPACE_ROOT}/${relativePath}`;
        }
    }
    const segments = uri.path.split('/');
    const fileName = segments[segments.length - 1];
    return `${WASI_WORKSPACE_ROOT}/${fileName}`;
}
function wasiPathToUri(wasiPath) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        return undefined;
    }
    let relativePath = wasiPath;
    if (relativePath.startsWith(`${WASI_WORKSPACE_ROOT}/`)) {
        relativePath = relativePath.substring(WASI_WORKSPACE_ROOT.length + 1);
    }
    else if (relativePath.startsWith(WASI_WORKSPACE_ROOT)) {
        relativePath = relativePath.substring(WASI_WORKSPACE_ROOT.length);
    }
    return vscode.Uri.joinPath(workspaceFolder.uri, relativePath);
}
function convertDocumentUri(uri, isWasm) {
    return isWasm ? uriToWasiPath(uri) : uri.toString();
}
function convertLspUri(lspUri, isWasm) {
    if (isWasm && lspUri.startsWith('/')) {
        const converted = wasiPathToUri(lspUri);
        if (converted) {
            return converted;
        }
    }
    return vscode.Uri.parse(lspUri);
}
function getWasiPreopens() {
    const preopens = [];
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
        preopens.push({
            host: workspaceFolder.uri.fsPath,
            wasi: WASI_WORKSPACE_ROOT,
        });
    }
    return preopens;
}
//# sourceMappingURL=uriConverter.js.map