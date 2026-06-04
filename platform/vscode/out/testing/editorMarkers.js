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
exports.EditorMarkerManager = void 0;
const vscode = __importStar(require("vscode"));
function svgDataUri(svg) {
    return vscode.Uri.parse(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
}
function makeGutterSvg(fill, stroke, inner) {
    return `
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
  <circle cx="8" cy="8" r="6" fill="${fill}" stroke="${stroke}" stroke-width="1"/>
  ${inner}
</svg>`.trim();
}
function makePointerSvg(fill, stroke) {
    return `
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
  <path d="M4 2l8 6-8 6z" fill="${fill}" stroke="${stroke}" stroke-width="1" />
</svg>`.trim();
}
class EditorMarkerManager {
    constructor(storage) {
        this.storage = storage;
        this.states = new Map();
        this.disposables = [];
        this.didChangeStateEmitter = new vscode.EventEmitter();
        this.onDidChangeState = this.didChangeStateEmitter.event;
        this.decorations = {
            breakpoint: vscode.window.createTextEditorDecorationType({
                gutterIconPath: svgDataUri(makeGutterSvg('#d73a49', '#8b1d2c', '<circle cx="8" cy="8" r="2.7" fill="#ffffff"/>')),
                gutterIconSize: 'contain',
                isWholeLine: true,
            }),
            bookmark: vscode.window.createTextEditorDecorationType({
                gutterIconPath: svgDataUri(makeGutterSvg('#0969da', '#054a91', '<path d="M8 4l2.2 4.1 4.5.7-3.3 3.2.8 4.5L8 14l-4.2 2.5.8-4.5-3.3-3.2 4.5-.7z" fill="#ffffff"/>')),
                gutterIconSize: 'contain',
                isWholeLine: true,
            }),
            pointer: vscode.window.createTextEditorDecorationType({
                gutterIconPath: svgDataUri(makePointerSvg('#f2cc60', '#916f0e')),
                gutterIconSize: 'contain',
                isWholeLine: true,
                backgroundColor: 'rgba(242, 204, 96, 0.12)',
            }),
        };
        this.disposables.push(vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                this.refresh(editor);
            }
        }), vscode.workspace.onDidChangeTextDocument((event) => {
            const editor = vscode.window.visibleTextEditors.find((item) => item.document.uri.toString() === event.document.uri.toString());
            if (editor) {
                this.refresh(editor);
            }
        }));
        this.restorePersistedState();
        for (const editor of vscode.window.visibleTextEditors) {
            this.refresh(editor);
        }
    }
    toggleBreakpoint(documentUri, line) {
        this.toggleLine(documentUri.toString(), line, 'breakpoint');
        this.refreshVisible(documentUri);
        this.didChangeStateEmitter.fire(documentUri);
        return this.getState(documentUri);
    }
    toggleBookmark(documentUri, line) {
        this.toggleLine(documentUri.toString(), line, 'bookmark');
        void this.persistState();
        this.refreshVisible(documentUri);
        this.didChangeStateEmitter.fire(documentUri);
        return this.getState(documentUri);
    }
    togglePointer(documentUri, line) {
        const key = documentUri.toString();
        const state = this.getOrCreateState(key);
        state.pointerLine = state.pointerLine === line ? null : line;
        void this.persistState();
        this.refreshVisible(documentUri);
        this.didChangeStateEmitter.fire(documentUri);
        return this.getState(documentUri);
    }
    clearPointer(documentUri) {
        this.getOrCreateState(documentUri.toString()).pointerLine = null;
        void this.persistState();
        this.refreshVisible(documentUri);
        this.didChangeStateEmitter.fire(documentUri);
        return this.getState(documentUri);
    }
    jumpToNextBookmark(editor) {
        this.jumpToBookmark(editor, true);
    }
    jumpToPreviousBookmark(editor) {
        this.jumpToBookmark(editor, false);
    }
    refresh(editor) {
        const state = this.states.get(editor.document.uri.toString());
        if (!state) {
            editor.setDecorations(this.decorations.breakpoint, []);
            editor.setDecorations(this.decorations.bookmark, []);
            editor.setDecorations(this.decorations.pointer, []);
            return;
        }
        const breakpointRanges = state.breakpoints.map((line) => new vscode.Range(line, 0, line, 0));
        const bookmarkRanges = state.bookmarks.map((line) => new vscode.Range(line, 0, line, 0));
        const pointerRanges = state.pointerLine === null ? [] : [new vscode.Range(state.pointerLine, 0, state.pointerLine, 0)];
        editor.setDecorations(this.decorations.breakpoint, breakpointRanges);
        editor.setDecorations(this.decorations.bookmark, bookmarkRanges);
        editor.setDecorations(this.decorations.pointer, pointerRanges);
    }
    getState(documentUri) {
        const state = this.states.get(documentUri.toString());
        return state ? {
            breakpoints: [...state.breakpoints],
            bookmarks: [...state.bookmarks],
            pointerLine: state.pointerLine,
        } : {
            breakpoints: [],
            bookmarks: [],
            pointerLine: null,
        };
    }
    dispose() {
        for (const decoration of Object.values(this.decorations)) {
            decoration.dispose();
        }
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables.length = 0;
        this.didChangeStateEmitter.dispose();
        this.states.clear();
    }
    refreshVisible(documentUri) {
        for (const editor of vscode.window.visibleTextEditors) {
            if (editor.document.uri.toString() === documentUri.toString()) {
                this.refresh(editor);
            }
        }
    }
    getOrCreateState(key) {
        let state = this.states.get(key);
        if (!state) {
            state = { breakpoints: [], bookmarks: [], pointerLine: null };
            this.states.set(key, state);
        }
        return state;
    }
    toggleLine(key, line, kind) {
        const state = this.getOrCreateState(key);
        const lines = kind === 'breakpoint' ? state.breakpoints : state.bookmarks;
        const idx = lines.indexOf(line);
        if (idx >= 0) {
            lines.splice(idx, 1);
        }
        else {
            lines.push(line);
            lines.sort((a, b) => a - b);
        }
    }
    jumpToBookmark(editor, forward) {
        const state = this.states.get(editor.document.uri.toString());
        const bookmarks = state?.bookmarks ?? [];
        if (bookmarks.length === 0) {
            void vscode.window.showInformationMessage('No bookmarks set');
            return;
        }
        const current = editor.selection.active.line + 1;
        const ordered = [...bookmarks].sort((a, b) => a - b);
        let target = ordered[0];
        if (forward) {
            for (const line of ordered) {
                if (line + 1 > current) {
                    target = line;
                    break;
                }
            }
        }
        else {
            for (let i = ordered.length - 1; i >= 0; i--) {
                if (ordered[i] + 1 < current) {
                    target = ordered[i];
                    break;
                }
            }
        }
        const position = new vscode.Position(target, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position));
    }
    restorePersistedState() {
        const persisted = this.storage?.get(EditorMarkerManager.storageKey);
        if (!persisted) {
            return;
        }
        for (const [uri, entry] of Object.entries(persisted)) {
            if ((entry.bookmarks?.length ?? 0) === 0 && entry.pointerLine === null) {
                continue;
            }
            this.states.set(uri, {
                breakpoints: [],
                bookmarks: [...(entry.bookmarks ?? [])].sort((a, b) => a - b),
                pointerLine: entry.pointerLine ?? null,
            });
        }
    }
    async persistState() {
        if (!this.storage) {
            return;
        }
        const persisted = {};
        for (const [uri, state] of this.states.entries()) {
            if (state.bookmarks.length === 0 && state.pointerLine === null) {
                continue;
            }
            persisted[uri] = {
                bookmarks: [...state.bookmarks],
                pointerLine: state.pointerLine,
            };
        }
        await this.storage.update(EditorMarkerManager.storageKey, persisted);
    }
}
exports.EditorMarkerManager = EditorMarkerManager;
EditorMarkerManager.storageKey = 'simple.editorMarkers.v1';
//# sourceMappingURL=editorMarkers.js.map