import * as vscode from 'vscode';
export declare class SimpleDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
    private enabled;
    provideDocumentSymbols(document: vscode.TextDocument): vscode.DocumentSymbol[];
    setEnabled(enabled: boolean): void;
}
export declare class SimpleWorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider<vscode.SymbolInformation> {
    private enabled;
    provideWorkspaceSymbols(query: string): Promise<vscode.SymbolInformation[]>;
    setEnabled(enabled: boolean): void;
}
export declare class SimpleDefinitionProvider implements vscode.DefinitionProvider {
    private enabled;
    provideDefinition(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Definition | undefined>;
    setEnabled(enabled: boolean): void;
}
export declare class SimpleReferenceProvider implements vscode.ReferenceProvider {
    private enabled;
    provideReferences(document: vscode.TextDocument, position: vscode.Position, context: vscode.ReferenceContext): Promise<vscode.Location[]>;
    setEnabled(enabled: boolean): void;
}
export declare class SimpleHoverProvider implements vscode.HoverProvider {
    private enabled;
    provideHover(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Hover | undefined>;
    setEnabled(enabled: boolean): void;
}
