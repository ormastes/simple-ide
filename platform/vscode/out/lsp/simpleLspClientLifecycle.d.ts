import { ExtensionHostServices } from '../services/extensionHostServices';
import { SimpleLspBootstrapHook } from './simpleLspCompatibility';
export interface LspFallbackControls {
    setEnabled(enabled: boolean): void;
}
export interface CreateSimpleLspClientBootstrapOptions {
    services: ExtensionHostServices;
    onRunningStateChanged?: (running: boolean) => void;
    fallbackControls?: LspFallbackControls[];
}
export declare function createSimpleLspClientBootstrap(options: CreateSimpleLspClientBootstrapOptions): SimpleLspBootstrapHook;
