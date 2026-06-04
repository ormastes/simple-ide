import * as vscode from 'vscode';
export declare class TestUtils {
    static createTestFile(filename: string, content: string): Promise<vscode.TextDocument>;
    static deleteTestFile(filename: string): void;
    static closeAllEditors(): Promise<void>;
    static getActiveEditor(): vscode.TextEditor | undefined;
    static setCursorPosition(editor: vscode.TextEditor, line: number, character: number): Promise<void>;
}
