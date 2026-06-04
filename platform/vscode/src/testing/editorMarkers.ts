import * as vscode from 'vscode';

export interface EditorMarkerState {
    breakpoints: number[];
    bookmarks: number[];
    pointerLine: number | null;
}

interface PersistedMarkerEntry {
    bookmarks: number[];
    pointerLine: number | null;
}

interface DecorationSet {
    breakpoint: vscode.TextEditorDecorationType;
    bookmark: vscode.TextEditorDecorationType;
    pointer: vscode.TextEditorDecorationType;
}

function svgDataUri(svg: string): vscode.Uri {
    return vscode.Uri.parse(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
}

function makeGutterSvg(fill: string, stroke: string, inner: string): string {
    return `
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
  <circle cx="8" cy="8" r="6" fill="${fill}" stroke="${stroke}" stroke-width="1"/>
  ${inner}
</svg>`.trim();
}

function makePointerSvg(fill: string, stroke: string): string {
    return `
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
  <path d="M4 2l8 6-8 6z" fill="${fill}" stroke="${stroke}" stroke-width="1" />
</svg>`.trim();
}

export class EditorMarkerManager implements vscode.Disposable {
    private static readonly storageKey = 'simple.editorMarkers.v1';
    private readonly decorations: DecorationSet;
    private readonly states = new Map<string, EditorMarkerState>();
    private readonly disposables: vscode.Disposable[] = [];
    private readonly didChangeStateEmitter = new vscode.EventEmitter<vscode.Uri>();
    public readonly onDidChangeState = this.didChangeStateEmitter.event;

    public constructor(private readonly storage?: vscode.Memento) {
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

        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor((editor) => {
                if (editor) {
                    this.refresh(editor);
                }
            }),
            vscode.workspace.onDidChangeTextDocument((event) => {
                const editor = vscode.window.visibleTextEditors.find((item) => item.document.uri.toString() === event.document.uri.toString());
                if (editor) {
                    this.refresh(editor);
                }
            }),
        );

        this.restorePersistedState();
        for (const editor of vscode.window.visibleTextEditors) {
            this.refresh(editor);
        }
    }

    public toggleBreakpoint(documentUri: vscode.Uri, line: number): EditorMarkerState {
        this.toggleLine(documentUri.toString(), line, 'breakpoint');
        this.refreshVisible(documentUri);
        this.didChangeStateEmitter.fire(documentUri);
        return this.getState(documentUri);
    }

    public toggleBookmark(documentUri: vscode.Uri, line: number): EditorMarkerState {
        this.toggleLine(documentUri.toString(), line, 'bookmark');
        void this.persistState();
        this.refreshVisible(documentUri);
        this.didChangeStateEmitter.fire(documentUri);
        return this.getState(documentUri);
    }

    public togglePointer(documentUri: vscode.Uri, line: number): EditorMarkerState {
        const key = documentUri.toString();
        const state = this.getOrCreateState(key);
        state.pointerLine = state.pointerLine === line ? null : line;
        void this.persistState();
        this.refreshVisible(documentUri);
        this.didChangeStateEmitter.fire(documentUri);
        return this.getState(documentUri);
    }

    public clearPointer(documentUri: vscode.Uri): EditorMarkerState {
        this.getOrCreateState(documentUri.toString()).pointerLine = null;
        void this.persistState();
        this.refreshVisible(documentUri);
        this.didChangeStateEmitter.fire(documentUri);
        return this.getState(documentUri);
    }

    public jumpToNextBookmark(editor: vscode.TextEditor): void {
        this.jumpToBookmark(editor, true);
    }

    public jumpToPreviousBookmark(editor: vscode.TextEditor): void {
        this.jumpToBookmark(editor, false);
    }

    public refresh(editor: vscode.TextEditor): void {
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

    public getState(documentUri: vscode.Uri): EditorMarkerState {
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

    public dispose(): void {
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

    private refreshVisible(documentUri: vscode.Uri): void {
        for (const editor of vscode.window.visibleTextEditors) {
            if (editor.document.uri.toString() === documentUri.toString()) {
                this.refresh(editor);
            }
        }
    }

    private getOrCreateState(key: string): EditorMarkerState {
        let state = this.states.get(key);
        if (!state) {
            state = { breakpoints: [], bookmarks: [], pointerLine: null };
            this.states.set(key, state);
        }
        return state;
    }

    private toggleLine(key: string, line: number, kind: 'breakpoint' | 'bookmark'): void {
        const state = this.getOrCreateState(key);
        const lines = kind === 'breakpoint' ? state.breakpoints : state.bookmarks;
        const idx = lines.indexOf(line);
        if (idx >= 0) {
            lines.splice(idx, 1);
        } else {
            lines.push(line);
            lines.sort((a, b) => a - b);
        }
    }

    private jumpToBookmark(editor: vscode.TextEditor, forward: boolean): void {
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
        } else {
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

    private restorePersistedState(): void {
        const persisted = this.storage?.get<Record<string, PersistedMarkerEntry>>(EditorMarkerManager.storageKey);
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

    private async persistState(): Promise<void> {
        if (!this.storage) {
            return;
        }

        const persisted: Record<string, PersistedMarkerEntry> = {};
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
