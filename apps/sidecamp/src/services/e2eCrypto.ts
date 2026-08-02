import {
	generateKeyPair as chatGenerateKeyPair,
	encryptFor as chatEncryptFor,
	decryptFrom as chatDecryptFrom,
} from '@tunecamp/chat';

export interface KeyPair {
	publicKey: string;
	secretKey: string;
}

export async function generateKeyPair(): Promise<KeyPair> {
	const pair = await chatGenerateKeyPair();
	return { publicKey: pair.pub, secretKey: pair.priv };
}

export async function encryptFor(text: string, recipientPublicKeyB64: string, mySecretKeyB64: string): Promise<string> {
	const myPair = { pub: '', priv: mySecretKeyB64, epub: '', epriv: '' };
	return chatEncryptFor(text, recipientPublicKeyB64, myPair);
}

export async function decryptFrom(cipherB64: string, senderPublicKeyB64: string, mySecretKeyB64: string): Promise<string | null> {
	const myPair = { pub: '', priv: mySecretKeyB64, epub: '', epriv: '' };
	return chatDecryptFrom(cipherB64, senderPublicKeyB64, myPair);
}