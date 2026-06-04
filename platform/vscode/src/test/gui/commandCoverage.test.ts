import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

suite('command registration coverage', () => {
    test('browser host registers contributed non-AI commands', () => {
        const extensionRoot = path.resolve(__dirname, '..', '..', '..');
        const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'package.json'), 'utf8')) as {
            contributes?: { commands?: Array<{ command?: string }> };
        };
        const browserSource = fs.readFileSync(path.join(extensionRoot, 'src', 'browser', 'extension.ts'), 'utf8');
        const contributed = (manifest.contributes?.commands ?? [])
            .map((entry) => entry.command)
            .filter((command): command is string => !!command && !command.startsWith('simple.ai.'));
        const missing = contributed.filter((command) => !browserSource.includes(`registerCommand('${command}'`) && !browserSource.includes(`registerTextEditorCommand('${command}'`));

        assert.deepStrictEqual(missing, []);
    });
});
