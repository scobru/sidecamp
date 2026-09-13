import React, { useState, useMemo, useRef, useEffect } from "react";
import { Copy, Check, Trash2, Search, Terminal, ArrowDown } from "lucide-react";
import { Button } from "./Button";

export type LogCategory = "all" | "library" | "downloads" | "peer";

export interface UnifiedLogsViewerProps {
	libraryLogs: string[];
	dlLogs: string[];
	peerLogs: string[];
	onClearCategory: (category: LogCategory) => void;
}

export function UnifiedLogsViewer({
	libraryLogs,
	dlLogs,
	peerLogs,
	onClearCategory,
}: UnifiedLogsViewerProps) {
	const [activeCategory, setActiveCategory] = useState<LogCategory>("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [copied, setCopied] = useState(false);
	const [autoScroll, setAutoScroll] = useState(true);
	const terminalBodyRef = useRef<HTMLDivElement>(null);

	// Separate download logs from library logs (since dlLogs in App.tsx previously contained both)
	const pureDlLogs = useMemo(() => {
		return dlLogs.filter((l) => !l.includes("[Library]"));
	}, [dlLogs]);

	// All combined logs
	const allLogs = useMemo(() => {
		// Interleave / concatenate: dlLogs already contains library logs, so dlLogs + peerLogs covers all
		return [...dlLogs, ...peerLogs];
	}, [dlLogs, peerLogs]);

	// Filter by selected category
	const categoryFiltered = useMemo(() => {
		switch (activeCategory) {
			case "library":
				return libraryLogs;
			case "downloads":
				return pureDlLogs;
			case "peer":
				return peerLogs;
			case "all":
			default:
				return allLogs;
		}
	}, [activeCategory, libraryLogs, pureDlLogs, peerLogs, allLogs]);

	// Filter by search query
	const displayedLogs = useMemo(() => {
		if (!searchQuery.trim()) return categoryFiltered;
		const q = searchQuery.toLowerCase();
		return categoryFiltered.filter((line) => line.toLowerCase().includes(q));
	}, [categoryFiltered, searchQuery]);

	// Auto-scroll to bottom on new logs if enabled
	useEffect(() => {
		if (autoScroll && terminalBodyRef.current) {
			terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
		}
	}, [displayedLogs, autoScroll]);

	const handleCopy = async () => {
		if (displayedLogs.length === 0) return;
		try {
			await navigator.clipboard.writeText(displayedLogs.join("\n"));
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			/* ignore clipboard write failures */
		}
	};

	const formatLogLine = (log: string, idx: number) => {
		let tagClass = "log-tag-default";
		if (log.includes("[Library]")) tagClass = "log-tag-library";
		else if (log.includes("[Soulseek]") || log.includes("[Torrent]") || log.includes("[Download]")) tagClass = "log-tag-download";
		else if (log.includes("[Peer]") || log.includes("[Zen]") || log.includes("[DHT]")) tagClass = "log-tag-peer";
		else if (log.toLowerCase().includes("error") || log.toLowerCase().includes("fail")) tagClass = "log-tag-error";

		return (
			<div key={idx} className={`log-line ${tagClass}`}>
				{log}
			</div>
		);
	};

	return (
		<div className="unified-logs-card">
			<div className="unified-logs-header">
				<div className="unified-logs-title-group">
					<Terminal size={18} style={{ color: "var(--primary)" }} />
					<h3 style={{ margin: 0, fontSize: "1.05rem", fontFamily: "var(--font-headings)" }}>
						Activity & Terminal Logs
					</h3>
					<span className="unified-logs-badge">
						{displayedLogs.length} {displayedLogs.length === 1 ? "entry" : "entries"}
					</span>
				</div>

				<div className="unified-logs-actions">
					<Button
						variant="secondary"
						size="sm"
						onClick={handleCopy}
						disabled={displayedLogs.length === 0}
						title="Copy current logs to clipboard"
						style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
					>
						{copied ? <Check size={14} style={{ color: "var(--accent)" }} /> : <Copy size={14} />}
						<span>{copied ? "Copied!" : "Copy"}</span>
					</Button>
					<Button
						variant="danger"
						size="sm"
						onClick={() => onClearCategory(activeCategory)}
						disabled={categoryFiltered.length === 0}
						title="Clear logs for current view"
						style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
					>
						<Trash2 size={14} />
						<span>Clear</span>
					</Button>
				</div>
			</div>

			{/* Filter Tabs and Search Bar */}
			<div className="unified-logs-toolbar">
				<div className="unified-logs-tabs">
					<button
						type="button"
						className={`unified-tab-btn ${activeCategory === "all" ? "active" : ""}`}
						onClick={() => setActiveCategory("all")}
					>
						All ({allLogs.length})
					</button>
					<button
						type="button"
						className={`unified-tab-btn ${activeCategory === "library" ? "active" : ""}`}
						onClick={() => setActiveCategory("library")}
					>
						Library ({libraryLogs.length})
					</button>
					<button
						type="button"
						className={`unified-tab-btn ${activeCategory === "downloads" ? "active" : ""}`}
						onClick={() => setActiveCategory("downloads")}
					>
						Downloads ({pureDlLogs.length})
					</button>
					<button
						type="button"
						className={`unified-tab-btn ${activeCategory === "peer" ? "active" : ""}`}
						onClick={() => setActiveCategory("peer")}
					>
						Peer Node ({peerLogs.length})
					</button>
				</div>

				<div className="unified-logs-search-wrapper">
					<div className="unified-logs-search">
						<Search size={14} className="search-icon" />
						<input
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search logs..."
							className="glass-input logs-search-input"
						/>
						{searchQuery && (
							<button
								type="button"
								className="clear-search-btn"
								onClick={() => setSearchQuery("")}
								title="Clear search"
							>
								×
							</button>
						)}
					</div>

					<button
						type="button"
						className={`autoscroll-toggle-btn ${autoScroll ? "active" : ""}`}
						onClick={() => setAutoScroll((prev) => !prev)}
						title={autoScroll ? "Auto-scroll enabled (click to pause)" : "Auto-scroll paused (click to follow)"}
					>
						<ArrowDown size={14} />
						<span>{autoScroll ? "Following" : "Paused"}</span>
					</button>
				</div>
			</div>

			{/* Terminal Viewport */}
			<div
				ref={terminalBodyRef}
				className="unified-terminal-body"
				onScroll={() => {
					if (!terminalBodyRef.current) return;
					const { scrollTop, scrollHeight, clientHeight } = terminalBodyRef.current;
					const isAtBottom = scrollTop + clientHeight >= scrollHeight - 40;
					if (autoScroll && !isAtBottom) {
						setAutoScroll(false);
					} else if (!autoScroll && isAtBottom) {
						setAutoScroll(true);
					}
				}}
			>
				{displayedLogs.map((log, idx) => formatLogLine(log, idx))}
				{displayedLogs.length === 0 && (
					<div className="log-line dim" style={{ textAlign: "center", padding: "2.5rem 1rem", fontStyle: "italic" }}>
						{searchQuery ? `No logs match "${searchQuery}"` : "No logs recorded in this category..."}
					</div>
				)}
			</div>
		</div>
	);
}
