import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export class TestUtils {
    public static async createTestFile(filename: string, content: string): Promise<vscode.TextDocument> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder found');
        }

        const filePath = path.join(workspaceFolder.uri.fsPath, filename);
        fs.writeFileSync(filePath, content, 'utf-8');

        const uri = vscode.Uri.file(filePath);
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);
        return document;
    }

    public static deleteTestFile(filename: string): void {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const filePath = path.join(workspaceFolder.uri.fsPath, filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }

    public static async closeAllEditors(): Promise<void> {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    public static getActiveEditor(): vscode.TextEditor | undefined {
        return vscode.window.activeTextEditor;
    }

    public static async setCursorPosition(
        editor: vscode.TextEditor,
        line: number,
        character: number,
    ): Promise<void> {
        const position = new vscode.Position(line, character);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position));
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
}
