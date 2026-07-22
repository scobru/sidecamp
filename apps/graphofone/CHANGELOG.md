# Changelog

All notable changes to this project will be documented in this file.

## [0.5.1] - 2026-07-22

### Fixed
- **O(n²) library writes/re-renders during analyze.** `handleAnalyze` called `saveLibrary()` (full JSON rewrite) and `setLibrary(prev => prev.map(...))` once per track inside the analyze loop. Added `updateTrackMetaBatch()` (wired through `main.ts`/`preload.ts`/`env.d.ts`); `handleAnalyze` now accumulates per-track updates and flushes disk + state once after the loop.
