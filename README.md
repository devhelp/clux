<p align="center">
  <img src="logo.svg" alt="Clux" width="120" />
</p>

<h1 align="center">Clux</h1>

<p align="center">
  <strong>A tmux session multiplexer for running parallel coding agents, with a web dashboard and CLI.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@clux-cli/cli"><img src="https://img.shields.io/npm/v/@clux-cli/cli" alt="npm version" /></a>
  <a href="https://github.com/devhelp/clux/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@clux-cli/cli" alt="license" /></a>
  <img src="https://img.shields.io/node/v/@clux-cli/cli" alt="node version" />
</p>

Clux wraps tmux into a programmable session manager designed for running multiple Claude Code instances (or any command) in parallel. It pairs a full-featured CLI with a browser dashboard that streams live terminal output over WebSocket. Sessions are enriched with tags, descriptions, and statistics, all persisted in SQLite so nothing is lost between restarts. Built-in inter-pane messaging lets your agents coordinate without manual copy-paste.

## Installation

```bash
npm install -g @clux-cli/cli
```

Requires **Node.js 18+** and **tmux**.

<details>
<summary>Install from source</summary>

```bash
git clone https://github.com/devhelp/clux.git && cd clux
npm install
npm run build
```

This compiles TypeScript and bundles the CLI. You can then run it directly with `node dist/index.js` or link it globally with `npm link`.

</details>

## Quick Start

Start a Claude session in your current project directory:

```bash
clux claude
```

The session name is auto-generated from your directory path. If a session for this directory already exists, clux switches you into it instead of creating a duplicate.

Open the web dashboard in another terminal to see all sessions at a glance:

```bash
clux web
```

The dashboard is available at `http://127.0.0.1:3456` and shows live terminal output, session metadata, and management controls.

You can also manage sessions without attaching to them:

```bash
clux ls                              # list all sessions
clux send my-session "run the tests" # send a command to a pane
clux capture my-session --lines 100  # grab recent output
```

## Claude Sessions

The `clux claude` command is a shortcut purpose-built for Claude Code workflows. It creates a tmux session running `claude`, tags it with `claude` and `ai`, and immediately attaches. The session name is derived from the working directory — path segments are abbreviated to keep names readable (e.g. `/home/user/projects/clux` becomes `claude_h-u-projects-clux`).

```bash
clux claude                       # auto-name from current directory
clux claude my-agent              # explicit name
clux claude --path ~/other/repo   # different working directory
clux claude --detach              # create without attaching
clux claude --danger              # run with --dangerously-skip-permissions
```

The command is idempotent: if a session with the resolved name already exists, clux switches to it rather than failing.

## CLI Commands

Every command supports `--help` for detailed usage.

| Command | Description |
|---------|-------------|
| `create <name>` | Create a session. `--command`, `--path`, `--layout`, `--description`, `--tags` |
| `claude [name]` | Create or switch to a Claude session. `--path`, `--detach`, `--danger` |
| `list` / `ls` | List sessions. `--tag`, `--search` |
| `info <name>` | Detailed session info (windows, panes, metadata, stats) |
| `attach <name>` | Attach interactively. Ctrl+B D to detach |
| `kill <name>` | Terminate a session |
| `send <name> <text>` | Send text to a pane. `--pane`, `--no-enter` |
| `capture <name>` | Capture pane output. `--lines`, `--all`, `--output` |
| `monitor <name>` | Watch pane output live. `--pane`, `--interval` |
| `relay <name>` | Relay between panes. `--from`, `--to`, `--message` or `--capture` |
| `export <name>` | Export session to Markdown. `--output` |
| `tag <name> <tags...>` | Add tags. `-r` to remove |
| `describe <name> <text>` | Set session description |
| `stats [name]` | Session statistics |
| `add-window <name> <window>` | Add a window. `--command` |
| `rename-window <name> <idx> <new>` | Rename a window |
| `web` | Start the web dashboard. `--port`, `--host` |

The `relay` command enables inter-agent coordination. You can capture the output of one pane and pipe it as input to another — useful when one agent produces context that a second agent needs to act on. Use `--capture` to grab recent output from the source pane, or `--message` to send a literal string.

```bash
clux relay my-session --from 0.0 --to 0.1 --capture 50
clux relay my-session --from 0.0 --to 0.1 --message "refactor complete, review the diff"
```

## Web Dashboard

Launch the dashboard with `clux web`. It runs at `http://127.0.0.1:3456` by default. For LAN access, bind to all interfaces with `--host 0.0.0.0`.

The dashboard connects via WebSocket and renders live terminal output using xterm.js. The sidebar lists all active sessions with real-time status — sessions running Claude are detected automatically via process inspection and flagged with a distinct badge, no manual tagging required.

From the browser you can create new sessions, switch between panes using tabs, send commands, relay messages between panes (with a preview of captured output before sending), export sessions to Markdown, and terminate sessions. The interface uses a dark theme built on Radix color tokens and is fully responsive, collapsing to a slide-in sidebar on mobile screens.

Under the hood, the dashboard leverages tmux control mode for sub-16ms push latency when available, falling back to polling if control mode is not supported.

## REST API

The web server exposes a REST API for programmatic access and automation.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions` | List all sessions |
| GET | `/api/sessions/:name` | Get session details |
| POST | `/api/sessions` | Create session |
| DELETE | `/api/sessions/:name` | Kill session |
| POST | `/api/sessions/:name/send` | Send text to a pane |
| GET | `/api/sessions/:name/capture/:paneId` | Capture pane output (`?lines=N`) |
| GET | `/api/sessions/:name/export` | Export session as Markdown |
| POST | `/api/sessions/:name/relay` | Relay between panes |
| POST | `/api/sessions/:name/windows` | Add a window |
| DELETE | `/api/sessions/:name/panes/:paneId` | Kill a pane |
| PATCH | `/api/sessions/:name/windows/:index` | Rename a window |
| GET | `/api/settings` | Server configuration |

Clients can also connect via WebSocket on the same host and port. Messages are JSON-encoded — use `subscribe` to stream live pane output, `send` to push text to a pane, and `input` to forward raw terminal keystrokes.

## Architecture

The codebase is a single TypeScript package organized into three logical modules under `src/`: `core/` (tmux session management, SQLite metadata store, terminal parser, process detection), `cli/` (Commander-based commands), and `web/` (Express + WebSocket dashboard). TypeScript compiles to `dist/`, then esbuild bundles everything into a single `dist/index.js` for distribution. Session metadata is stored in SQLite at `~/.clux/sessions.db` with WAL mode enabled.

## Configuration

The web dashboard binds to `127.0.0.1:3456` by default. Override with CLI flags (`clux web --port 8080 --host 0.0.0.0`) or environment variables (`PORT`, `HOST`). All sessions are created with a 50,000-line scrollback buffer. Supported pane layouts: `tiled`, `even-horizontal`, `even-vertical`, `main-horizontal`, `main-vertical`.

## Development

For contributors working on clux itself:

```bash
git clone https://github.com/devhelp/clux.git && cd clux
npm install
npm run build           # compile TypeScript + esbuild bundle
npm run dev:web         # compile and run web dashboard locally
npm test                # run tests (vitest)
npm run test:coverage   # tests with coverage
npm run lint            # eslint
npm run format:check    # prettier check
```

## License

MIT
