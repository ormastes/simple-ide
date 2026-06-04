/**
 * CodeMirror 6 decoration plugin with cursor-aware view mode.
 *
 * Non-cursor blocks → rendered widgets (math/image at natural height)
 * Cursor block → raw source text for editing
 */

import {
    ViewPlugin, ViewUpdate, Decoration, DecorationSet,
    type PluginValue, EditorView,
} from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { MathWidget } from './widgets/mathWidget';
import { ImageWidget } from './widgets/imageWidget';
import { MathPlaceholderWidget, ImagePlaceholderWidget, ImageErrorWidget } from './widgets/placeholderWidget';

// ── Types ────────────────────────────────────────────────────────────

export interface RenderableBlockInfo {
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
}

// ── Block detection (webview-side, mirrors host) ─────────────────────

const BLOCK_REGEX = /\b(?<prefix>m|loss|nograd|img|graph)\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gs;

function isWholeTrimmedLine(view: EditorView, from: number, to: number): boolean {
    const line = view.state.doc.lineAt(from);
    const text = view.state.doc.sliceString(line.from, line.to);
    const leading = text.length - text.trimStart().length;
    const trailing = text.length - text.trimEnd().length;
    return line.from + leading === from && line.to - trailing === to;
}

function detectBlockRanges(text: string): Array<{ from: number; to: number; content: string; prefix: string }> {
    const blocks: Array<{ from: number; to: number; content: string; prefix: string }> = [];
    BLOCK_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = BLOCK_REGEX.exec(text)) !== null) {
        blocks.push({
            from: match.index,
            to: match.index + match[0].length,
            content: match[2].trim(),
            prefix: match.groups?.prefix ?? 'm',
        });
    }
    return blocks;
}

// ── Decoration builder ───────────────────────────────────────────────

function buildDecorations(
    view: EditorView,
    renderedBlocks: Map<string, RenderableBlockInfo>,
): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const text = view.state.doc.toString();
    const blocks = detectBlockRanges(text);
    const cursor = view.state.selection.main.head;

    for (const block of blocks) {
        // CURSOR-AWARE REVEAL: cursor in block → show raw source
        if (cursor >= block.from && cursor <= block.to) {
            continue;
        }

        const key = `${block.prefix}:${block.content}`;
        const info = renderedBlocks.get(key);

        if (block.prefix !== 'img' && info?.status === 'error') {
            continue;
        }

        if (block.prefix !== 'img' && info?.renderedHtml && isWholeTrimmedLine(view, block.from, block.to)) {
            continue;
        }

        if (info && info.kind === 'img') {
            if (info.status === 'ok' && info.imageUri) {
                builder.add(block.from, block.to,
                    Decoration.replace({
                        widget: new ImageWidget(info.imageUri, block.content),
                    }),
                );
            } else if (info.status === 'error') {
                builder.add(block.from, block.to,
                    Decoration.replace({
                        widget: new ImageErrorWidget(block.content, info.errorMessage ?? 'Image not found'),
                    }),
                );
            } else {
                builder.add(block.from, block.to,
                    Decoration.replace({
                        widget: new ImagePlaceholderWidget(block.content),
                    }),
                );
            }
        } else if (info && info.renderedHtml) {
            // Math / loss / nograd / graph
            builder.add(block.from, block.to,
                Decoration.replace({
                    widget: new MathWidget(info.renderedHtml, block.prefix, block.content),
                }),
            );
        } else if (block.prefix === 'img') {
            // Placeholder until host sends rendered content
            builder.add(block.from, block.to,
                Decoration.replace({
                    widget: new MathPlaceholderWidget(block.content, block.prefix),
                }),
            );
        }
    }

    return builder.finish();
}

// ── Plugin ───────────────────────────────────────────────────────────

interface RichPluginState extends PluginValue {
    decorations: DecorationSet;
}

export function createDecorationPlugin(
    getRenderedBlocks: () => Map<string, RenderableBlockInfo>,
) {
    return ViewPlugin.define<RichPluginState>((view) => ({
        decorations: buildDecorations(view, getRenderedBlocks()),
        update(update: ViewUpdate) {
            if (update.docChanged || update.selectionSet) {
                this.decorations = buildDecorations(update.view, getRenderedBlocks());
            }
        },
    }), {
        decorations: (v) => v.decorations,
    });
}
