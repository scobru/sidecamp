import { useState, useEffect } from "react";
import { Lock, Key, Unlock, Trash2, X, ShieldCheck } from "lucide-react";
import { Button } from "./Button";
import type { RoomInfo } from "@tunecamp/chat";

interface UnlockRoomModalProps {
	isOpen: boolean;
	onClose: () => void;
	room: RoomInfo | null;
	currentPassphrase?: string;
	onSavePassphrase: (roomId: number, passphrase: string) => void;
	onClearPassphrase: (roomId: number) => void;
}

export function UnlockRoomModal({
	isOpen,
	onClose,
	room,
	currentPassphrase = "",
	onSavePassphrase,
	onClearPassphrase,
}: UnlockRoomModalProps) {
	const [passphrase, setPassphrase] = useState(currentPassphrase);
	const [showPass, setShowPass] = useState(false);

	useEffect(() => {
		setPassphrase(currentPassphrase);
	}, [currentPassphrase, room?.id]);

	if (!isOpen || !room) return null;

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!passphrase.trim()) return;
		onSavePassphrase(room.id, passphrase.trim());
		onClose();
	};

	const handleForget = () => {
		onClearPassphrase(room.id);
		setPassphrase("");
		onClose();
	};

	const isUnlocked = Boolean(currentPassphrase);

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
						<Lock size={20} style={{ color: "var(--primary, #6366f1)" }} />
						<span>Cifratura Stanza #{room.name}</span>
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
					<div
						style={{
							padding: "0.75rem 0.9rem",
							borderRadius: "10px",
							background: "rgba(255, 255, 255, 0.04)",
							border: "1px solid var(--glass-border)",
							fontSize: "0.8rem",
							lineHeight: 1.45,
						}}
					>
						{isUnlocked ? (
							<div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#4ade80", fontWeight: 600 }}>
								<ShieldCheck size={16} style={{ flexShrink: 0 }} />
								<span>Stanza sbloccata su questo dispositivo. I messaggi vengono decifrati in tempo reale con Zen SEA.</span>
							</div>
						) : (
							<div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-muted, #ccc)" }}>
								<Key size={16} style={{ color: "var(--primary, #6366f1)", flexShrink: 0 }} />
								<span>Inserisci la passphrase condivisa per decifrare lo storico e inviare messaggi cifrati E2EE in questa stanza.</span>
							</div>
						)}
					</div>

					<div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
						<label style={{ fontSize: "0.78rem", fontWeight: 600, opacity: 0.8 }}>
							Passphrase di Cifratura
						</label>
						<div style={{ position: "relative" }}>
							<input
								type={showPass ? "text" : "password"}
								className="glass-input"
								placeholder="Inserisci la passphrase della stanza..."
								value={passphrase}
								onChange={(e) => setPassphrase(e.target.value)}
								autoFocus
								required
								style={{
									width: "100%",
									padding: "0.55rem 4.5rem 0.55rem 0.75rem",
									fontSize: "0.85rem",
									borderRadius: "8px",
									fontFamily: "monospace",
								}}
							/>
							<button
								type="button"
								onClick={() => setShowPass(!showPass)}
								style={{
									position: "absolute",
									right: "6px",
									top: "50%",
									transform: "translateY(-50%)",
									background: "transparent",
									border: "none",
									color: "var(--text-muted)",
									fontSize: "0.72rem",
									cursor: "pointer",
									padding: "2px 6px",
								}}
							>
								{showPass ? "Nascondi" : "Mostra"}
							</button>
						</div>
						<span style={{ fontSize: "0.7rem", opacity: 0.5 }}>
							La chiave viene derivata localmente (PBKDF2 a 100.000 iterazioni) e non viene mai inviata al server.
						</span>
					</div>

					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							paddingTop: "0.5rem",
						}}
					>
						{isUnlocked ? (
							<Button
								type="button"
								variant="danger"
								size="sm"
								onClick={handleForget}
								leftIcon={<Trash2 size={14} />}
							>
								Dimentica
							</Button>
						) : (
							<Button type="button" variant="ghost" size="sm" onClick={onClose}>
								Annulla
							</Button>
						)}

						<Button
							type="submit"
							variant="primary"
							size="sm"
							disabled={!passphrase.trim()}
							leftIcon={<Unlock size={14} />}
						>
							{isUnlocked ? "Aggiorna Passphrase" : "Sblocca Stanza"}
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
}
