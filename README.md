# Simple IDE

Self-hosted IDE, editor, and office suite written in [Simple](https://github.com/ormastes/simple).

A dogfooding vehicle — every feature exercises and hardens Simple's language,
stdlib, and compiler.

## Features

### Core IDE
- **Editor** — syntax-highlighted text editor with keymap, extensions, wiki
- **LSP** — full Language Server Protocol client (code actions, rename, formatting)
- **DAP** — Debug Adapter Protocol (breakpoints, variables, watch, multi-adapter: GDB, TRACE32, local)
- **Test Runner** — discovery, execution, coverage, async, results DB
- **File Explorer** — (planned)
- **Console Log** — (planned)
- **Source Control** — git + jj (planned)

### Viewers
- **Markdown Viewer/Editor** — headings, links, wiki index, quickfix
- **PDF Viewer** — (planned)
- **Simple Viewer** — syntax-highlighted read-only (planned)

### Office Suite (MDSOC+)
- **Word** — rich document editor with toolbar, outline sidebar
- **Sheets** — spreadsheet with cell grid, formulas, references
- **Slides** — presentation editor with thumbnails, canvas, speaker notes
- **Mail** — compose, folders, message views
- **Planner** — kanban, list, calendar, timeline views
- **DB Admin** — (planned)

### Integration
- **Agent Dashboard** — MCP tool registry, metrics
- **LLM Dashboard** — glassmorphism CSS, TUI panels, collectors
- **Game 2D/3D** — scaffold for game development support
- **VS Code Extension** — AI completion, diagnostics, debug adapter

## Structure

```
src/
  editor/         # Core editor (34 files)
  ide/            # IDE container and capabilities
  dap/            # Debug Adapter Protocol (16 files)
  office/         # Word, Sheets, Slides, Mail, Planner
  dashboard/      # Dashboard and monitoring
  llm_dashboard/  # LLM-specific dashboard
  game/           # Game support
  test_runner/    # Test framework (13K+ lines)
platform/
  vscode/         # VS Code extension
doc/
  plan/           # Migration and feature plans
  research/       # Architecture research
```

## Architecture

MDSOC+ (MDSOC outer + ECS business layer). Each document type is a capsule;
documents are ECS entities with typed components. No inheritance — traits +
composition only.

## Build

Requires the Simple compiler. From the parent `simple` repo:

```bash
bin/simple build
```

## License

MIT
