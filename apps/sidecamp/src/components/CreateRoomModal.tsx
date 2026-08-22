import { useState } from "react";
import { Plus, X, Key, Lock } from "lucide-react";
import { Button } from "./Button";

interface CreateRoomModalProps {
	isOpen: boolean;
	onClose: () => void;
	onCreateRoom: (name: string, isPrivate: boolean, passphrase?: string) => Promise<boolean>;
}

export function CreateRoomModal({
	isOpen,
	onClose,
	onCreateRoom,
}: CreateRoomModalProps) {
	const [name, setName] = useState("");
	const [isPrivate, setIsPrivate] = useState(false);
	const [isEncrypted, setIsEncrypted] = useState(false);
	const [passphrase, setPassphrase] = useState("");
	const [submitting, setSubmitting] = useState(false);

	if (!isOpen) return null;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const trimmedName = name.trim();
		if (!trimmedName || submitting) return;

		setSubmitting(true);
		try {
			const pass = isEncrypted && passphrase.trim() ? passphrase.trim() : undefined;
			const success = await onCreateRoom(trimmedName, isPrivate, pass);
			if (success) {
				setName("");
				setIsPrivate(false);
				setIsEncrypted(false);
				setPassphrase("");
				onClose();
			}
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div
			style={{
				position: "fixed",
				inset: 0,
				background: "rgba(0, 0, 0, 0.75)",
				backdropFilter: "blur(8px)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				zIndex: 9999,
				padding: "1rem",
			}}
			onClick={onClose}
		>
			<div
				className="glass-card"
				style={{
					width: "100%",
					maxWidth: "420px",
					padding: "1.5rem",
					display: "flex",
					flexDirection: "column",
					gap: "1.25rem",
					border: "1px solid var(--glass-border)",
					boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
				}}
				onClick={(e) => e.stopPropagation()}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
					}}
				>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							fontWeight: 700,
							fontSize: "1.05rem",
							color: "var(--text-main, #fff)",
						}}
					>
						<Plus size={20} style={{ color: "var(--primary, #6366f1)" }} />
						<span>Crea Nuova Stanza</span>
					</div>
					<button
						type="button"
						onClick={onClose}
						style={{
							background: "transparent",
							border: "none",
							color: "var(--text-muted, #aaa)",
							cursor: "pointer",
							padding: "4px",
						}}
						aria-label="Chiudi"
					>
						<X size={18} />
					</button>
				</div>

				<form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
					<div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
						<label style={{ fontSize: "0.78rem", fontWeight: 600, opacity: 0.8 }}>
							Nome della Stanza
						</label>
						<input
							type="text"
							className="glass-input"
							placeholder="es. producers-hangout"
							value={name}
							onChange={(e) => setName(e.target.value)}
							maxLength={64}
							autoFocus
							required
							style={{
								width: "100%",
								padding: "0.55rem 0.75rem",
								fontSize: "0.85rem",
								borderRadius: "8px",
							}}
						/>
					</div>

					<div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
						<label
							style={{
								display: "flex",
								alignItems: "center",
								gap: "0.5rem",
								fontSize: "0.8rem",
								cursor: "pointer",
							}}
						>
							<input
								type="checkbox"
								checked={isPrivate}
								onChange={(e) => setIsPrivate(e.target.checked)}
							/>
							<div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
								<Lock size={13} style={{ opacity: 0.7 }} />
								<span>Solo su questa istanza (privata)</span>
							</div>
						</label>

						<label
							style={{
								display: "flex",
								alignItems: "center",
								gap: "0.5rem",
								fontSize: "0.8rem",
								cursor: "pointer",
								color: isEncrypted ? "#4ade80" : "inherit",
								fontWeight: isEncrypted ? 600 : "normal",
							}}
						>
							<input
								type="checkbox"
								checked={isEncrypted}
								onChange={(e) => setIsEncrypted(e.target.checked)}
							/>
							<div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
								<Key size={13} style={{ color: "#4ade80" }} />
								<span>Cifra stanza con Passphrase (E2EE Zen SEA)</span>
							</div>
						</label>
					</div>

					{isEncrypted && (
						<div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
							<label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#4ade80" }}>
								Passphrase di Cifratura
							</label>
							<input
								type="password"
								className="glass-input"
								placeholder="Inserisci la passphrase per proteggere la stanza..."
								value={passphrase}
								onChange={(e) => setPassphrase(e.target.value)}
								required={isEncrypted}
								style={{
									width: "100%",
									padding: "0.55rem 0.75rem",
									fontSize: "0.85rem",
									borderRadius: "8px",
									fontFamily: "monospace",
								}}
							/>
							<span style={{ fontSize: "0.7rem", opacity: 0.5 }}>
								I membri dovranno inserire questa passphrase per leggere e inviare messaggi.
							</span>
						</div>
					)}

					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "flex-end",
							gap: "0.5rem",
							paddingTop: "0.5rem",
						}}
					>
						<Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
							Annulla
						</Button>

						<Button
							type="submit"
							variant="primary"
							size="sm"
							disabled={!name.trim() || (isEncrypted && !passphrase.trim()) || submitting}
							leftIcon={<Plus size={14} />}
						>
							{submitting ? "Creazione..." : "Crea Stanza"}
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
}
