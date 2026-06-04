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
exports.LspMode = exports.EnvironmentKind = void 0;
exports.detectEnvironment = detectEnvironment;
exports.determineLspMode = determineLspMode;
exports.shouldUseWasm = shouldUseWasm;
exports.getEnvironmentDescription = getEnvironmentDescription;
const vscode = __importStar(require("vscode"));
var EnvironmentKind;
(function (EnvironmentKind) {
    EnvironmentKind["Desktop"] = "desktop";
    EnvironmentKind["Web"] = "web";
    EnvironmentKind["Remote"] = "remote";
})(EnvironmentKind || (exports.EnvironmentKind = EnvironmentKind = {}));
var LspMode;
(function (LspMode) {
    LspMode["Auto"] = "auto";
    LspMode["Native"] = "native";
    LspMode["Wasm"] = "wasm";
})(LspMode || (exports.LspMode = LspMode = {}));
function detectEnvironment() {
    if (vscode.env.uiKind === vscode.UIKind.Web) {
        return EnvironmentKind.Web;
    }
    if (vscode.env.remoteName) {
        return EnvironmentKind.Remote;
    }
    return EnvironmentKind.Desktop;
}
function determineLspMode() {
    const config = vscode.workspace.getConfiguration('simple');
    const userMode = config.get('lsp.mode', 'auto');
    switch (userMode) {
        case 'native':
            return LspMode.Native;
        case 'wasm':
            return LspMode.Wasm;
        default:
            return LspMode.Auto;
    }
}
function shouldUseWasm() {
    const mode = determineLspMode();
    const env = detectEnvironment();
    switch (mode) {
        case LspMode.Native:
            return false;
        case LspMode.Wasm:
            return true;
        case LspMode.Auto:
            return env === EnvironmentKind.Web;
    }
}
function getEnvironmentDescription() {
    return `Environment: ${detectEnvironment()}, Mode: ${determineLspMode()}, Using WASM: ${shouldUseWasm()}`;
}
//# sourceMappingURL=environmentDetector.js.map