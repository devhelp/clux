# Clux

> **v0.1.0 — This project is under active development.** APIs, commands, and features may change without notice.

A tmux session multiplexer with a web dashboard and CLI. Clux lets you create, manage, and monitor multiple tmux sessions from the browser or command line. Run any command — LLM coding agents, dev servers, build scripts, or anything else. It supports inter-pane messaging, session tagging, and real-time output monitoring out of the box.

## Features

- Web dashboard with WebSocket live updates
- Real-time monitoring of pane output
- Create and manage tmux sessions running any command
- Send input and capture output from any pane without attaching
- Relay messages between panes
- Tag, search, and describe sessions with persistent metadata (SQLite)
- Export sessions to Markdown

## Prerequisites

- Node.js >= 18
- tmux

## Installation

```bash
git clone <repo-url> && cd clux
npm install
npm run build
```

## Web Dashboard

The web package provides a browser UI backed by Express and WebSocket with live session state, pane output, and session management.

```bash
npm run dev:web
```

The dashboard runs at `http://127.0.0.1:3456` by default. Configure via environment variables (see `.env.example`).

## CLI

After building, you can also manage sessions from the command line:

```bash
node packages/cli/dist/index.js --help
```

Or create an alias:

```bash
alias clux="node $(pwd)/packages/cli/dist/index.js"
```

### Quick Start

Create a session with an LLM agent:

```bash
clux create my-project --command claude --path ~/projects/my-app
```

List running sessions:

```bash
clux ls
```

Send a prompt to a running session:

```bash
clux send my-project "refactor the auth module"
```

Capture the current output:

```bash
clux capture my-project --lines 100
```

Attach to a session interactively:

```bash
clux attach my-project
```

### Commands

| Command | Description |
|---------|-------------|
| `create <name>` | Create a new session. Supports `--command`, `--path`, `--layout` |
| `list` / `ls` | List all sessions. Filter with `--tag` or `--search` |
| `info <name>` | Detailed session info |
| `attach <name>` | Attach to a session (Ctrl+B D to detach) |
| `kill <name>` | Kill a session |
| `send <name> <text>` | Send text to a pane. Use `--pane` to target a specific pane |
| `capture <name>` | Capture pane output. `--all` for full scrollback, `-o` to write to file |
| `monitor <name>` | Watch pane output in real-time |
| `relay <name>` | Relay messages between panes (`--from`, `--to`, `--message` or `--capture`) |
| `add-window <name> <win>` | Add a new window to a session |
| `rename-window <name> <idx> <new>` | Rename a window |
| `export <name>` | Export session to Markdown |
| `tag <name> <tags...>` | Add or remove (`-r`) tags |
| `describe <name> <text>` | Set session description |
| `stats [name]` | Session statistics (commands sent, duration) |

## Project Structure

```
clux/
  packages/
    core/       # Session management, tmux wrapper, metadata store
    cli/        # Commander-based CLI (@clux/cli)
    web/        # Express + WebSocket dashboard (@clux/web)
```

This is an npm workspaces monorepo. The `core` package is a shared dependency used by both `cli` and `web`.

## Development

```bash
# Build everything
npm run build

# Build individual packages
npm run build:core
npm run build:cli
npm run build:web

# Run the web dashboard in dev mode
npm run dev:web

# Run tests
npm test
npm run test:watch
npm run test:coverage

# Lint and format
npm run lint
npm run lint:fix
npm run format
npm run format:check

# Clean build artifacts
npm run clean
```

## License

MIT
