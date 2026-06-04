import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(scriptDir, '..');
const wasmDir = path.join(extensionRoot, 'wasm');

mkdirSync(wasmDir, { recursive: true });

const explicitSource = process.env.SIMPLE_VSCODE_LSP_WASM_SOURCE?.trim() || '';
const buildDir = process.env.SIMPLE_VSCODE_WASM_BUILD_DIR?.trim() || '';
const inferredSource = buildDir ? path.join(buildDir, 'simple-lsp.wasm') : '';
const sourcePath = [explicitSource, inferredSource].find((candidate) => candidate && existsSync(candidate));

if (!sourcePath) {
    console.log('[stage:wasm] simple-lsp.wasm: skipped (no source found)');
    process.exit(0);
}

const targetPath = path.join(wasmDir, 'simple-lsp.wasm');
copyFileSync(sourcePath, targetPath);
console.log(`[stage:wasm] copied simple-lsp.wasm <- ${sourcePath}`);
