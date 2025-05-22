import * as jose from 'jose';

const RSA_ALGORITHM = 'RSA-OAEP-256'; // Algorithm for RSA-OAEP
const KEY_USAGE_ENCRYPT = ['encrypt', 'wrapKey'];
const KEY_USAGE_DECRYPT = ['decrypt', 'unwrapKey'];

// Generate RSA Key Pair
const generateRsaKeyPair = async () => {
    const { publicKey, privateKey } = await jose.generateKeyPair(RSA_ALGORITHM, {
        modulusLength: 2048, // Standard modulus length
        extractable: true    // Make keys extractable
    });
    return { publicKey, privateKey };
};

// Export Key to PEM format (for storing/sharing public key)
const exportPublicKeyToPem = async (publicKey) => {
    const spkiPem = await jose.exportSPKI(publicKey);
    return spkiPem;
};

const exportPrivateKeyToPem = async (privateKey) => {
    const pkcs8Pem = await jose.exportPKCS8(privateKey);
    return pkcs8Pem;
};

// Import Public Key from PEM format
const importPublicKeyFromPem = async (pem) => {
    try {
        const publicKey = await jose.importSPKI(pem, RSA_ALGORITHM);
        return publicKey;
    } catch (error) {
        console.error("Failed to import public key from PEM:", error);
        throw error;
    }
};

// Import Private Key from PEM format
const importPrivateKeyFromPem = async (pem) => {
    try {
        const privateKey = await jose.importPKCS8(pem, RSA_ALGORITHM);
        return privateKey;
    } catch (error) {
        console.error("Failed to import private key from PEM:", error);
        throw error;
    }
};


// Encrypt a message with a public key
const encryptMessage = async (publicKey, message) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    
    const jwe = await new jose.CompactEncrypt(data)
        .setProtectedHeader({ alg: RSA_ALGORITHM, enc: 'A256GCM' }) // JWE standard headers, using the defined RSA_ALGORITHM
        .encrypt(publicKey);
        
    return jwe; // Returns a JWE string
};

// Decrypt a JWE message with a private key
const decryptMessage = async (privateKey, jwe) => {
    try {
        const { plaintext } = await jose.compactDecrypt(jwe, privateKey);
        const decoder = new TextDecoder();
        return decoder.decode(plaintext);
    } catch (error) {
        console.error("Decryption failed:", error);
        // It's common for decryption to fail if the key is wrong or the ciphertext is corrupt
        throw new Error("Failed to decrypt message. Ensure the correct private key is used and the message is not tampered.");
    }
};

const CryptoService = {
    generateRsaKeyPair,
    exportPublicKeyToPem,
    exportPrivateKeyToPem,
    importPublicKeyFromPem,
    importPrivateKeyFromPem,
    encryptMessage,
    decryptMessage,
};

export default CryptoService;
