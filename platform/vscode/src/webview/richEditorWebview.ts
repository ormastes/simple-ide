/**
 * CodeMirror 6-based webview editor for the Rich Custom Editor.
 *
 * Provides:
 * - Full code editing (syntax highlighting, keybindings, search, undo/redo)
 * - Inline math rendering via widget decorations at natural height
 * - Image rendering via widget decorations
 * - Cursor-aware view mode: raw source when cursor is in a block
 * - Two-way sync with the VS Code document model
 */

import {
    EditorView, keymap, drawSelection, highlightActiveLine,
    highlightSpecialChars, highlightActiveLineGutter,
    Decoration, GutterMarker, WidgetType, gutter, hoverTooltip, lineNumbers, lineNumberWidgetMarker, type BlockInfo, type DecorationSet, type Extension, type Tooltip, type ViewUpdate,
} from '@codemirror/view';
import { EditorState, RangeSetBuilder, StateEffect, StateField } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, codeFolding, foldGutter, foldKeymap, foldService, indentOnInput, syntaxHighlighting, defaultHighlightStyle, HighlightStyle } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { tags } from '@lezer/highlight';
import { simpleLanguage } from './simpleLang';
import { createDecorationPlugin, type RenderableBlockInfo } from './decorationPlugin';
import { MathWidget } from './widgets/mathWidget';

// ── VS Code API ──────────────────────────────────────────────────────

declare function acquireVsCodeApi(): {
    postMessage(msg: unknown): void;
    getState(): unknown;
    setState(state: unknown): void;
};

// ── Types ────────────────────────────────────────────────────────────

interface SyncMessage {
    type: 'sync';
    sourceText: string;
    selectionStart: number;
    selectionEnd: number;
    settings: {
        showBlockBorders: boolean;
        centerLineNumbers: boolean;
    };
    blocks: Array<{
        kind: string;
        from: number;
        to: number;
        content: string;
        prefix: string;
        renderedHtml: string;
        imageUri?: string;
        displayMode: 'inline' | 'block';
        status: 'ok' | 'error';
        errorMessage?: string;
    }>;
    symbols: Array<{
        name: string;
        kind: string;
        detail: string;
        line: number;
        from: number;
        to: number;
    }>;
    tests: Array<{
        id: string;
        kind: string;
        label: string;
        line: number;
        from: number;
        to: number;
        runnableScope: 'file' | 'doctest' | 'exact' | 'none';
        status: 'idle' | 'running' | 'passed' | 'failed' | 'skipped';
    }>;
    markers: {
        breakpoints: number[];
        bookmarks: number[];
        pointerLine: number | null;
    };
}

type HostMessage = SyncMessage | { type: 'error'; message: string };
type NavigationAction = 'definition' | 'references';

const ENABLE_TEST_LINE_WIDGETS = true;
const ENABLE_SYMBOL_HOVER = true;
const ENABLE_FULL_LINE_BLOCK_MATH = true;

function applyEditorSettings(settings?: SyncMessage['settings']): void {
    const root = document.documentElement;
    const showBlockBorders = settings?.showBlockBorders ?? false;
    const centerLineNumbers = settings?.centerLineNumbers ?? true;

    root.style.setProperty(
        '--simple-rich-block-border',
        showBlockBorders
            ? 'color-mix(in srgb, var(--vscode-editor-foreground) 18%, transparent)'
            : 'transparent',
    );
    root.style.setProperty(
        '--simple-rich-label-bg',
        showBlockBorders
            ? 'color-mix(in srgb, var(--vscode-editor-foreground) 10%, transparent)'
            : 'transparent',
    );
    root.classList.toggle('simple-rich-center-line-numbers', centerLineNumbers);
}

class RichLineNumberWidgetMarker extends GutterMarker {
    constructor(
        readonly lineNumber: string,
        readonly height: number,
    ) {
        super();
    }

    eq(other: RichLineNumberWidgetMarker): boolean {
        return this.lineNumber === other.lineNumber
            && Math.round(this.height) === Math.round(other.height);
    }

    toDOM(): Node {
        const wrap = document.createElement('div');
        wrap.className = 'cm-rich-line-number-marker';
        wrap.textContent = this.lineNumber;
        if (this.height > 0) {
            wrap.style.height = `${this.height}px`;
        }
        return wrap;
    }
}

interface RichEditorSymbol {
    name: string;
    kind: string;
    detail: string;
    line: number;
    from: number;
    to: number;
}

interface RichEditorTestBlock {
    id: string;
    kind: string;
    label: string;
    line: number;
    from: number;
    to: number;
    runnableScope: 'file' | 'doctest' | 'exact' | 'none';
    status: 'idle' | 'running' | 'passed' | 'failed' | 'skipped';
}

interface RichEditorMarkers {
    breakpoints: number[];
    bookmarks: number[];
    pointerLine: number | null;
}

class TestRunGutterMarker extends GutterMarker {
    constructor(readonly test: RichEditorTestBlock | null) {
        super();
    }

    eq(other: TestRunGutterMarker): boolean {
        return this.test?.kind === other.test?.kind
            && this.test?.label === other.test?.label
            && this.test?.line === other.test?.line;
    }

    toDOM(): HTMLElement {
        const node = document.createElement('span');
        node.className = 'cm-test-gutter-icon';
        if (this.test) {
            if (this.test.status === 'running') {
                node.title = `${this.test.kind}: ${this.test.label} (running)`;
                node.classList.add('cm-test-gutter-icon-running');
            } else if (this.test.status === 'passed') {
                node.title = `${this.test.kind}: ${this.test.label} (passed)`;
                node.classList.add('cm-test-gutter-icon-passed');
            } else if (this.test.status === 'failed') {
                node.title = `${this.test.kind}: ${this.test.label} (failed)`;
                node.classList.add('cm-test-gutter-icon-failed');
            } else if (this.test.runnableScope === 'file' || this.test.runnableScope === 'doctest') {
                node.title = `Run ${this.test.kind}: ${this.test.label}`;
            } else {
                node.title = `${this.test.kind}: ${this.test.label} (structure only)`;
                node.classList.add('cm-test-gutter-icon-structure');
            }
            node.setAttribute('aria-label', node.title);
        } else {
            node.classList.add('cm-test-gutter-icon-spacer');
            node.setAttribute('aria-hidden', 'true');
        }
        return node;
    }
}

class BreakpointGutterMarker extends GutterMarker {
    constructor(readonly active: boolean) {
        super();
    }

    eq(other: BreakpointGutterMarker): boolean {
        return this.active === other.active;
    }

    toDOM(): HTMLElement {
        const node = document.createElement('span');
        node.className = `cm-breakpoint-gutter-icon${this.active ? ' cm-breakpoint-gutter-icon-active' : ''}`;
        if (!this.active) {
            node.classList.add('cm-breakpoint-gutter-icon-spacer');
            node.setAttribute('aria-hidden', 'true');
        }
        return node;
    }
}

class BookmarkGutterMarker extends GutterMarker {
    constructor(readonly active: boolean) {
        super();
    }

    eq(other: BookmarkGutterMarker): boolean {
        return this.active === other.active;
    }

    toDOM(): HTMLElement {
        const node = document.createElement('span');
        node.className = `cm-bookmark-gutter-icon${this.active ? ' cm-bookmark-gutter-icon-active' : ''}`;
        if (!this.active) {
            node.classList.add('cm-bookmark-gutter-icon-spacer');
            node.setAttribute('aria-hidden', 'true');
        }
        return node;
    }
}

class PointerGutterMarker extends GutterMarker {
    constructor(readonly active: boolean) {
        super();
    }

    eq(other: PointerGutterMarker): boolean {
        return this.active === other.active;
    }

    toDOM(): HTMLElement {
        const node = document.createElement('span');
        node.className = `cm-pointer-gutter-icon${this.active ? ' cm-pointer-gutter-icon-active' : ''}`;
        if (!this.active) {
            node.classList.add('cm-pointer-gutter-icon-spacer');
            node.setAttribute('aria-hidden', 'true');
        }
        return node;
    }
}

const MATH_BLOCK_REGEX = /\b(?<prefix>m|loss|nograd|img|graph)\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gs;

interface FullLineMathBlock {
    from: number;
    to: number;
    lineFrom: number;
    lineTo: number;
    content: string;
    prefix: string;
}

function detectFullLineMathBlocks(state: EditorState): FullLineMathBlock[] {
    const blocks: FullLineMathBlock[] = [];
    const text = state.doc.toString();
    MATH_BLOCK_REGEX.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = MATH_BLOCK_REGEX.exec(text)) !== null) {
        const line = state.doc.lineAt(match.index);
        const lineText = state.doc.sliceString(line.from, line.to);
        const leading = lineText.length - lineText.trimStart().length;
        const trailing = lineText.length - lineText.trimEnd().length;
        const from = match.index;
        const to = match.index + match[0].length;
        if (match.groups?.prefix === 'img') {
            continue;
        }
        if (line.from + leading !== from || line.to - trailing !== to) {
            continue;
        }
        blocks.push({
            from,
            to,
            lineFrom: line.from,
            lineTo: line.to,
            content: match[2].trim(),
            prefix: match.groups?.prefix ?? 'm',
        });
    }

    return blocks;
}

const refreshRenderedBlocksEffect = StateEffect.define<void>();

function buildFullLineMathDecorations(
    state: EditorState,
    renderedBlocks: Map<string, RenderableBlockInfo>,
): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const intersectsSelection = (from: number, to: number): boolean => {
        for (const range of state.selection.ranges) {
            const start = Math.min(range.anchor, range.head);
            const end = Math.max(range.anchor, range.head);
            if (range.empty) {
                if (start >= from && start <= to) {
                    return true;
                }
                continue;
            }
            if (start < to && end > from) {
                return true;
            }
        }
        return false;
    };

    for (const block of detectFullLineMathBlocks(state)) {
        if (intersectsSelection(block.from, block.to)) {
            continue;
        }

        const key = `${block.prefix}:${block.content}`;
        const info = renderedBlocks.get(key);
        if (!info?.renderedHtml) {
            continue;
        }

        builder.add(
            block.lineFrom,
            block.lineTo,
            Decoration.replace({
                widget: new MathWidget(info.renderedHtml, block.prefix, block.content, 'block'),
                block: true,
            }),
        );
    }

    return builder.finish();
}

function createFullLineMathField(
    getRenderedBlocks: () => Map<string, RenderableBlockInfo>,
): StateField<DecorationSet> {
    return StateField.define<DecorationSet>({
        create(state) {
            return buildFullLineMathDecorations(state, getRenderedBlocks());
        },
        update(value, tr) {
            if (
                tr.docChanged
                || tr.selection
                || tr.effects.some((effect) => effect.is(refreshRenderedBlocksEffect))
            ) {
                return buildFullLineMathDecorations(tr.state, getRenderedBlocks());
            }
            return value;
        },
        provide: (field) => EditorView.decorations.from(field),
    });
}

function createMathAwareLineNumberSetup(): Extension[] {
    return [
        lineNumbers(),
        lineNumberWidgetMarker.of((view: EditorView, widget: WidgetType, block: BlockInfo) => {
            if (!(widget instanceof MathWidget) || widget.displayMode !== 'block') {
                return null;
            }
            const lineNumber = String(view.state.doc.lineAt(block.from).number);
            return new RichLineNumberWidgetMarker(lineNumber, block.height);
        }),
    ];
}

function shouldRefreshGutterMarkers(update: ViewUpdate): boolean {
    return update.docChanged
        || update.transactions.some((transaction) =>
            transaction.effects.some((effect) => effect.is(refreshRenderedBlocksEffect)));
}

function buildTestRunMarkers(
    state: EditorState,
    tests: RichEditorTestBlock[],
): RangeSetBuilder<GutterMarker> {
    const builder = new RangeSetBuilder<GutterMarker>();
    for (const test of tests) {
        if (!['describe', 'context', 'it', 'sdoctest'].includes(test.kind)) {
            continue;
        }
        const lineNumber = test.line + 1;
        if (lineNumber < 1 || lineNumber > state.doc.lines) {
            continue;
        }
        const line = state.doc.line(lineNumber);
        builder.add(line.from, line.from, new TestRunGutterMarker(test));
    }
    return builder;
}

function createTestRunGutter(
    getTests: () => RichEditorTestBlock[],
    onRunTest: (test: RichEditorTestBlock) => void,
): Extension {
    return gutter({
        class: 'cm-test-run-gutter',
        markers(view) {
            return buildTestRunMarkers(view.state, getTests()).finish();
        },
        lineMarkerChange(update) {
            return shouldRefreshGutterMarkers(update);
        },
        initialSpacer() {
            return new TestRunGutterMarker(null);
        },
        domEventHandlers: {
            mousedown(view, line, event) {
                const test = getTests().find((candidate) => candidate.line === view.state.doc.lineAt(line.from).number - 1);
                if (!test || (test.runnableScope !== 'file' && test.runnableScope !== 'doctest')) {
                    return false;
                }
                event.preventDefault();
                onRunTest(test);
                return true;
            },
        },
    });
}

function buildBreakpointMarkers(
    state: EditorState,
    markers: RichEditorMarkers,
): RangeSetBuilder<GutterMarker> {
    const builder = new RangeSetBuilder<GutterMarker>();
    const activeBreakpoints = new Set(markers.breakpoints);

    for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
        const line = state.doc.line(lineNumber);
        if (activeBreakpoints.has(lineNumber - 1)) {
            builder.add(line.from, line.from, new BreakpointGutterMarker(true));
        }
    }

    return builder;
}

function createBreakpointGutter(
    getMarkers: () => RichEditorMarkers,
    onToggleBreakpoint: (line: number) => void,
): Extension {
    return gutter({
        class: 'cm-breakpoint-gutter',
        markers(view) {
            return buildBreakpointMarkers(view.state, getMarkers()).finish();
        },
        lineMarkerChange(update) {
            return shouldRefreshGutterMarkers(update);
        },
        initialSpacer() {
            return new BreakpointGutterMarker(false);
        },
        domEventHandlers: {
            mousedown(view, line, event) {
                event.preventDefault();
                onToggleBreakpoint(view.state.doc.lineAt(line.from).number - 1);
                return true;
            },
        },
    });
}

function buildBookmarkMarkers(
    state: EditorState,
    markers: RichEditorMarkers,
): RangeSetBuilder<GutterMarker> {
    const builder = new RangeSetBuilder<GutterMarker>();
    const activeBookmarks = new Set(markers.bookmarks);

    for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
        const line = state.doc.line(lineNumber);
        if (activeBookmarks.has(lineNumber - 1)) {
            builder.add(line.from, line.from, new BookmarkGutterMarker(true));
        }
    }

    return builder;
}

function createBookmarkGutter(
    getMarkers: () => RichEditorMarkers,
    onToggleBookmark: (line: number) => void,
): Extension {
    return gutter({
        class: 'cm-bookmark-gutter',
        markers(view) {
            return buildBookmarkMarkers(view.state, getMarkers()).finish();
        },
        lineMarkerChange(update) {
            return shouldRefreshGutterMarkers(update);
        },
        initialSpacer() {
            return new BookmarkGutterMarker(false);
        },
        domEventHandlers: {
            mousedown(view, line, event) {
                event.preventDefault();
                onToggleBookmark(view.state.doc.lineAt(line.from).number - 1);
                return true;
            },
        },
    });
}

function buildPointerMarkers(
    state: EditorState,
    markers: RichEditorMarkers,
): RangeSetBuilder<GutterMarker> {
    const builder = new RangeSetBuilder<GutterMarker>();
    if (markers.pointerLine === null) {
        return builder;
    }

    const lineNumber = markers.pointerLine + 1;
    if (lineNumber < 1 || lineNumber > state.doc.lines) {
        return builder;
    }

    const line = state.doc.line(lineNumber);
    builder.add(line.from, line.from, new PointerGutterMarker(true));
    return builder;
}

function createPointerGutter(
    getMarkers: () => RichEditorMarkers,
    onTogglePointer: (line: number) => void,
): Extension {
    return gutter({
        class: 'cm-pointer-gutter',
        markers(view) {
            return buildPointerMarkers(view.state, getMarkers()).finish();
        },
        lineMarkerChange(update) {
            return shouldRefreshGutterMarkers(update);
        },
        initialSpacer() {
            return new PointerGutterMarker(false);
        },
        domEventHandlers: {
            mousedown(view, line, event) {
                event.preventDefault();
                onTogglePointer(view.state.doc.lineAt(line.from).number - 1);
                return true;
            },
        },
    });
}

function isIdentifierChar(char: string | undefined): boolean {
    return !!char && /[A-Za-z0-9_]/.test(char);
}

function readIdentifierAt(state: EditorState, pos: number): { word: string; from: number; to: number } | null {
    const line = state.doc.lineAt(pos);
    const localPos = pos - line.from;
    const text = line.text;

    let start = localPos;
    if (!isIdentifierChar(text[start]) && isIdentifierChar(text[start - 1])) {
        start -= 1;
    }
    if (!isIdentifierChar(text[start])) {
        return null;
    }

    let end = start;
    while (start > 0 && isIdentifierChar(text[start - 1])) {
        start -= 1;
    }
    while (end < text.length && isIdentifierChar(text[end])) {
        end += 1;
    }

    return {
        word: text.slice(start, end),
        from: line.from + start,
        to: line.from + end,
    };
}

function buildSymbolActionMarkup(symbol: RichEditorSymbol): string {
    return `
        <strong>${symbol.name}</strong>
        <div>${symbol.detail} · ${symbol.kind}</div>
        <div>line ${symbol.line + 1}</div>
        <div class="simple-rich-hover-actions">
            <button type="button" data-nav="definition">Definition</button>
            <button type="button" data-nav="references">References</button>
        </div>
    `;
}

function resolveSymbolForIdentifier(
    symbols: RichEditorSymbol[],
    ident: { word: string; from: number; to: number },
): RichEditorSymbol | undefined {
    const containing = symbols
        .filter((candidate) => candidate.from <= ident.from && candidate.to >= ident.to)
        .sort((left, right) => (left.to - left.from) - (right.to - right.from));
    if (containing.length > 0) {
        return containing[0];
    }

    return symbols.find((candidate) =>
        candidate.name === ident.word
        && candidate.from === ident.from
        && candidate.to === ident.to,
    ) ?? symbols.find((candidate) => candidate.name === ident.word);
}

function wireSymbolActionButtons(
    root: ParentNode,
    ident: { word: string; from: number; to: number },
    onNavigate: (offset: number, action: NavigationAction) => void,
    onClose?: () => void,
): void {
    root.querySelectorAll<HTMLButtonElement>('button[data-nav]').forEach((button) => {
        button.onclick = (clickEvent) => {
            clickEvent.preventDefault();
            clickEvent.stopPropagation();
            const action = button.dataset.nav === 'references' ? 'references' : 'definition';
            onNavigate(ident.from, action);
            onClose?.();
        };
    });
}

function createSymbolHoverTooltip(
    getSymbols: () => RichEditorSymbol[],
    onNavigate: (offset: number, action: NavigationAction) => void,
): Extension {
    return hoverTooltip((view, pos): Tooltip | null => {
        const ident = readIdentifierAt(view.state, pos);
        if (!ident) {
            return null;
        }

        const symbol = resolveSymbolForIdentifier(getSymbols(), ident);
        if (!symbol) {
            return null;
        }

        return {
            pos: ident.from,
            end: ident.to,
            above: true,
            create() {
                const dom = document.createElement('div');
                dom.className = 'simple-rich-hover-tooltip';
                dom.innerHTML = buildSymbolActionMarkup(symbol);
                wireSymbolActionButtons(dom, ident, onNavigate);
                return { dom };
            },
        };
    }, {
        hoverTime: 250,
        hideOnChange: 'touch',
    });
}

function createActionMenu(
    parent: HTMLElement,
    onNavigate: (offset: number, action: NavigationAction) => void,
): {
    show: (clientX: number, clientY: number, ident: { word: string; from: number; to: number }, symbol?: RichEditorSymbol) => void;
    hide: () => void;
    destroy: () => void;
} {
    const menu = document.createElement('div');
    menu.className = 'simple-rich-action-menu';
    menu.hidden = true;
    parent.appendChild(menu);

    const hide = () => {
        menu.hidden = true;
    };

    const dismissOnWindowMouseDown = (event: MouseEvent) => {
        if (!menu.contains(event.target as Node)) {
            hide();
        }
    };

    window.addEventListener('mousedown', dismissOnWindowMouseDown, true);

    return {
        show(clientX, clientY, ident, symbol) {
            const resolved = symbol ?? {
                name: ident.word,
                kind: 'symbol',
                detail: 'identifier',
                line: 0,
                from: ident.from,
                to: ident.to,
            };
            menu.innerHTML = buildSymbolActionMarkup(resolved);
            wireSymbolActionButtons(menu, ident, onNavigate, hide);
            const parentRect = parent.getBoundingClientRect();
            menu.style.left = `${clientX - parentRect.left + 10}px`;
            menu.style.top = `${clientY - parentRect.top + 10}px`;
            menu.hidden = false;
        },
        hide,
        destroy() {
            window.removeEventListener('mousedown', dismissOnWindowMouseDown, true);
            menu.remove();
        },
    };
}

function createNavigationKeymap(
    onNavigate: (offset: number, action: NavigationAction) => void,
): Extension {
    return keymap.of([
        {
            key: 'F12',
            run(view) {
                onNavigate(view.state.selection.main.head, 'definition');
                return true;
            },
        },
        {
            key: 'Shift-F12',
            run(view) {
                onNavigate(view.state.selection.main.head, 'references');
                return true;
            },
        },
    ]);
}

function computeIndentLevel(text: string): number {
    let indent = 0;
    for (const char of text) {
        if (char === ' ') indent += 1;
        else if (char === '\t') indent += 4;
        else break;
    }
    return indent;
}

function computeFoldRange(state: EditorState, lineStart: number): { from: number; to: number } | null {
    const line = state.doc.lineAt(lineStart);
    const trimmed = line.text.trim();
    if (!trimmed) {
        return null;
    }

    if (trimmed.startsWith('"""')) {
        for (let number = line.number + 1; number <= state.doc.lines; number += 1) {
            const candidate = state.doc.line(number);
            if (candidate.text.trim().startsWith('"""')) {
                return candidate.from > line.to ? { from: line.to, to: candidate.from } : null;
            }
        }
        return null;
    }

    if (!trimmed.endsWith(':')) {
        return null;
    }

    const baseIndent = computeIndentLevel(line.text);
    let firstBodyLine: number | null = null;
    let lastBodyLine: number | null = null;

    for (let number = line.number + 1; number <= state.doc.lines; number += 1) {
        const candidate = state.doc.line(number);
        const candidateTrimmed = candidate.text.trim();
        if (!candidateTrimmed) {
            if (firstBodyLine !== null) {
                lastBodyLine = number;
            }
            continue;
        }

        const candidateIndent = computeIndentLevel(candidate.text);
        if (candidateIndent <= baseIndent) {
            break;
        }

        if (firstBodyLine === null) {
            firstBodyLine = number;
        }
        lastBodyLine = number;
    }

    if (firstBodyLine === null || lastBodyLine === null) {
        return null;
    }

    const lastLine = state.doc.line(lastBodyLine);
    return lastLine.to > line.to ? { from: line.to, to: lastLine.to } : null;
}

function createSimpleFoldExtensions(): Extension[] {
    return [
        codeFolding(),
        foldGutter(),
        foldService.of((state, lineStart) => computeFoldRange(state, lineStart)),
    ];
}

// ── VS Code theme for CodeMirror ─────────────────────────────────────

const vsCodeTheme = EditorView.theme({
    '&': {
        height: '100%',
        fontSize: 'var(--vscode-editor-font-size)',
        fontFamily: 'var(--vscode-editor-font-family)',
        backgroundColor: 'var(--vscode-editor-background)',
        color: 'var(--vscode-editor-foreground)',
    },
    '.cm-content': {
        caretColor: 'var(--vscode-editorCursor-foreground)',
        lineHeight: '1.5',
    },
    '.cm-line': {
        paddingTop: '0',
        paddingBottom: '0',
    },
    '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: 'var(--vscode-editorCursor-foreground)',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
        backgroundColor: 'var(--vscode-editor-selectionBackground)',
    },
    '.cm-activeLine': {
        backgroundColor: 'var(--vscode-editor-lineHighlightBackground)',
    },
    '.cm-gutters': {
        backgroundColor: 'var(--vscode-editorGutter-background, var(--vscode-editor-background))',
        color: 'var(--vscode-editorLineNumber-foreground)',
        border: 'none',
    },
    '.cm-rich-line-number-marker': {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        width: '100%',
        boxSizing: 'border-box',
    },
    '&.simple-rich-center-line-numbers .cm-rich-line-number-marker': {
        alignItems: 'center',
    },
    '.cm-activeLineGutter': {
        backgroundColor: 'var(--vscode-editor-lineHighlightBackground)',
        color: 'var(--vscode-editorLineNumber-activeForeground)',
    },
    '.cm-matchingBracket': {
        backgroundColor: 'var(--vscode-editorBracketMatch-background)',
        outline: '1px solid var(--vscode-editorBracketMatch-border)',
    },
    '.cm-searchMatch': {
        backgroundColor: 'var(--vscode-editor-findMatchHighlightBackground)',
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
        backgroundColor: 'var(--vscode-editor-findMatchBackground)',
    },
    // Math widget
    '.cm-math-widget': {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '1px 8px',
        margin: '0',
        borderRadius: '4px',
        backgroundColor: 'transparent',
        border: '1px solid var(--simple-rich-block-border)',
        verticalAlign: 'middle',
        cursor: 'pointer',
    },
    '.cm-math-widget-block': {
        display: 'flex',
        width: 'fit-content',
        maxWidth: '100%',
        margin: '0',
        paddingTop: '0',
        paddingBottom: '0',
        minHeight: '0',
    },
    '.cm-math-widget-block .katex-display': {
        margin: '0',
    },
    '.cm-math-rendered': {
        display: 'inline-block',
        color: 'var(--vscode-editor-foreground)',
    },
    '.cm-math-rendered .katex': {
        color: 'inherit',
    },
    '.cm-math-rendered .frac-line': {
        borderBottomWidth: '0.09em !important',
        minHeight: '0.09em',
    },
    '.cm-math-label': {
        fontSize: '0.75em',
        fontWeight: '600',
        color: 'var(--vscode-editorLineNumber-foreground)',
        padding: '0 4px',
        borderRadius: '3px',
        backgroundColor: 'var(--simple-rich-label-bg)',
    },
    // Image widget
    '.cm-image-widget': {
        display: 'inline-flex',
        verticalAlign: 'middle',
        alignItems: 'center',
        padding: '6px 8px',
        margin: '2px 0',
        borderRadius: '6px',
        backgroundColor: 'transparent',
        border: '1px solid var(--simple-rich-block-border)',
        textAlign: 'center',
        maxWidth: '100%',
    },
    '.cm-image-widget img': {
        borderRadius: '4px',
        boxShadow: '0 1px 4px color-mix(in srgb, black 20%, transparent)',
    },
    // Error & placeholder
    '.cm-image-error': {
        display: 'inline-block',
        padding: '4px 8px',
        borderRadius: '4px',
        color: 'var(--vscode-errorForeground)',
        backgroundColor: 'color-mix(in srgb, var(--vscode-errorForeground) 10%, transparent)',
        fontStyle: 'italic',
        fontSize: '0.9em',
    },
    '.cm-placeholder-widget': {
        display: 'inline-block',
        padding: '2px 6px',
        borderRadius: '4px',
        backgroundColor: 'transparent',
        border: '1px solid var(--simple-rich-block-border)',
        color: 'var(--vscode-descriptionForeground)',
        fontStyle: 'italic',
        fontSize: '0.9em',
    },
    '.cm-breakpoint-gutter, .cm-bookmark-gutter, .cm-pointer-gutter, .cm-test-run-gutter': {
        width: '16px',
        minWidth: '16px',
    },
    '.cm-foldGutter': {
        width: '16px',
        minWidth: '16px',
    },
    '.cm-foldGutter .cm-gutterElement': {
        width: '16px',
        padding: '0 2px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--vscode-editorLineNumber-foreground)',
    },
    '.cm-breakpoint-gutter .cm-gutterElement, .cm-bookmark-gutter .cm-gutterElement, .cm-pointer-gutter .cm-gutterElement, .cm-test-run-gutter .cm-gutterElement': {
        width: '16px',
        padding: '0 2px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    '.cm-test-gutter-icon': {
        display: 'inline-block',
        width: '0',
        height: '0',
        borderTop: '4px solid transparent',
        borderBottom: '4px solid transparent',
        borderLeft: '7px solid var(--vscode-testing-runAction, var(--vscode-debugIcon-startForeground, var(--vscode-terminal-ansiGreen, #89d185)))',
        opacity: '0.95',
    },
    '.cm-test-gutter-icon-spacer': {
        borderLeftColor: 'transparent',
        opacity: '0',
    },
    '.cm-test-gutter-icon-structure': {
        width: '8px',
        height: '8px',
        border: '1px solid var(--vscode-editorLineNumber-foreground)',
        borderRadius: '50%',
        borderTop: '1px solid var(--vscode-editorLineNumber-foreground)',
        borderBottom: '1px solid var(--vscode-editorLineNumber-foreground)',
        borderLeft: '1px solid var(--vscode-editorLineNumber-foreground)',
        opacity: '0.75',
    },
    '.cm-test-gutter-icon-running': {
        width: '8px',
        height: '8px',
        border: '1px solid var(--vscode-testing-runAction, var(--vscode-debugIcon-startForeground, var(--vscode-terminal-ansiGreen, #89d185)))',
        borderRadius: '50%',
        backgroundColor: 'color-mix(in srgb, var(--vscode-testing-runAction, var(--vscode-debugIcon-startForeground, var(--vscode-terminal-ansiGreen, #89d185))) 18%, transparent)',
    },
    '.cm-test-gutter-icon-passed': {
        width: '8px',
        height: '8px',
        border: '1px solid var(--vscode-testing-iconPassed, var(--vscode-terminal-ansiGreen, #89d185))',
        borderRadius: '50%',
        backgroundColor: 'var(--vscode-testing-iconPassed, var(--vscode-terminal-ansiGreen, #89d185))',
    },
    '.cm-test-gutter-icon-failed': {
        width: '8px',
        height: '8px',
        border: '1px solid var(--vscode-testing-iconFailed, var(--vscode-errorForeground, #f14c4c))',
        borderRadius: '50%',
        backgroundColor: 'var(--vscode-testing-iconFailed, var(--vscode-errorForeground, #f14c4c))',
    },
    '.cm-breakpoint-gutter-icon': {
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: 'transparent',
    },
    '.cm-breakpoint-gutter-icon-active': {
        backgroundColor: 'var(--vscode-debugIcon-breakpointForeground, var(--vscode-editorError-foreground, #e51400))',
        boxShadow: '0 0 0 1px color-mix(in srgb, black 15%, transparent)',
    },
    '.cm-breakpoint-gutter-icon-spacer': {
        backgroundColor: 'transparent',
    },
    '.cm-bookmark-gutter-icon': {
        display: 'inline-block',
        width: '10px',
        height: '10px',
        backgroundColor: 'transparent',
        clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 92%, 50% 70%, 21% 92%, 32% 57%, 2% 35%, 39% 35%)',
    },
    '.cm-bookmark-gutter-icon-active': {
        backgroundColor: 'var(--vscode-editorInfo-foreground, #0969da)',
    },
    '.cm-bookmark-gutter-icon-spacer': {
        backgroundColor: 'transparent',
    },
    '.cm-pointer-gutter-icon': {
        display: 'inline-block',
        width: '0',
        height: '0',
        borderTop: '5px solid transparent',
        borderBottom: '5px solid transparent',
        borderLeft: '8px solid transparent',
    },
    '.cm-pointer-gutter-icon-active': {
        borderLeftColor: 'var(--vscode-debugIcon-continueForeground, var(--vscode-terminal-ansiYellow, #f2cc60))',
    },
    '.cm-pointer-gutter-icon-spacer': {
        opacity: '0',
    },
    '.simple-rich-hover-tooltip': {
        zIndex: '20',
        minWidth: '140px',
        maxWidth: '240px',
        padding: '8px 10px',
        borderRadius: '6px',
        border: '1px solid color-mix(in srgb, var(--vscode-editorHoverWidget-border) 70%, transparent)',
        backgroundColor: 'var(--vscode-editorHoverWidget-background)',
        color: 'var(--vscode-editorHoverWidget-foreground)',
        boxShadow: '0 6px 20px color-mix(in srgb, black 25%, transparent)',
        pointerEvents: 'auto',
        fontSize: '12px',
        lineHeight: '1.4',
    },
    '.simple-rich-action-menu': {
        position: 'absolute',
        zIndex: '24',
        minWidth: '160px',
        maxWidth: '260px',
        padding: '8px 10px',
        borderRadius: '6px',
        border: '1px solid color-mix(in srgb, var(--vscode-editorHoverWidget-border) 70%, transparent)',
        backgroundColor: 'var(--vscode-editorHoverWidget-background)',
        color: 'var(--vscode-editorHoverWidget-foreground)',
        boxShadow: '0 6px 20px color-mix(in srgb, black 25%, transparent)',
    },
    '.simple-rich-hover-actions': {
        display: 'flex',
        gap: '6px',
        marginTop: '8px',
    },
    '.simple-rich-hover-actions button': {
        border: '1px solid color-mix(in srgb, var(--vscode-button-border, transparent) 80%, transparent)',
        borderRadius: '4px',
        backgroundColor: 'var(--vscode-button-secondaryBackground, color-mix(in srgb, var(--vscode-button-background) 30%, transparent))',
        color: 'var(--vscode-button-secondaryForeground, var(--vscode-button-foreground))',
        padding: '2px 8px',
        fontSize: '11px',
        cursor: 'pointer',
        pointerEvents: 'auto',
    },
    '.simple-rich-hover-actions button:hover': {
        backgroundColor: 'var(--vscode-button-secondaryHoverBackground, var(--vscode-button-hoverBackground))',
    },
}, { dark: true });

const simpleHighlightStyle = HighlightStyle.define([
    { tag: tags.keyword, color: 'var(--vscode-symbolIcon-keywordForeground, #c586c0)' },
    { tag: tags.typeName, color: 'var(--vscode-symbolIcon-classForeground, #4ec9b0)' },
    { tag: tags.variableName, color: 'var(--vscode-symbolIcon-variableForeground, #9cdcfe)' },
    { tag: tags.string, color: 'var(--vscode-symbolIcon-stringForeground, #ce9178)' },
    { tag: tags.number, color: 'var(--vscode-symbolIcon-numberForeground, #b5cea8)' },
    { tag: tags.lineComment, color: 'var(--vscode-symbolIcon-commentForeground, #6a9955)', fontStyle: 'italic' },
    { tag: tags.operator, color: 'var(--vscode-symbolIcon-operatorForeground, #d4d4d4)' },
    { tag: tags.bracket, color: 'var(--vscode-editorBracketHighlight-foreground1, #ffd700)' },
    { tag: tags.atom, color: 'var(--vscode-symbolIcon-constantForeground, #569cd6)', fontStyle: 'italic' },
]);

// ── Editor creation ──────────────────────────────────────────────────

function createEditor(
    parent: HTMLElement,
    initialText: string,
    renderedBlocksRef: { current: Map<string, RenderableBlockInfo> },
    symbolsRef: { current: RichEditorSymbol[] },
    testsRef: { current: RichEditorTestBlock[] },
    markersRef: { current: RichEditorMarkers },
    onEdit: (text: string, selStart: number, selEnd: number) => void,
    onSelectionChange: (selStart: number, selEnd: number) => void,
    onRunTest: (test: RichEditorTestBlock) => void,
    onToggleBreakpoint: (line: number) => void,
    onToggleBookmark: (line: number) => void,
    onTogglePointer: (line: number) => void,
    onNavigate: (offset: number, action: NavigationAction) => void,
): {
    view: EditorView;
    refreshDecorations: () => void;
    setDoc: (text: string, selStart?: number, selEnd?: number) => void;
    destroy: () => void;
} {
    let isApplyingSync = false;
    let editTimer: ReturnType<typeof setTimeout> | null = null;

    const decorationPlugin = createDecorationPlugin(() => renderedBlocksRef.current);
    const fullLineMathField = ENABLE_FULL_LINE_BLOCK_MATH
        ? createFullLineMathField(() => renderedBlocksRef.current)
        : null;
    const testRunGutter = ENABLE_TEST_LINE_WIDGETS
        ? createTestRunGutter(() => testsRef.current, onRunTest)
        : null;
    const breakpointGutter = createBreakpointGutter(() => markersRef.current, onToggleBreakpoint);
    const bookmarkGutter = createBookmarkGutter(() => markersRef.current, onToggleBookmark);
    const pointerGutter = createPointerGutter(() => markersRef.current, onTogglePointer);
    const symbolHover = ENABLE_SYMBOL_HOVER
        ? createSymbolHoverTooltip(() => symbolsRef.current, onNavigate)
        : null;
    const actionMenu = createActionMenu(parent, onNavigate);

    const editListener = EditorView.updateListener.of((update) => {
        if (isApplyingSync) return;

        if (update.docChanged) {
            if (editTimer) clearTimeout(editTimer);
            editTimer = setTimeout(() => {
                const sel = update.view.state.selection.main;
                onEdit(update.view.state.doc.toString(), sel.anchor, sel.head);
            }, 120);
        } else if (update.selectionSet) {
            const sel = update.view.state.selection.main;
            onSelectionChange(sel.anchor, sel.head);
        }
    });

    const navigationClickHandler = EditorView.domEventHandlers({
        mousedown(event, view) {
            const wantsDefinition = event.metaKey || event.ctrlKey;
            if (!wantsDefinition) {
                return false;
            }

            const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
            if (pos === null || !readIdentifierAt(view.state, pos)) {
                return false;
            }

            event.preventDefault();
            const ident = readIdentifierAt(view.state, pos)!;
            const symbol = resolveSymbolForIdentifier(symbolsRef.current, ident);
            actionMenu.show(event.clientX, event.clientY, ident, symbol);
            return true;
        },
        contextmenu(event, view) {
            const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
            if (pos === null) {
                return false;
            }
            const ident = readIdentifierAt(view.state, pos);
            if (!ident) {
                return false;
            }
            event.preventDefault();
            const symbol = resolveSymbolForIdentifier(symbolsRef.current, ident);
            actionMenu.show(event.clientX, event.clientY, ident, symbol);
            return true;
        },
    });

    const extensions: Extension[] = [
        breakpointGutter,
        bookmarkGutter,
        pointerGutter,
        ...(testRunGutter ? [testRunGutter] : []),
        ...createSimpleFoldExtensions(),
        ...createMathAwareLineNumberSetup(),
        ...(fullLineMathField ? [fullLineMathField] : []),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        drawSelection(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...foldKeymap,
            indentWithTab,
        ]),
        createNavigationKeymap(onNavigate),
        simpleLanguage,
        vsCodeTheme,
        syntaxHighlighting(simpleHighlightStyle),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        decorationPlugin,
        editListener,
        navigationClickHandler,
        ...(symbolHover ? [symbolHover] : []),
    ];

    const state = EditorState.create({
        doc: initialText,
        extensions,
    });
    const view = new EditorView({
        state,
        parent,
    });
    return {
        view,

        refreshDecorations() {
            view.dispatch({
                effects: [refreshRenderedBlocksEffect.of()],
            });
        },

        setDoc(text: string, selStart?: number, selEnd?: number) {
            if (view.state.doc.toString() === text && selStart === undefined) return;

            isApplyingSync = true;
            try {
                const changes = view.state.doc.toString() !== text
                    ? { from: 0, to: view.state.doc.length, insert: text }
                    : undefined;

                const selection = selStart !== undefined
                    ? { anchor: Math.min(selStart, text.length), head: Math.min(selEnd ?? selStart, text.length) }
                    : undefined;

                view.dispatch({
                    ...(changes ? { changes } : {}),
                    ...(selection ? { selection } : {}),
                });
            } finally {
                isApplyingSync = false;
            }
        },
        destroy() {
            actionMenu.destroy();
            view.destroy();
        },
    };
}

// ── Boot: wire up VS Code messaging ──────────────────────────────────

export function boot(vsCodeApi?: { postMessage(msg: unknown): void }): void {
    const vscode = vsCodeApi ?? acquireVsCodeApi();
    const editorContainer = document.getElementById('editor-container');
    if (!editorContainer) return;

    const renderedBlocksRef: { current: Map<string, RenderableBlockInfo> } = {
        current: new Map(),
    };
    const symbolsRef: { current: RichEditorSymbol[] } = { current: [] };
    const testsRef: { current: RichEditorTestBlock[] } = { current: [] };
    const markersRef: { current: RichEditorMarkers } = { current: { breakpoints: [], bookmarks: [], pointerLine: null } };

    let editor: ReturnType<typeof createEditor> | null = null;

    function initEditor(text: string, selStart: number, selEnd: number) {
        editor = createEditor(
            editorContainer!,
            text,
            renderedBlocksRef,
            symbolsRef,
            testsRef,
            markersRef,
            (source, sStart, sEnd) => {
                vscode.postMessage({ type: 'editAll', source, selectionStart: sStart, selectionEnd: sEnd });
            },
            (sStart, sEnd) => {
                vscode.postMessage({ type: 'selectionChanged', selectionStart: sStart, selectionEnd: sEnd });
            },
            (test) => {
                vscode.postMessage({
                    type: 'runTestFromLine',
                    line: test.line,
                    kind: test.kind,
                    label: test.label,
                });
            },
            (line) => {
                vscode.postMessage({
                    type: 'toggleBreakpointFromLine',
                    line,
                });
            },
            (line) => {
                vscode.postMessage({
                    type: 'toggleBookmarkFromLine',
                    line,
                });
            },
            (line) => {
                vscode.postMessage({
                    type: 'togglePointerFromLine',
                    line,
                });
            },
            (offset, action) => {
                vscode.postMessage({
                    type: action === 'definition' ? 'revealDefinition' : 'showReferences',
                    offset,
                });
            },
        );
        if (selStart > 0 || selEnd > 0) {
            editor.setDoc(text, selStart, selEnd);
        }
    }

    window.addEventListener('message', (event) => {
        const msg = event.data as HostMessage;

        if (msg.type === 'sync') {
            applyEditorSettings(msg.settings);
            renderedBlocksRef.current.clear();
            symbolsRef.current = msg.symbols ?? [];
            testsRef.current = msg.tests ?? [];
            markersRef.current = msg.markers ?? { breakpoints: [], bookmarks: [], pointerLine: null };
            if (msg.blocks) {
                for (const block of msg.blocks) {
                    const key = `${block.prefix}:${block.content}`;
                    renderedBlocksRef.current.set(key, block);
                }
            }

            if (!editor) {
                initEditor(msg.sourceText, msg.selectionStart, msg.selectionEnd);
            } else {
                editor.setDoc(msg.sourceText, msg.selectionStart, msg.selectionEnd);
            }
            editor!.refreshDecorations();
        }
    });

    // Request initial state
    vscode.postMessage({ type: 'ready' });
}

(globalThis as typeof globalThis & { RichEditorWebview?: { boot: typeof boot } }).RichEditorWebview = { boot };
