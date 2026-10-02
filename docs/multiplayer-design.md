# LyricsBlank — Multiplayer Design

Reference spec for the real-time versus/race feature. Captures every decision made
during design so implementation doesn't re-litigate them.

## 1. Core model

- **Real-time versus/race**, 1v1 or FFA (2–8 players).
- **Self-paced after the start gun.** Players each control their own video.
- **Strict sync applies ONLY to the start line**: `ready` → `countdown 3-2-1` → `GO`.
  After GO, drift between players is expected and irrelevant.
- **Host = orchestrator + score aggregator**, NOT a playback controller. No
  host-authoritative clock (it causes stutter and one slow player stalls everyone).
- **Minimal backend**: SSE + in-memory room state (`Map` on `globalThis`). No DB.
  ⚠️ This does NOT work on Vercel serverless (each instance has its own memory).
  Safe only when self-hosted as a single long-lived Node process.

## 2. Why "strict sync" means line/start, not seconds

YouTube IFrame playback can never be second-accurate across clients: ads, buffering,
`seekTo` variance (~200–500ms), autoplay gesture requirements, regional blocks.
Trying to lock seconds produces stutter and unfairness. The start gun is the only
point that must be exact, and it can be. Everything after is per-player.

## 3. Game modes = one engine, three presets

| | Classic Race | Flow Race | Sprint |
|---|---|---|---|
| **Pacing** | Pause-gated (`autoPause` ON) | Real-time (`autoPause` OFF) | Real-time |
| **Ranking** | Fastest finish-time | Highest score | Highest score |
| **Gate** | Accuracy ≥ threshold (e.g. 0.80) to be classified | — | — |
| **Clock** | Wall-clock from GO (pause does not stop it) | Video (TTML windows) | Server countdown of T seconds |
| **Combo** | Off | On | On |
| **End** | All players finish (first finisher does not stop others) | All finish song | Time up |

Sprint duration is **configurable in the lobby** (30 / 60 / 90s).

## 4. Scoring

### Per-blank quality `q` (folds correct/wrong/hint/skip into one number)
Start at `q = 1.0`:

| Event | Effect |
|---|---|
| Correct first try | stays `1.0` |
| Each wrong attempt | `−0.25` |
| Each hint letter revealed | `−0.15` |
| Skipped | `q = 0` |

`q` clamped to `[0, 1]`. `base = Σ(100 × q)`.

### Speed term — differs per pacing
- **Real-time (Flow/Sprint):** no manual speed term. The TTML window *is* the clock —
  answering after the word's window sets `q = 0`. Automatic, un-gameable.
- **Pause-gated (Classic):** ranking is finish-time, so any penalty must be in the
  **time domain**. The fairest rule is **wall-clock runs continuously from GO**:
  thinking time always counts. This closes both loopholes (pause-spam AND long
  single pause) with one rule, and needs no client-reported pause count (which is
  cheatable in a client-authoritative model). Auto-pause is a mode mechanic, not a
  player action, and is free under this rule.
  - Optional (design choice, NOT fairness): discount pause time (e.g. count 50%).
    Only do this if pausing should feel like an assist.

### Combo (real-time only)
Consecutive correct blanks raise a multiplier, capped at +20%. Disabled in Classic.

### Ranking & tie-breaks
- Classic: `finishTimeMs` ascending, **gated** by `accuracy ≥ threshold`.
- Flow/Sprint: `score` descending.
- Tie-break order: **score ↓ → accuracy ↓ → time ↑** (faster wins).

Display accuracy = `correct / (correct + wrong + skip)`.

### Worked example (20 blanks, parTime 120s)
| | Correct | Wrong | Hint | Time | Base | Speed | Total |
|---|---|---|---|---|---|---|---|
| A | 20 | 0 | 0 | 90s | 2000 | +100 | **2100** |
| B | 20 | 10 | 2 | 70s | 1720 | +167 | **1887** |

Faster-but-sloppy B loses; a clean-and-fast B would win. Accuracy is rewarded.

## 5. Fairness invariants (the room MUST lock these)

- Same song, same difficulty, same `timingOffset`, one start signal.
- `generateExercise` is deterministic for (song, difficulty) → all players get
  identical blanks automatically. ✅
- **Playback rate locked to 1.0× in real-time modes** (the player exposes
  `setPlaybackRate`; 2× would be cheating).
- Client-authoritative: clients hold the answer key (TTML fetched client-side).
  Acceptable for "casual play with friends"; **honor system** — a player can skip
  the video and type from memory. Fine for v1, NOT for ranked.
- Classic Race must be **gated by accuracy** or it is gameable by rushing.

## 6. Protocol (SSE + in-memory room state)

### Server principles
1. **Dumb relay + aggregator.** No answer key on the server; clients compute `q`/score.
2. **Snapshot-based**, not event-replay → resilient to out-of-order messages.
3. **SSE stream = presence.** Open = online, closed = disconnect.
4. Server owns exactly one authoritative clock: the Sprint `timeUp` timer.

### Endpoints
```
POST /api/room/create                          → { code, playerId, token, room }
POST /api/room/[code]/action                   → { ok } | { error }
GET  /api/room/[code]/events?playerId=&token=  → SSE stream
```

### Client → Server (actions)
| Action | Payload | Who | Notes |
|---|---|---|---|
| `join` | `{ name }` | all | server returns `playerId` + secret `token` (for reconnect) |
| `ready` | `{ ready }` | all | player loaded video & paused at line 0 |
| `progress` | `{ snapshot }` | all | **throttle: per blank + max 2×/s** |
| `finish` | `{ finishTimeMs?, score, accuracy }` | all | end of song |
| `start` | `{}` | **host** | valid only if all players ready |
| `leave` | `{}` | all | voluntary exit |

### Server → Client (SSE events) — wire format `event: <type>\ndata: <json>\n\n`
| Event | Data | When |
|---|---|---|
| `room` | `RoomSnapshot` | on join & any lobby change |
| `playerJoined` / `playerLeft` | player info | lobby |
| `playerReady` | `{ playerId, ready }` | lobby |
| `countdown` | `{ seconds }` | host pressed start |
| `go` | `{ startAt, sprintSeconds? }` | after countdown |
| `standings` | `Standing[]` | throttled 2×/s during racing |
| `playerFinished` | `{ playerId, finishTimeMs?, score }` | player finished |
| `playerDnf` | `{ playerId, reason }` | disconnect/timeout |
| `timeUp` | `{}` | Sprint timer expired |
| `results` | `Standing[]` | race over |
| `error` | `{ message }` | invalid action |

### State types (TypeScript)
```ts
type RoomPhase = 'lobby' | 'countdown' | 'racing' | 'finished';
type GameMode  = 'classic' | 'flow' | 'sprint';
type PlayerStatus = 'connected' | 'ready' | 'racing' | 'finished' | 'dnf' | 'disconnected';

interface RoomConfig {
  mode: GameMode;
  difficulty: Difficulty;                 // existing type
  song: { videoId: string; title: string; artist: string };
  accuracyGate: number;                   // classic only, e.g. 0.8
  sprintSeconds?: number;                 // sprint only
}

interface ProgressSnapshot {              // client-authoritative
  lineIndex: number;
  blanksDone: number;
  correct: number; wrong: number; hints: number; skips: number;
  combo: number;
  score: number;
  accuracy: number;                       // 0..1
  activeTimeMs: number;                   // classic clock
}

interface Player {
  id: string; name: string; isHost: boolean;
  status: PlayerStatus; ready: boolean;
  progress: ProgressSnapshot;
  finishTimeMs?: number;
  updatedAt: number;
}

interface Room {
  code: string; phase: RoomPhase;
  config: RoomConfig; hostId: string;
  players: Map<string, Player>;
  createdAt: number; startedAt?: number; sprintEndsAt?: number;
  conns: Map<string, { playerId: string; send: (e: ServerEvent) => void; close: () => void }>; // not serialized
}
```

### State machine
```
lobby ──(host start, all ready)──▶ countdown ──(3s)──▶ racing ──▶ finished
  ▲                                                               │
  └──────────────────(host: rematch)──────────────────────────────┘
```

## 7. Edge cases (decided)

1. **Disconnect** → 10s grace; reconnect with `token` restores; past grace → DNF
   (racing) or removed (lobby). A page refresh is a disconnect, so grace is mandatory.
2. **Heartbeat** → send `: ping\n\n` comment every ~15s (defeats proxy buffering,
   detects dead connections).
3. **Host leaves** → **host migration** to the longest-connected online player;
   if none, GC the room.
4. **Start with a non-ready player** → server **rejects**.
5. **Late join during racing** → **rejected** (room closes when the race starts).
6. **Concurrent joins** → synchronous `Map` mutation with no `await` mid-mutation →
   host = first joiner.
7. **Standings flood** → throttle 2×/s, or broadcast when `lineIndex` changes.
8. **Room GC** → delete after 5 min empty.
9. **Next.js specifics** → `export const runtime = 'nodejs'` + `dynamic = 'force-dynamic'`;
   SSE headers `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`,
   `Connection: keep-alive`, **`X-Accel-Buffering: no`** (critical — without it nginx/
   Cloudflare buffers SSE and the race appears frozen); store the room `Map` on
   `globalThis.__rooms` so it survives HMR in dev.
10. **Reconnect token** → `playerId` + random secret `token`; client stores in
    `sessionStorage` (prevents spoofing).

## 8. UI / UX

**Style: follow the CURRENT design system** — Tailwind `ytm-*` tokens, Roboto
(default font), brand accent `#f03` (`ytm-brand`), `ytm-frosted` surfaces. Do NOT use
the legacy `monkey-*` / `font-mono` style of the old modals.

### Screens (multiplayer is a layer, not a separate app)
`page.tsx` currently has two visual states: `!currentSong` → `LandingCard`, else →
practice. Multiplayer adds a third layer (`lobby`, `countdown`) **above** it. After GO,
the existing practice screen stays — we only attach a scoreboard overlay.

1. **Entry point** — in `LandingCard`: `[ Solo Practice ] [ Create Room ] [ Join Room ]`.
2. **Create/Join modal** — nickname + room code (join) or song/difficulty/mode (create);
   5-char code; produces a shareable link `?room=ABC12`.
3. **Lobby panel** — room code + Copy Link, song/mode/difficulty summary, player list
   with ready state, host-only `START` (disabled until all ready), host edits config.
4. **Countdown overlay** — big `3 → 2 → 1 → GO!` (reuse `animate-line-enter`/`fade-in`);
   video already loaded & paused at line 0 behind it.
5. **Race scoreboard — TOP STRIP** (decided). Horizontal bar above the content area:
   player rows + progress bar (`lineIndex / totalLines`), plus the running clock for
   Classic. Appears only during `racing`.
6. **Race results modal** — `RaceResultsModal` (new, ytm style; NOT `LessonCompleteModal`).
   Columns adapt to mode (Classic → Finish Time; Flow/Sprint → Score); highlight "You";
   confetti for the winner; actions `[ Rematch ] [ Back to Lobby ]`.

### New components
```
components/multiplayer/
  CreateJoinModal.tsx
  LobbyPanel.tsx
  CountdownOverlay.tsx
  RaceScoreboard.tsx      (top strip)
  RaceResultsModal.tsx
lib/useRoom.ts            (SSE hook; see refactor notes)
```

### UI gotchas
- `globals.css` forces `overflow: hidden` + `height: 100dvh`; the top strip must be an
  `absolute`/`fixed` overlay (or reclaim space) — do not grow the layout height.
- `MonkeyLyricsCanvas` focuses a hidden input; overlays must not steal focus
  (`pointer-events-none` except buttons).
- Scoreboard updates 2×/s (throttled) → animate the progress bars; do NOT re-mount
  the player list (flicker + focus loss).
- The countdown overlay must block typing input until GO, or players steal the start.

## 9. Dead code / cleanup
- `components/SongInputModal.tsx` is unused (dead code) — **delete**.
- Legacy-style modals (`LessonCompleteModal`, `ShortcutsModal`) still use `monkey-*` /
  `font-mono`; not required for multiplayer v1, but note the style drift.

## 10. Implementation phases
1. **Room + lobby + ready handshake** (SSE, in-memory).
2. **Race loop** — self-paced; host signals start; clients submit per-blank progress.
3. **`lib/scoring.ts`** (pure function) + live standings.
4. Later: reactions/emoji, rematch, async ghost, leaderboard.

`lib/scoring.ts` MUST be a pure function so it can be tested in isolation and later
moved server-side if ranked play is ever needed.

## 11. Deferred (NOT v1)
Reactions/emoji · live spectator (WebRTC) · song voting · reconnect window UI ·
async ghost race · server-authoritative anti-cheat · leaderboard/ranked.

## 12. Refactor plan for `page.tsx`

`page.tsx` (433 lines, one `'use client'` component) mixes **4 responsibilities**:
1. **Game engine** — load lyrics, `parseTtml`, `generateExercise`, rebuild effect (L110–127)
2. **Session/answer state** — `lesson`, `baseLines`, `stats`, handlers (L195–290)
3. **Playback state** — `isPlaying`, `currentTimeMs`, `playerRef`, auto-pause
4. **View orchestration** — render tree (L314–431)

Responsibilities 1–3 are **identical for solo and multiplayer**; only #4 differs. Seam:
separate engine from shell.

**Approach (decided):** custom hooks (`usePracticeEngine`, `useRoom`) + thin
`RoomContext` / prop drilling. **No new state library** (repo has zero today).

**Coupled behaviours that must survive the move (verified in code):**
- Two `eslint-disable exhaustive-deps` effects (L106, L126) — manually controlled
  deps; moving to a hook MUST preserve dependency semantics or lyrics refetch-loop.
- `loadNonce` re-trigger trick (L59, L148, L164, L422) → becomes `reload()`. Needed by
  multiplayer rematch too.
- Rebuild→seek coupling (L123–125): rebuilding the exercise auto-seeks to line 0.
- Completion check lives in handlers (L229–233) → engine must **delegate** via
  `onFinished`, not hardcode (solo opens modal, MP reports `finish`).
- `handleIncorrectAnswer()` (L236) and `handleUseHint()` (L285) currently **ignore
  their args**; scoring needs per-word wrong-attempt and hint counts.

**Per-blank scoring data (decided):** enrich `LyricWord`:
```ts
interface LyricWord {
  // ...existing
  wrongAttempts?: number;   // NEW
  hintsUsed?: number;       // NEW
}
```
So `computeScore(lesson, config)` is a pure function reading the lesson — testable
without React, movable to the server later.

**Target structure:**
```
src/app/page.tsx                  ← thin router (~30 lines): reads ?room=, picks shell
src/components/shell/
  AppChrome.tsx                   ← ambient + sidebar + layout + shortcuts modal
  SoloShell.tsx                   ← usePracticeEngine({}); existing solo UI
  MultiplayerShell.tsx            ← usePracticeEngine(opts) + useRoom; lobby/race UI
  PracticeView.tsx                ← topbar+split+video+canvas+bottombar (shared)
src/hooks/
  usePracticeEngine.ts            ← all game state (#1,#2,#3) + handlers
  useRoom.ts                      ← SSE + room state
src/lib/scoring.ts                ← pure: (lesson, config) → ScoreResult
```

**`usePracticeEngine` API:**
```ts
usePracticeEngine(options: {
  onBlankAnswered?: (e: { wordId; lineIndex; correct: boolean; hintCount }) => void;
  onLineChanged?: (lineIndex: number) => void;
  onFinished?: (result: ScoreResult) => void;
  lockPlaybackRate?: boolean;        // real-time modes: lock 1.0×
  lockedTimingOffsetMs?: number;     // MP: host offset (fairness)
  forcedAutoPause?: boolean;         // Classic ON; Flow/Sprint OFF
}): { /* state, derived, actions */ }
```
Solo calls `usePracticeEngine({})` (identical behaviour). MP adds callbacks + locked config.

**Migration — incremental, solo verified green at each phase:**
| Phase | Content | Risk |
|---|---|---|
| R1 | Enrich `LyricWord` + `lib/scoring.ts` | Low (solo unchanged) |
| R2 | Extract `usePracticeEngine`; page renders from hook | **Highest** (move verbatim first, then clean) |
| R3 | Split view: `AppChrome` + `SoloShell` + `PracticeView` | Medium (visually identical) |
| R4 | `useRoom` + `MultiplayerShell` + MP views | New code |

## 13. Full todo list

### Phase R1 — scoring foundation
- [ ] R1.1 Enrich `LyricWord` in `src/types/lyrics.ts` (`wrongAttempts?`, `hintsUsed?`)
- [ ] R1.2 `generateExercise` initialises `wrongAttempts: 0`, `hintsUsed: 0` on blanks
- [ ] R1.3 Create `src/lib/scoring.ts` — pure `computeScore(lesson, config): ScoreResult`
- [ ] R1.4 Implement per-blank `q` (correct first-try / −0.25 wrong / −0.15 hint / skip 0)
- [ ] R1.5 Implement speed term per pacing (real-time: TTML window; classic: wall-clock)
- [ ] R1.6 Implement combo multiplier (real-time only, cap +20%)
- [ ] R1.7 Implement ranking + tie-breaks (score ↓ → accuracy ↓ → time ↑) + accuracy gate
- [ ] R1.8 Typecheck (`npx tsc --noEmit`) + manual sanity check

### Phase R2 — extract engine hook
- [ ] R2.1 Create `src/hooks/usePracticeEngine.ts`; move state L38–70 + effects L73–132 verbatim
- [ ] R2.2 Move handlers L195–290; add `onBlankAnswered`/`onFinished` callbacks
- [ ] R2.3 Replace completion check (L229–233) with `onFinished` delegation
- [ ] R2.4 Preserve both `eslint-disable exhaustive-deps` semantics exactly
- [ ] R2.5 `page.tsx` consumes the hook; solo behaviour unchanged
- [ ] R2.6 Verify solo end-to-end (load, type, hint, skip, complete) + `tsc --noEmit`

### Phase R3 — split view
- [ ] R3.1 Extract `PracticeView.tsx` (topbar + split + video + canvas + bottombar)
- [ ] R3.2 Extract `AppChrome.tsx` (ambient bg + sidebar + layout + shortcuts modal)
- [ ] R3.3 `SoloShell.tsx` = `usePracticeEngine({})` + `PracticeView`
- [ ] R3.4 Verify solo visually identical

### Phase R4 — room + multiplayer
- [ ] R4.1 `src/lib/room-store.ts` — in-memory room store on `globalThis.__rooms`
- [ ] R4.2 `POST /api/room/create` (runtime nodejs)
- [ ] R4.3 `POST /api/room/[code]/action` (join/ready/progress/finish/start/leave)
- [ ] R4.4 `GET /api/room/[code]/events` SSE (headers incl. `X-Accel-Buffering: no`, heartbeat)
- [ ] R4.5 Disconnect detection + 10s grace + token reconnect
- [ ] R4.6 Host migration on host leave; room GC after 5 min empty
- [ ] R4.7 Sprint server timer → `timeUp`
- [ ] R4.8 `src/hooks/useRoom.ts` — SSE client + actions + `sessionStorage` token
- [ ] R4.9 `CreateJoinModal.tsx` (ytm style)
- [ ] R4.10 `LobbyPanel.tsx` (room code, copy link, player list, host config, START)
- [ ] R4.11 `CountdownOverlay.tsx` (3-2-1-GO, blocks typing)
- [ ] R4.12 `RaceScoreboard.tsx` (top strip, throttled progress bars)
- [ ] R4.13 `RaceResultsModal.tsx` (ytm style, mode-adaptive columns, rematch)
- [ ] R4.14 `MultiplayerShell.tsx` wiring engine + room + views
- [ ] R4.15 `page.tsx` router: read `?room=` → pick shell
- [ ] R4.16 Lock playback rate 1.0× + host timing offset in real-time modes

### Cleanup / verification
- [ ] C1 Delete `components/SongInputModal.tsx` — **DONE**
- [ ] C2 `npx tsc --noEmit` clean after each phase
- [ ] C3 Manual smoke test: 2 browser tabs, full race in each mode

### Deferred (post-v1)
Reactions/emoji · spectator (WebRTC) · song voting · reconnect UI · async ghost ·
server-authoritative anti-cheat · leaderboard
