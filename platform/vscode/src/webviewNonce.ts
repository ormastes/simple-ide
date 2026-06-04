export function createWebviewNonce(): string {
    const bytes = new Uint8Array(16);
    const cryptoLike = (globalThis as {
        crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array };
    }).crypto;

    if (cryptoLike?.getRandomValues) {
        cryptoLike.getRandomValues(bytes);
    } else {
        for (let index = 0; index < bytes.length; index += 1) {
            bytes[index] = Math.floor(Math.random() * 256);
        }
    }

    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
