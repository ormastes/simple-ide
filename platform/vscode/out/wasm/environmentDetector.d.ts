export declare enum EnvironmentKind {
    Desktop = "desktop",
    Web = "web",
    Remote = "remote"
}
export declare enum LspMode {
    Auto = "auto",
    Native = "native",
    Wasm = "wasm"
}
export declare function detectEnvironment(): EnvironmentKind;
export declare function determineLspMode(): LspMode;
export declare function shouldUseWasm(): boolean;
export declare function getEnvironmentDescription(): string;
