/**
 * Download policy — mirrors TuneCamp's `src/server/common/download-access.ts`.
 *
 * Streaming and downloading are different rights on a TuneCamp instance. A
 * release picks a distribution mode ("Download Experience" in the release
 * editor) and that mode decides whether the full file may leave the server:
 *
 *   free      → anyone may take it
 *   codes     → sold; needs an unlock code, a purchase or a subscription
 *   none      → streaming only, no downloadable payload
 *   external  → the sale happens off-platform (Bandcamp et al.)
 *
 * The Network tab used to offer a Download button on every row regardless, so
 * a release an artist was selling could be pulled through Sidecamp. The server
 * refuses that now (402/403), but a button that always fails is no better than
 * one that shouldn't be there — this decides which rows get one.
 *
 * Trust order:
 *  1. `downloadable`, when the instance sends it. It is authoritative: computed
 *     server-side, and aware of per-release price overrides we cannot see.
 *  2. Otherwise the release's own mode and price, which every instance
 *     publishes — so an instance older than the flag is still respected.
 *  3. Silence means silence. An instance that says nothing at all (no flag, no
 *     mode, no price) is treated as offering the file, exactly as before: the
 *     server has the last word either way, and assuming the worst would break
 *     every plain library on an instance that simply never configured a mode.
 */

export type DownloadRefusal = "for_sale" | "streaming_only" | "external" | "sharing_off";

export interface DownloadVerdict {
    downloadable: boolean;
    /** Why not, when `downloadable` is false. */
    reason?: DownloadRefusal;
}

export interface DownloadabilityInput {
    /** Authoritative flag from an up-to-date instance, when present. */
    downloadable?: boolean | null;
    /** Peer-daemon per-track sharing flag (`allow_download`). */
    allowDownload?: boolean | null;
    /** `albums.download`: "free" | "codes" | "paid" | "none" | "external". */
    releaseDownload?: string | null;
    releasePrice?: number | null;
    releasePriceUsdc?: number | null;
    releasePriceUsdt?: number | null;
    trackPrice?: number | null;
    trackPriceUsdc?: number | null;
    trackPriceUsdt?: number | null;
}

const ALLOWED: DownloadVerdict = { downloadable: true };

const asPrice = (...values: Array<number | null | undefined>): number =>
    Math.max(0, ...values.map((v) => Number(v) || 0));

export function resolveDownloadability(input: DownloadabilityInput): DownloadVerdict {
    // A peer daemon's own per-track switch is the peer's decision, not a sale.
    if (input.allowDownload === false) {
        return { downloadable: false, reason: "sharing_off" };
    }

    if (typeof input.downloadable === "boolean") {
        if (input.downloadable) return ALLOWED;
        // The flag says no but not why; infer the wording from what we can see.
        return { downloadable: false, reason: refusalFromMode(input) };
    }

    const mode = (input.releaseDownload || "").toLowerCase();
    if (mode === "free") return ALLOWED;
    if (mode === "external") return { downloadable: false, reason: "external" };
    if (mode === "codes" || mode === "paid") return { downloadable: false, reason: "for_sale" };
    if (mode === "none") return { downloadable: false, reason: "streaming_only" };

    // No mode published: a price is the remaining evidence that it is on sale.
    if (hasPrice(input)) return { downloadable: false, reason: "for_sale" };

    // Nothing said at all — an instance that predates any of this.
    return ALLOWED;
}

function hasPrice(input: DownloadabilityInput): boolean {
    return (
        asPrice(input.releasePrice, input.releasePriceUsdc, input.releasePriceUsdt) > 0 ||
        asPrice(input.trackPrice, input.trackPriceUsdc, input.trackPriceUsdt) > 0
    );
}

function refusalFromMode(input: DownloadabilityInput): DownloadRefusal {
    const mode = (input.releaseDownload || "").toLowerCase();
    if (mode === "external") return "external";
    if (mode === "codes" || mode === "paid") return "for_sale";
    if (hasPrice(input)) return "for_sale";
    return "streaming_only";
}

/** Short badge shown next to a row that cannot be downloaded. */
export function downloadBadgeLabel(reason?: DownloadRefusal): string {
    switch (reason) {
        case "for_sale":
            return "For sale";
        case "external":
            return "External";
        case "sharing_off":
            return "Sharing off";
        case "streaming_only":
        default:
            return "Stream only";
    }
}

/** Tooltip for the disabled download button. */
export function downloadRefusalHint(reason?: DownloadRefusal): string {
    switch (reason) {
        case "for_sale":
            return "On sale on this instance — buy it there to download";
        case "external":
            return "Sold outside TuneCamp — see the artist's store";
        case "sharing_off":
            return "This peer does not share downloads for this track";
        case "streaming_only":
        default:
            return "This instance offers streaming only for this track";
    }
}
