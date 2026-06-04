import * as vscode from 'vscode';
import { type DetectedBlock } from './blockDetector';
import { type MathPreview } from './mathPreview';
export interface MathRenderPolicyDecision {
    preview?: MathPreview;
    shouldRender: boolean;
    errorMessage?: string;
}
export declare function resolveMathRenderPolicy(document: vscode.TextDocument, block: DetectedBlock, diagnostics: readonly vscode.Diagnostic[]): MathRenderPolicyDecision | undefined;
