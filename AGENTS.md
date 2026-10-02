# AGENTS.md

LyricsBlank turns a YouTube music video into an English listening-practice exercise: Monkeytype-style typing over word-timed TTML lyrics. Next.js 15 App Router + React 19 + Tailwind 3 + TypeScript. Single-page app; the only server code is one API route.

## Commands
- `npm run dev` — dev server on :3000
- `npm run build` / `npm start` — production build / serve
- Typecheck: `npx tsc --noEmit` (tsconfig is `noEmit`; `tsconfig.tsbuildinfo` is committed build state)
- **No tests** and no test runner exist in this repo.
- `npm run lint` does **not work as-is**: `eslint` / `eslint-config-next` are not installed and there is no ESLint config, so `next lint` tries to scaffold one interactively. Use `tsc --noEmit` for verification instead.
- This is not a git repository (no `.git`).

## Architecture (the wiring you can't guess from filenames)
- `src/app/page.tsx` is effectively the whole app: one `'use client'` component that owns ALL state (song, lesson, stats, playback, palette). Everything in `src/components/` is presentational, driven by props from here. Add features by threading state through `page.tsx`, not by putting data logic into components.
- Load pipeline: YouTube URL → `lib/youtube.ts` (`extractYouTubeVideoId` → `fetchYouTubeMetadata` via noembed.com oEmbed) → `lib/binilyrics.ts` → `app/api/lyrics/route.ts` → `lib/ttml-parser.ts` (`parseTtml`) → `lib/exercise-generator.ts` (`generateExercise`) → `SongLesson` (`types/lyrics.ts`).
- `page.tsx` caches parsed `baseLines` and only re-runs `applyTimingOffset` + `generateExercise` when difficulty or timing offset changes. It does **not** refetch lyrics for those — don't add a refetch there.
- `lib/ttml-parser.ts` merges adjacent syllable `<span>`s into whole words, so blanks are always complete words even though BiniLyrics emits syllable-level timing.
- `components/CinematicVideoPlayer.tsx` wraps the YouTube IFrame API: injects the script, polls for readiness, runs a 50ms `getCurrentTime` sync loop, and exposes an imperative `VideoPlayerRef` (`seekTo`/`play`/`pause`/`setPlaybackRate`…). `page.tsx` holds that ref. Player readiness is async — follow the existing queued pending-seek/pending-play pattern.

## Gotchas
- `app/api/lyrics/route.ts` sets `NODE_TLS_REJECT_UNAUTHORIZED=0` at module load (disables TLS validation process-wide) to reach the BiniLyrics proxy. Know this before adding other outbound fetches.
- No API keys needed anywhere: BiniLyrics (`lyrics-api.binimum.org`), noembed.com, YouTube IFrame API are all keyless. `lib/binilyrics.ts` hardcodes a verified Coldplay "Paradise" TTML as the last-resort fallback, and every fetch failure silently returns it — "it works" in dev can mean the fallback fired.
- Icons in `src/components/icons/` are hand-rolled animated SVGs built on `motion` (imported as `motion/react`), re-exported from `icons/index.ts`. `lucide-react` is used only for a couple of static icons. The README's "lucide-animated" claim is stale.
- Styling follows a YouTube Music design language. Use Tailwind tokens `ytm-*` (plus legacy `monkey-*`); brand accent is `#f03`. `app/globals.css` forces `overflow: hidden`, `height: 100dvh`, and `user-select: none` globally.
- `@/*` path alias maps to `./src/*`.

## Docs caveats
- Comments throughout reference `design.md` (§1, §2, §5…); that file is **not** in the repo.
- README is stale vs. code in places: blank ratios are easy 18% / medium 35% / hard 55% / expert 80% (`exercise-generator.ts`), and the UI font is Roboto, not JetBrains Mono. Trust the code.
