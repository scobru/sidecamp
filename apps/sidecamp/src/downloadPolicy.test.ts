import { describe, it, expect } from "vitest";
import {
    downloadBadgeLabel,
    downloadRefusalHint,
    resolveDownloadability,
} from "./downloadPolicy";

describe("resolveDownloadability", () => {
    describe("the instance's own flag wins when it sends one", () => {
        it("offers the download when the instance says yes", () => {
            expect(resolveDownloadability({ downloadable: true })).toEqual({ downloadable: true });
            // even against a mode that would otherwise refuse — the server knows
            // about per-release price overrides we cannot see from here.
            expect(
                resolveDownloadability({ downloadable: true, releaseDownload: "codes", releasePrice: 5 }),
            ).toEqual({ downloadable: true });
        });

        it("withholds it when the instance says no, and words the badge from the mode", () => {
            expect(resolveDownloadability({ downloadable: false, releaseDownload: "codes" })).toEqual({
                downloadable: false,
                reason: "for_sale",
            });
            expect(resolveDownloadability({ downloadable: false, releaseDownload: "external" })).toEqual({
                downloadable: false,
                reason: "external",
            });
            expect(resolveDownloadability({ downloadable: false, releaseDownload: "none" })).toEqual({
                downloadable: false,
                reason: "streaming_only",
            });
            // A flag with no mode alongside it: a price still explains why.
            expect(resolveDownloadability({ downloadable: false, releasePrice: 9 })).toEqual({
                downloadable: false,
                reason: "for_sale",
            });
        });
    });

    describe("falling back to the release's distribution mode", () => {
        it("offers a free release", () => {
            expect(resolveDownloadability({ releaseDownload: "free" }).downloadable).toBe(true);
            // "free" is the artist's explicit choice, so stale price fields lose.
            expect(resolveDownloadability({ releaseDownload: "free", releasePrice: 5 }).downloadable).toBe(true);
        });

        it.each([
            ["codes", "for_sale"],
            ["paid", "for_sale"],
            ["none", "streaming_only"],
            ["external", "external"],
        ])("withholds a release published as %s", (mode, reason) => {
            expect(resolveDownloadability({ releaseDownload: mode })).toEqual({
                downloadable: false,
                reason,
            });
        });

        it("is case-insensitive about the mode", () => {
            expect(resolveDownloadability({ releaseDownload: "CODES" }).downloadable).toBe(false);
        });
    });

    describe("price as the remaining evidence of a sale", () => {
        it.each([
            ["release ETH price", { releasePrice: 0.01 }],
            ["release USDC price", { releasePriceUsdc: 3 }],
            ["release USDT price", { releasePriceUsdt: 3 }],
            ["track price", { trackPrice: 1 }],
            ["track USDC price", { trackPriceUsdc: 1 }],
        ])("withholds when there is a %s and no mode", (_label, prices) => {
            expect(resolveDownloadability(prices)).toEqual({ downloadable: false, reason: "for_sale" });
        });

        it("ignores zero and missing prices", () => {
            expect(
                resolveDownloadability({ releasePrice: 0, trackPrice: 0, releasePriceUsdc: null }).downloadable,
            ).toBe(true);
        });
    });

    describe("peer shares", () => {
        it("withholds a track the peer daemon does not share", () => {
            expect(resolveDownloadability({ allowDownload: false })).toEqual({
                downloadable: false,
                reason: "sharing_off",
            });
        });

        it("offers one the daemon does share", () => {
            expect(resolveDownloadability({ allowDownload: true }).downloadable).toBe(true);
        });

        it("lets the peer's switch override an otherwise-downloadable flag", () => {
            expect(
                resolveDownloadability({ allowDownload: false, downloadable: true }).reason,
            ).toBe("sharing_off");
        });
    });

    describe("instances that say nothing", () => {
        // Older instances predate every one of these fields. Assuming the worst
        // would strip the download button off every plain library on the network,
        // and the server has the last word regardless.
        it("offers the download when there is no signal at all", () => {
            expect(resolveDownloadability({}).downloadable).toBe(true);
            expect(resolveDownloadability({ releaseDownload: null, downloadable: null }).downloadable).toBe(true);
            expect(resolveDownloadability({ releaseDownload: "" }).downloadable).toBe(true);
        });
    });
});

describe("badge and hint wording", () => {
    it("names each refusal", () => {
        expect(downloadBadgeLabel("for_sale")).toBe("For sale");
        expect(downloadBadgeLabel("external")).toBe("External");
        expect(downloadBadgeLabel("sharing_off")).toBe("Sharing off");
        expect(downloadBadgeLabel("streaming_only")).toBe("Stream only");
        expect(downloadBadgeLabel(undefined)).toBe("Stream only");
    });

    it("explains each refusal", () => {
        expect(downloadRefusalHint("for_sale")).toMatch(/buy it/i);
        expect(downloadRefusalHint("external")).toMatch(/outside TuneCamp/i);
        expect(downloadRefusalHint("sharing_off")).toMatch(/does not share/i);
        expect(downloadRefusalHint(undefined)).toMatch(/streaming only/i);
    });
});
