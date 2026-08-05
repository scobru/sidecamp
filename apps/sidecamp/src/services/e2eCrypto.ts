import {
	generateKeyPair as chatGenerateKeyPair,
	encryptFor as chatEncryptFor,
	decryptFrom as chatDecryptFrom,
	decryptPairVault,
} from "@tunecamp/chat";

export interface KeyPair {
	publicKey: string;
	secretKey: string;
}

export async function generateKeyPair(): Promise<KeyPair> {
	const pair = await chatGenerateKeyPair();
	return { publicKey: pair.pub, secretKey: pair.priv };
}

/**
 * Open the account's Zen identity vault — the pair the instance stores as
 * `zen_priv`, encrypted client-side under the login password.
 *
 * This is the keypair peers expect to encrypt to: `GET /api/chat/pubkey`
 * serves the account's `zen_pub`, and a webapp peer will not downgrade to a
 * session key announced over the socket. A Sidecamp that kept using its own
 * locally generated pair would still be able to send, but could not read
 * anything addressed to the account.
 *
 * Returns null when the account has no vault (never provisioned one) or the
 * password does not open it; the caller falls back to a local pair.
 */
export async function openIdentityVault(
	zenPriv: string | null | undefined,
	password: string,
): Promise<KeyPair | null> {
	if (!zenPriv || !password) return null;
	try {
		const pair = await decryptPairVault(zenPriv, password);
		if (!pair?.pub || !pair?.priv) return null;
		return { publicKey: pair.pub, secretKey: pair.priv };
	} catch {
		return null;
	}
}

export async function encryptFor(
	text: string,
	recipientPublicKeyB64: string,
	mySecretKeyB64: string,
): Promise<string> {
	const myPair = { pub: "", priv: mySecretKeyB64, epub: "", epriv: "" };
	return chatEncryptFor(text, recipientPublicKeyB64, myPair);
}

export async function decryptFrom(
	cipherB64: string,
	senderPublicKeyB64: string,
	mySecretKeyB64: string,
): Promise<string | null> {
	const myPair = { pub: "", priv: mySecretKeyB64, epub: "", epriv: "" };
	return chatDecryptFrom(cipherB64, senderPublicKeyB64, myPair);
}
