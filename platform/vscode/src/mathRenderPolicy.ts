import * as vscode from 'vscode';
import { type DetectedBlock } from './blockDetector';
import { buildMathPreview, isMathLikeBlock, type MathPreview } from './mathPreview';

export interface MathRenderPolicyDecision {
    preview?: MathPreview;
    shouldRender: boolean;
    errorMessage?: string;
}

function makeRange(document: vscode.TextDocument, from: number, to: number): vscode.Range {
    return new vscode.Range(document.positionAt(from), document.positionAt(to));
}

function rangesOverlap(a: vscode.Range, b: vscode.Range): boolean {
    return !(a.end.isBeforeOrEqual(b.start) || b.end.isBeforeOrEqual(a.start));
}

function hasBlockingDiagnostic(
    diagnostics: readonly vscode.Diagnostic[],
    range: vscode.Range,
): boolean {
    return diagnostics.some((diagnostic) =>
        rangesOverlap(diagnostic.range, range)
        && (diagnostic.severity === vscode.DiagnosticSeverity.Error
            || diagnostic.severity === vscode.DiagnosticSeverity.Warning),
    );
}

export function resolveMathRenderPolicy(
    document: vscode.TextDocument,
    block: DetectedBlock,
    diagnostics: readonly vscode.Diagnostic[],
): MathRenderPolicyDecision | undefined {
    if (!isMathLikeBlock(block.kind)) {
        return undefined;
    }

    const preview = buildMathPreview(block);
    if (!preview) {
        return {
            shouldRender: false,
            errorMessage: 'Invalid block syntax',
        };
    }

    if (hasBlockingDiagnostic(diagnostics, makeRange(document, block.from, block.to))) {
        return {
            preview,
            shouldRender: false,
            errorMessage: 'Block has warning or error',
        };
    }

    return {
        preview,
        shouldRender: true,
    };
}
