import * as assert from 'assert';
import * as vscode from 'vscode';
import { createSimpleLspCompatibilitySurface } from '../../lsp';

suite('LSP compatibility hardening', () => {
    test('awaits attached client disposal before completing surface disposal', async () => {
        const surface = createSimpleLspCompatibilitySurface({} as vscode.ExtensionContext);
        let disposed = false;

        surface.attachClient({
            dispose: async () => {
                await new Promise((resolve) => setTimeout(resolve, 25));
                disposed = true;
            },
        });

        await surface.dispose();

        assert.strictEqual(disposed, true);
    });
});
