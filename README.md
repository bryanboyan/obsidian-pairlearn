# PairLearn

AI-copiloted learning for Obsidian. Build curriculums, track progress, and continue sessions with any LLM — Claude, ChatGPT, Codex, or a local model.

PairLearn pairs you with AI to learn anything. Everything is stored as plain Markdown, so you're never locked into one tool.

## Installation

### From Obsidian Community Plugins
1. Open **Settings → Community Plugins → Browse**
2. Search for **PairLearn**
3. Click **Install**, then **Enable**

### Manual Install
1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](../../releases/latest)
2. Create a folder `.obsidian/plugins/pairlearn/` in your vault
3. Copy the three files into it
4. Enable **PairLearn** in Settings → Community Plugins

## Getting Started

1. Click the **graduation cap** icon in the left ribbon (or use command palette: "Open PairLearn")
2. Click **+ New Topic** to create your first learning topic
3. Use an AI to build your curriculum:
   - **Claude Code**: Use `/learn` and say "I want to learn Rust"
   - **ChatGPT / any LLM**: Copy `Learning/CONTEXT.md` + your topic's `progress.md` into a chat and say "Help me build a curriculum"
4. Come back to PairLearn to see your progress dashboard

## How It Works

```
Learning/                     # In your Obsidian vault
├── INDEX.md                  # Master index of all topics
├── CONTEXT.md                # Instructions for any LLM (portability layer)
├── <topic-slug>/             # One folder per learning topic
│   ├── plan.md               # Versioned curriculum
│   ├── progress.md           # Current state — THE key file
│   └── lessons/              # Session logs (append-only)
│       └── YYYY-MM-DD-HH-<slug>.md
```

### The Key Files

- **`progress.md`** — Source of truth for where you are. Any LLM can read this and know exactly where to pick up.
- **`plan.md`** — Your curriculum. Versioned — old versions archived inline under `<details>` blocks.
- **`CONTEXT.md`** — Paste this + `progress.md` into any AI to continue learning anywhere.

## Plugin Features

- **Learning Hub** — Dashboard of all topics with status, progress bars, and filters
- **Topic Dashboard** — Current position, chapter list, confidence ratings, lesson history
- **Interactive confidence stars** — Click to rate your understanding (1-5) per chapter
- **Chapter checkboxes** — Mark chapters complete directly from the dashboard
- **Status management** — Pause, archive, and restore topics
- **Auto-refresh** — Dashboard updates when files change (e.g., after an AI session)
- **Open files** — Click to open plan, progress, or lesson files in Obsidian

## Using with AI Tools

### Claude Code (recommended)
```
/learn                     # Opens the learning skill
"I want to learn Rust"     # Starts a new topic
"Continue Solana"          # Picks up where you left off
"How's my progress?"       # Shows all topics
```

### ChatGPT / Any Chat LLM
1. Copy `Learning/CONTEXT.md`
2. Copy your topic's `progress.md`
3. Paste both into a new chat
4. Say "Let's continue" — the AI knows exactly where you are

### Codex / Agentic Tools
Point the agent at `Learning/`. `CONTEXT.md` has all instructions needed.

## Concepts

### Confidence Scale (1-5)
| Rating | Meaning |
|--------|---------|
| 1 | Lost — need to start over |
| 2 | Shaky — get the idea, can't apply it |
| 3 | Okay — can do it with references |
| 4 | Solid — can do it independently |
| 5 | Mastery — can teach it |

### Topic Status
| Status | Meaning |
|--------|---------|
| `active` | Currently studying |
| `paused` | On hold, will resume |
| `completed` | Finished the curriculum |
| `archived` | No longer pursuing |

### Plan Versioning
- **Minor** (v1.1, v1.2): Reordering, adding sub-topics, adjusting scope
- **Major** (v2.0): Fundamental restructure, different learning approach

## Design Principles

1. **Plain Markdown** — no databases, no proprietary formats
2. **AI-portable** — works with any LLM via `CONTEXT.md` + `progress.md`
3. **Append-only lessons** — sessions are never overwritten
4. **Versioned plans** — curricula evolve, old versions are kept
5. **Human-readable** — browse everything in Obsidian, a text editor, or on GitHub

## Development

```bash
npm install
npm run dev    # Watch mode
npm run build  # Production build
```

## License

MIT
