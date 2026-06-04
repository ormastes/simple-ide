/**
 * Math Expression Converter
 *
 * Converts Simple math block syntax to both LaTeX and Unicode previews.
 * The Unicode path is the shared "char-based" preview used by the native
 * VS Code source editor and the rich custom editor.
 */
export declare function simpleToLatex(source: string): string;
export declare function simpleToUnicode(source: string): string;
