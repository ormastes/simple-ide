# Simple IDE — Submodule Migration Plan

**Date:** 2026-06-04
**Goal:** Extract IDE/editor/office/dashboard apps into a standalone `simple-ide`
GitHub repo (submodule under `examples/`). The IDE is a dogfooding vehicle —
every feature exercises and hardens Simple's language, stdlib, and compiler.

## 1. GitHub Repo

- **Name:** `simple-ide` (`github.com/ormastes/simple-ide`)
- **Submodule path:** `examples/10_tooling/simple_ide`
- **Architecture:** MDSOC+ (MDSOC outer + ECS business layer)

## 2. Feature List

### Core IDE

| # | Feature | Maturity | Source | Simple Surface Stressed |
|---|---------|----------|--------|------------------------|
| 1 | **File Explorer** | NEW | — | `std.fs`, tree widget, async dir scan |
| 2 | **Simple Editor** | REAL (955+616 lines) | `src/app/editor/` | text buffer, syntax highlight, keymap |
| 3 | **LSP Support** | REAL | `editor_ctrl_lsp.spl` + `src/app/lsp/` | JSON-RPC, stdio transport, async I/O |
| 4 | **DAP Support** | REAL (4,078 lines) | `src/app/dap/` | protocol framing, breakpoints, variables |
| 5 | **Test Runner** | REAL (13,936 lines) | `src/app/test_runner_new/` | discovery, execution, coverage, async |
| 6 | **Console Log Screen** | NEW | — | `std.io`, ring buffer, ANSI parse |
| 7 | **Source Control (git+jj)** | NEW | — | process spawn, diff parse, status model |

### Viewers & Content

| # | Feature | Maturity | Source | Simple Surface Stressed |
|---|---------|----------|--------|------------------------|
| 8 | **MD Viewer** | REAL (180 lines) | `editor_markdown_helpers.spl` | markdown parse, heading/link resolve |
| 9 | **MD WYSIWYG Editor** | GAP (word-level) | plan exists | CSS layout, inline editing, selection |
| 10 | **PDF Viewer** | NEW | — | binary parse, page render, font decode |
| 11 | **Simple Viewer** (syntax-highlighted read-only) | NEW | — | lexer, theme tokens, scroll viewport |

### Office Suite (MDSOC+ / OpenOffice-inspired arch)

| # | Feature | Maturity | Source | Simple Surface Stressed |
|---|---------|----------|--------|------------------------|
| 12 | **Word** | REAL (306 lines) | `src/app/office/word/` | rich text model, toolbar, outline |
| 13 | **Excel (table-md)** | REAL (287 lines) | `src/app/office/sheets/` | cell grid, formulas, references |
| 14 | **PPT (slides)** | REAL (272 lines) | `src/app/office/slides/` | canvas, thumbnails, speaker notes |
| 15 | **DB Admin** | SCAFFOLD (37 lines) | `src/app/ide/db_admin.spl` | SQL parse, table browse, query exec |

### Integration

| # | Feature | Maturity | Source | Simple Surface Stressed |
|---|---------|----------|--------|------------------------|
| 16 | **Agent Dashboard** | SCAFFOLD | `src/app/ide/agent_dashboard.spl` + `src/app/dashboard/` | MCP tools, metrics, session model |
| 17 | **Game 2D/3D Support** | SCAFFOLD (116 lines) | `src/app/game/` | canvas, render loop, entity system |
| 18 | **LLM Dashboard** | REAL | `src/app/llm_dashboard/` | glassmorphism CSS, TUI panels |

### Platform Targets

| Target | Mechanism |
|--------|-----------|
| TUI (terminal) | `std.tui` + ANSI backend |
| GUI (desktop) | `std.gui` + X11/Wayland/macOS backend |
| Web | Tauri / Electron / WASM |
| VS Code Extension | existing `src/app/vscode_extension/` |

## 3. OpenOffice Arch -> MDSOC+ Mapping

OpenOffice uses a monolithic UNO component model. MDSOC+ mapping:

| OpenOffice Layer | MDSOC+ Equivalent |
|------------------|-------------------|
| UNO Component | MDSOC Capsule (one per document type) |
| XModel / XDocument | ECS Entity (Document entity with components) |
| XController / XFrame | UISession + Surface handle |
| XDispatch | Action / Effect pipeline |
| XPropertySet | ECS Component (typed data bag) |
| Toolkit / VCL | `std.ui` widget builder + `std.gui` backend |
| Filter registry | SFM feature module loader |
| Macro / Basic | Simple scripting (the language itself) |

Key differences from OO:
- No inheritance hierarchy — traits + composition only
- No global service manager — DI via capsule wiring
- Document = entity with typed components (text, cells, slides)
- AOP security aspect replaces OO's security manager

## 4. Migration Procedure (staged)

### Phase A — Repo Setup
1. Create `github.com/ormastes/simple-ide` (empty, MIT)
2. Add submodule at `examples/10_tooling/simple_ide`
3. Workaround: use git plumbing for submodule add (jj gitlink flip issue)

### Phase B — Copy Core (no move yet)
Copy into the new repo, preserving directory structure:
```
simple-ide/
  src/
    editor/         <- from src/app/editor/ (34 files)
    ide/            <- from src/app/ide/ (12 files)
    dap/            <- from src/app/dap/ (16 files)
    office/         <- from src/app/office/ (31 files)
    dashboard/      <- from src/app/dashboard/ (12 files)
    llm_dashboard/  <- from src/app/llm_dashboard/
    game/           <- from src/app/game/
    test_runner/    <- from src/app/test_runner_new/
  platform/
    vscode/         <- from src/app/vscode_extension/
    tui/            <- TUI shell
    gui/            <- GUI shell
    web/            <- Web shell
  doc/
    plan/
    research/
```

### Phase C — Wire Imports
- Update `use` paths: `use std.*` stays (stdlib in main repo)
- IDE-local imports use relative paths
- Main repo keeps `src/app/editor/` as a thin re-export or removes it

### Phase D — New Features (post-migration)
- File explorer, console log, source control, PDF viewer
- Word-level WYSIWYG MD editing (CSS layout engine)
- DB admin wiring to simple_db submodule

### Phase E — Remove from Main Repo
- Delete migrated `src/app/` directories
- Update FILE.md manifests
- Update doc cross-references

## 5. History Preservation

**Decision needed:** clean copy (simpler, loses blame) vs `git filter-repo`
subtree split (preserves history, complex). Recommend clean copy — the main
repo retains full history; the IDE repo starts fresh.

## 6. Blockers

- **Broken submodule:** `simple_deeplearning_study` gitlink is broken —
  fix before adding new submodules
- **jj gitlink flips:** submodule adds need git plumbing workaround
  (see memory: `feedback_jj_submodule_gitlinks.md`)
- **OpenOffice research:** no existing doc — Phase D should include
  `doc/01_research/app/ide/openoffice_mdsoc_mapping.md`
