import Zen from "zen";

export interface KeyPair {
	pub: string;
	priv: string;
}

export async function generateKeyPair(): Promise<KeyPair> {
	return Zen.pair() as Promise<KeyPair>;
}

// Zen.secret derives a shared ECDH secret from the recipient's pub + our full pair.
export async function encryptFor(
	text: string,
	recipientPub: string,
	myPair: KeyPair,
): Promise<string> {
	const secret = await Zen.secret(recipientPub, myPair);
	return Zen.encrypt(text, secret);
}

// Returns null if the ciphertext can't be decrypted with this sender/recipient key pair.
export async function decryptFrom(
	cipherText: string,
	senderPub: string,
	myPair: KeyPair,
): Promise<string | null> {
	try {
		const secret = await Zen.secret(senderPub, myPair);
		const decrypted = await Zen.decrypt(cipherText, secret);
		return typeof decrypted === "string" ? decrypted : null;
	} catch {
		return null;
	}
}
