/**
 * Bundle the CodeMirror-based webview editor into a single IIFE file.
 * Output: out/webview/richEditor.js
 */
import * as esbuild from 'esbuild';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

await esbuild.build({
    entryPoints: [path.join(root, 'src', 'webview', 'richEditorWebview.ts')],
    bundle: true,
    format: 'iife',
    globalName: 'RichEditorWebview',
    outfile: path.join(root, 'out', 'webview', 'richEditor.js'),
    platform: 'browser',
    target: 'es2020',
    sourcemap: true,
    minify: false,
    external: [],
});

console.log('[build-webview] out/webview/richEditor.js built');
