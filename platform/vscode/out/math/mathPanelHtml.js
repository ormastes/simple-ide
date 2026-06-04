"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMathPreviewPanelHtml = buildMathPreviewPanelHtml;
exports.buildMathSyncPanelHtml = buildMathSyncPanelHtml;
const webviewNonce_1 = require("../webviewNonce");
const mathPanelShared_1 = require("./mathPanelShared");
function buildBaseStyles() {
    return `
        * { box-sizing: border-box; }
        body {
            margin: 0;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
        }
        .panel-shell {
            min-height: 100vh;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .panel-header {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: center;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .panel-title {
            font-size: 14px;
            font-weight: 600;
        }
        .panel-subtitle {
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
        }
        .panel-grid {
            display: grid;
            gap: 12px;
        }
        .card {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            background: var(--vscode-sideBar-background);
            padding: 12px;
        }
        .section-label {
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.4px;
            text-transform: uppercase;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
        }
        .empty-state {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }
        .status {
            border-radius: 6px;
            padding: 8px 10px;
            font-size: 12px;
            line-height: 1.5;
        }
        .status-info {
            background: var(--vscode-editor-inactiveSelectionBackground);
            color: var(--vscode-descriptionForeground);
        }
        .status-ok {
            background: color-mix(in srgb, var(--vscode-testing-iconPassed, #388a34) 18%, transparent);
            color: var(--vscode-testing-iconPassed, #388a34);
        }
        .status-error {
            background: color-mix(in srgb, var(--vscode-errorForeground, #f14c4c) 18%, transparent);
            color: var(--vscode-errorForeground, #f14c4c);
        }
        .math-preview {
            display: flex;
            flex-direction: column;
            gap: 8px;
            align-items: flex-start;
            padding: 14px 12px;
            border-radius: 8px;
            border: 1px solid color-mix(in srgb, var(--vscode-editor-foreground) 14%, transparent);
            background: color-mix(in srgb, var(--vscode-editor-foreground) 4%, transparent);
        }
        .math-indicator {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
            letter-spacing: 0.4px;
        }
        .math-rendered {
            font-family: var(--vscode-editor-font-family);
            font-size: 1.2em;
            white-space: pre-wrap;
            word-break: break-word;
            line-height: 1.4;
        }
        .math-source {
            white-space: pre-wrap;
            word-break: break-word;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            line-height: 1.45;
        }
        .selection-highlight {
            background: color-mix(in srgb, var(--vscode-editor-findMatchHighlightBackground) 85%, transparent);
            border-radius: 2px;
            padding: 0 1px;
        }
        .selection-caret {
            color: var(--vscode-focusBorder);
            font-weight: 700;
        }
        textarea.math-source-input {
            width: 100%;
            min-height: 180px;
            resize: vertical;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            line-height: 1.5;
            padding: 12px;
            outline: none;
        }
        textarea.math-source-input:focus {
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 0 0 1px var(--vscode-focusBorder) inset;
        }
        .math-strip {
            display: flex;
            flex-direction: column;
            gap: 8px;
            max-height: 34vh;
            overflow: auto;
        }
        .math-strip-item {
            cursor: pointer;
            border-radius: 8px;
            border: 1px solid color-mix(in srgb, var(--vscode-editor-foreground) 12%, transparent);
            background: color-mix(in srgb, var(--vscode-editor-foreground) 4%, transparent);
            padding: 8px 10px;
        }
        .math-strip-item:hover {
            background: color-mix(in srgb, var(--vscode-editor-foreground) 8%, transparent);
        }
        .math-strip-item.active {
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 0 0 1px var(--vscode-focusBorder) inset;
        }
        .math-strip-label {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 4px;
        }
    `;
}
function panelShell(title, subtitle, body) {
    const nonce = (0, webviewNonce_1.createWebviewNonce)();
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>${(0, mathPanelShared_1.escapeForHtml)(title)}</title>
    <style>${buildBaseStyles()}</style>
</head>
<body>
    <div class="panel-shell">
        <div class="panel-header">
            <div>
                <div class="panel-title">${(0, mathPanelShared_1.escapeForHtml)(title)}</div>
                <div class="panel-subtitle">${(0, mathPanelShared_1.escapeForHtml)(subtitle)}</div>
            </div>
        </div>
        ${body}
    </div>
</body>
</html>`;
}
function buildMathPreviewPanelHtml(state) {
    const block = state.block;
    const rendered = block
        ? `<div class="math-preview">
                <div class="math-indicator">${(0, mathPanelShared_1.escapeForHtml)(`${block.indicator} ${block.label}`.trim())}</div>
                <div class="math-rendered">${(0, mathPanelShared_1.escapeForHtml)(block.pretty)}</div>
            </div>`
        : `<div class="empty-state">Move the caret into a math block to render it.</div>`;
    const source = block
        ? `<div class="math-source">${(0, mathPanelShared_1.escapeForHtml)(block.content)}</div>`
        : `<div class="empty-state">No active math block.</div>`;
    const statusClass = `status-${state.statusKind}`;
    return panelShell('Math Preview', 'Char-based preview for the active math block', `
        <div class="panel-grid">
            <div class="card">
                <div class="section-label">Status</div>
                <div class="status ${statusClass}">${(0, mathPanelShared_1.escapeForHtml)(state.statusMessage)}</div>
            </div>
            <div class="card">
                <div class="section-label">Rendered</div>
                ${rendered}
            </div>
            <div class="card">
                <div class="section-label">Source</div>
                ${source}
            </div>
        </div>
        `);
}
function buildMathSyncPanelHtml(state) {
    const initialState = (0, mathPanelShared_1.serializeForScript)(state);
    const nonce = (0, webviewNonce_1.createWebviewNonce)();
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Math Sync Panel</title>
    <style>${buildBaseStyles()}</style>
</head>
<body>
    <div class="panel-shell">
        <div class="panel-header">
            <div>
                <div class="panel-title">Math Sync Panel</div>
                <div class="panel-subtitle">Editable source with mirrored active block preview</div>
            </div>
            <div class="panel-subtitle" id="selection-label">0-0</div>
        </div>

        <div class="panel-grid" style="grid-template-columns: minmax(0, 1fr) minmax(280px, 0.9fr); align-items: start;">
            <div class="card" style="display:flex; flex-direction:column; gap:12px;">
                <div class="section-label">Source</div>
                <textarea id="math-source" class="math-source-input" spellcheck="false"></textarea>
                <div class="section-label">Math Blocks</div>
                <div id="math-strip" class="math-strip"></div>
            </div>

            <div class="card" style="display:flex; flex-direction:column; gap:12px;">
                <div class="section-label">Status</div>
                <div id="render-status" class="status ${state.statusKind === 'error' ? 'status-error' : state.statusKind === 'ok' ? 'status-ok' : 'status-info'}">${(0, mathPanelShared_1.escapeForHtml)(state.statusMessage)}</div>
                <div class="section-label">Rendered</div>
                <div id="rendered" class="math-preview">
                    ${state.activeBlock ? `
                        <div class="math-indicator">${(0, mathPanelShared_1.escapeForHtml)(`${state.activeBlock.indicator} ${state.activeBlock.label}`.trim())}</div>
                        <div class="math-rendered">${(0, mathPanelShared_1.escapeForHtml)(state.activeBlock.pretty)}</div>
                    ` : '<div class="empty-state">Move the cursor onto a math block in the source editor.</div>'}
                </div>
                <div class="section-label">Source Mirror</div>
                <div id="source-preview" class="math-source">
                    ${state.activeBlock
        ? (0, mathPanelShared_1.buildHighlightedSourcePreview)(state.activeBlock.content, state.activeSelectionStart, state.activeSelectionEnd)
        : '<span class="empty-state">No active math block.</span>'}
                </div>
            </div>
        </div>
    </div>

    <script nonce="${nonce}">
    (function () {
        const vscode = acquireVsCodeApi();
        const source = document.getElementById('math-source');
        const strip = document.getElementById('math-strip');
        const selectionLabel = document.getElementById('selection-label');
        const rendered = document.getElementById('rendered');
        const sourcePreview = document.getElementById('source-preview');
        const renderStatus = document.getElementById('render-status');
        let currentState = ${initialState};
        let isSync = false;
        let editTimer = null;

        function renderStrip() {
            strip.innerHTML = '';
            for (const block of currentState.blocks || []) {
                const item = document.createElement('div');
                item.className = 'math-strip-item';
                if (currentState.activeBlock && block.from === currentState.activeBlock.from && block.to === currentState.activeBlock.to) {
                    item.classList.add('active');
                }

                const label = document.createElement('div');
                label.className = 'math-strip-label';
                label.textContent = block.prefix + '{ } · ' + block.label;
                item.appendChild(label);

                const text = document.createElement('div');
                text.className = 'math-rendered';
                text.textContent = block.pretty;
                item.appendChild(text);

                item.addEventListener('click', () => {
                    source.focus();
                    const start = Math.max(0, Math.min(source.value.length, block.from));
                    const end = Math.max(start, Math.min(source.value.length, block.to));
                    source.selectionStart = start;
                    source.selectionEnd = end;
                    onSelectionChanged();
                });

                strip.appendChild(item);
            }
        }

        function renderCurrentBlock() {
            if (!currentState.activeBlock) {
                rendered.innerHTML = '<div class="empty-state">Move the cursor onto a math block in the source editor.</div>';
                sourcePreview.innerHTML = '<span class="empty-state">No active math block.</span>';
                renderStatus.className = 'status status-info';
                return;
            }

            const block = currentState.activeBlock;
            rendered.innerHTML = '<div class="math-indicator">' + (block.indicator ? block.indicator + ' ' : '') + block.label + '</div>' +
                '<div class="math-rendered">' + escapeHtml(block.pretty) + '</div>';
            sourcePreview.innerHTML = highlightSource(block.content, currentState.activeSelectionStart, currentState.activeSelectionEnd);
            renderStatus.className = 'status status-ok';
        }

        function escapeHtml(value) {
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        function highlightSource(text, start, end) {
            start = Math.max(0, Math.min(text.length, start));
            end = Math.max(start, Math.min(text.length, end));
            const before = escapeHtml(text.slice(0, start));
            const selected = escapeHtml(text.slice(start, end));
            const after = escapeHtml(text.slice(end));
            const selection = selected.length > 0
                ? '<span class="selection-highlight">' + selected + '</span>'
                : '<span class="selection-caret">|</span>';
            return before + selection + after;
        }

        function onSelectionChanged() {
            selectionLabel.textContent = String(source.selectionStart) + '-' + String(source.selectionEnd);
            vscode.postMessage({
                type: 'selectionChanged',
                selectionStart: source.selectionStart,
                selectionEnd: source.selectionEnd,
            });
        }

        source.addEventListener('input', () => {
            if (isSync) {
                return;
            }
            if (editTimer) {
                clearTimeout(editTimer);
            }
            editTimer = setTimeout(() => {
                vscode.postMessage({
                    type: 'editAll',
                    source: source.value,
                    selectionStart: source.selectionStart,
                    selectionEnd: source.selectionEnd,
                });
            }, 120);
        });

        source.addEventListener('keyup', onSelectionChanged);
        source.addEventListener('mouseup', onSelectionChanged);

        window.addEventListener('message', (event) => {
            const msg = event.data;
            if (msg.type === 'sync') {
                currentState = msg.state;
                isSync = true;
                if (source.value !== currentState.sourceText) {
                    const start = source.selectionStart;
                    const end = source.selectionEnd;
                    source.value = currentState.sourceText;
                    source.selectionStart = start;
                    source.selectionEnd = end;
                }
                selectionLabel.textContent = String(currentState.selectionStart) + '-' + String(currentState.selectionEnd);
                renderStrip();
                renderCurrentBlock();
                isSync = false;
                return;
            }
            if (msg.type === 'empty') {
                currentState = msg.state;
                source.value = currentState.sourceText || '';
                selectionLabel.textContent = '0-0';
                renderStrip();
                renderCurrentBlock();
                renderStatus.textContent = msg.message;
                return;
            }
            if (msg.type === 'error') {
                renderStatus.className = 'status status-error';
                renderStatus.textContent = msg.message;
            }
        });

        renderStrip();
        renderCurrentBlock();
        source.value = currentState.sourceText || '';
        source.selectionStart = currentState.selectionStart || 0;
        source.selectionEnd = currentState.selectionEnd || 0;
        selectionLabel.textContent = String(currentState.selectionStart || 0) + '-' + String(currentState.selectionEnd || 0);
        vscode.postMessage({ type: 'ready' });
    })();
    </script>
</body>
</html>`;
}
//# sourceMappingURL=mathPanelHtml.js.map