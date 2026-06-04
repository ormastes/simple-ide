"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const editorMarkers_1 = require("../../testing/editorMarkers");
const testUtils_1 = require("../helpers/testUtils");
class MemoryMemento {
    constructor() {
        this.values = new Map();
    }
    keys() {
        return Array.from(this.values.keys());
    }
    get(key, defaultValue) {
        return this.values.has(key) ? this.values.get(key) : defaultValue;
    }
    async update(key, value) {
        this.values.set(key, value);
    }
}
suite('editor markers', () => {
    let manager;
    teardown(async () => {
        manager?.dispose();
        manager = undefined;
        await testUtils_1.TestUtils.closeAllEditors();
        testUtils_1.TestUtils.deleteTestFile('marker-demo.spl');
    });
    test('tracks marker state and bookmark navigation', async () => {
        const document = await testUtils_1.TestUtils.createTestFile('marker-demo.spl', [
            'fn first(): i32 = 1',
            'fn second(): i32 = 2',
            'fn third(): i32 = 3',
            'fn fourth(): i32 = 4',
        ].join('\n'));
        const editor = testUtils_1.TestUtils.getActiveEditor();
        assert.ok(editor, 'expected active editor');
        manager = new editorMarkers_1.EditorMarkerManager();
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
        await testUtils_1.TestUtils.setCursorPosition(editor, 0, 0);
        manager.jumpToNextBookmark(editor);
        assert.strictEqual(editor.selection.active.line, 1);
        await testUtils_1.TestUtils.setCursorPosition(editor, 3, 0);
        manager.jumpToPreviousBookmark(editor);
        assert.strictEqual(editor.selection.active.line, 1);
    });
    test('restores bookmarks and pointer from workspace state', async () => {
        const storage = new MemoryMemento();
        const document = await testUtils_1.TestUtils.createTestFile('marker-demo.spl', [
            'fn first(): i32 = 1',
            'fn second(): i32 = 2',
            'fn third(): i32 = 3',
        ].join('\n'));
        manager = new editorMarkers_1.EditorMarkerManager(storage);
        manager.toggleBookmark(document.uri, 0);
        manager.toggleBookmark(document.uri, 2);
        manager.togglePointer(document.uri, 1);
        manager.dispose();
        manager = new editorMarkers_1.EditorMarkerManager(storage);
        const state = manager.getState(document.uri);
        assert.deepStrictEqual(state.breakpoints, []);
        assert.deepStrictEqual(state.bookmarks, [0, 2]);
        assert.strictEqual(state.pointerLine, 1);
    });
});
//# sourceMappingURL=editorMarkers.test.js.map