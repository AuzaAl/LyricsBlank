# LyricsBlank — YouTube Song Listening Practice 🎵

An interactive English listening comprehension application inspired by **Monkeytype** ergonomics and aesthetics, powered by **YouTube Video Playback**, **BiniLyrics TTML Timestamps**, and **[lucide-animated](https://lucide-animated.com/)** motion icons.

---

## 🌟 Key Features

1. **YouTube-to-Lesson Pipeline**:
   - Paste any YouTube URL or select curated songs (*Paradise* by Coldplay, *Someone Like You* by Adele).
   - Extracts metadata and synchronizes high-precision word/line-level **TTML (Timed Text Markup Language)** lyrics.

2. **Monkeytype-Inspired Typing Canvas**:
   - Distraction-free mechanical typography (`JetBrains Mono`).
   - Progressive line opacity: active line centered and highlighted, past lines dimmed.
   - **Letter-by-letter live validation**:
     - Correct characters glow in theme accent/green.
     - Mistakes flagged in soft red.
     - Smooth jumping vertical caret.
   - Auto-advance on word match with Web Audio synthesized click sounds.

3. **Cinematic Big Screen & Glassmorphism**:
   - 16:9 embedded YouTube player with custom controls and ambient backdrop glow.
   - Animated multi-blob mesh gradient blur background (`backdrop-blur-3xl`).
   - Pure dark glassmorphism surfaces (`bg-slate-950/80`, `border-white/10`).

4. **100% Animated Icons**:
   - Integrated motion icons from **[lucide-animated](https://lucide-animated.com/)** (`pqoqubbw/icons`).

5. **Gamification & Ergonomics**:
   - Difficulty presets: `Easy` (15% blanks), `Medium` (35% blanks), `Hard` (60% blanks), `Expert` (85% blanks).
   - Auto-pause at end of blank line toggle.
   - Hotkeys:
     - `Tab` / `Ctrl+R` — Replay current audio line
     - `Ctrl+H` — Reveal next letter hint
     - `Esc` — Skip current word
     - `Space` — Play / Pause video

---

## 🚀 Getting Started

The app is running locally at:
👉 **[http://localhost:3000](http://localhost:3000)**

```bash
# Run Development Server
npm run dev

# Run Production Build
npm run build
npm start
```
