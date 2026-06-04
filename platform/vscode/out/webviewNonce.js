"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebviewNonce = createWebviewNonce;
function createWebviewNonce() {
    const bytes = new Uint8Array(16);
    const cryptoLike = globalThis.crypto;
    if (cryptoLike?.getRandomValues) {
        cryptoLike.getRandomValues(bytes);
    }
    else {
        for (let index = 0; index < bytes.length; index += 1) {
            bytes[index] = Math.floor(Math.random() * 256);
        }
    }
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
//# sourceMappingURL=webviewNonce.js.map