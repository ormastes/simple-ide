import * as assert from 'assert';
import * as vscode from 'vscode';
import { EditorMarkerManager } from '../../testing/editorMarkers';
import { TestUtils } from '../helpers/testUtils';

class MemoryMemento implements vscode.Memento {
    private readonly values = new Map<string, unknown>();

    public keys(): readonly string[] {
        return Array.from(this.values.keys());
    }

    public get<T>(key: string): T | undefined;
    public get<T>(key: string, defaultValue: T): T;
    public get<T>(key: string, defaultValue?: T): T | undefined {
        return this.values.has(key) ? this.values.get(key) as T : defaultValue;
    }

    public async update(key: string, value: unknown): Promise<void> {
        this.values.set(key, value);
    }
}

suite('editor markers', () => {
    let manager: EditorMarkerManager | undefined;

    teardown(async () => {
        manager?.dispose();
        manager = undefined;
        await TestUtils.closeAllEditors();
        TestUtils.deleteTestFile('marker-demo.spl');
    });

    test('tracks marker state and bookmark navigation', async () => {
        const document = await TestUtils.createTestFile(
            'marker-demo.spl',
            [
                'fn first(): i32 = 1',
                'fn second(): i32 = 2',
                'fn third(): i32 = 3',
                'fn fourth(): i32 = 4',
            ].join('\n'),
        );
        const editor = TestUtils.getActiveEditor();
        assert.ok(editor, 'expected active editor');

        manager = new EditorMarkerManager();

        manager.toggleBreakpoint(document.uri, 0);
        manager.toggleBookmark(document.uri, 1);
        manager.toggleBookmark(document.uri, 3);
        manager.togglePointer(document.uri, 2);

        let state = manager.getState(document.uri);
        assert.deepStrictEqual(state.breakpoints, [0]);
        assert.deepStrictEqual(state.bookmarks, [1, 3]);
        assert.strictEqual(state.pointerLine, 2);

        manager.toggleBreakpoint(document.uri, 0);
        manager.togglePointer(document.uri, 2);
        state = manager.getState(document.uri);
        assert.deepStrictEqual(state.breakpoints, []);
        assert.strictEqual(state.pointerLine, null);

        await TestUtils.setCursorPosition(editor!, 0, 0);
        manager.jumpToNextBookmark(editor!);
        assert.strictEqual(editor!.selection.active.line, 1);

        await TestUtils.setCursorPosition(editor!, 3, 0);
        manager.jumpToPreviousBookmark(editor!);
        assert.strictEqual(editor!.selection.active.line, 1);
    });

    test('restores bookmarks and pointer from workspace state', async () => {
        const storage = new MemoryMemento();
        const document = await TestUtils.createTestFile(
            'marker-demo.spl',
            [
                'fn first(): i32 = 1',
                'fn second(): i32 = 2',
                'fn third(): i32 = 3',
            ].join('\n'),
        );

        manager = new EditorMarkerManager(storage);
        manager.toggleBookmark(document.uri, 0);
        manager.toggleBookmark(document.uri, 2);
        manager.togglePointer(document.uri, 1);
        manager.dispose();

        manager = new EditorMarkerManager(storage);
        const state = manager.getState(document.uri);
        assert.deepStrictEqual(state.breakpoints, []);
        assert.deepStrictEqual(state.bookmarks, [0, 2]);
        assert.strictEqual(state.pointerLine, 1);
    });
});
