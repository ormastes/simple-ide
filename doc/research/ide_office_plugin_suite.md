# IDE Office Plugin Suite Local Research

## Objective
Integrate IDE app/plugin support for markdown, slides/PPT, sheets/Excel-like tabular data, agent dashboard, GUI/TUI sanity checks, and database administration without duplicating existing subsystem logic.

## Existing Implementation To Reuse

- IDE entrypoint: `src/app/ide/main.spl` is a thin launcher over `std.editor.core.launch`.
- Shared editor app: `src/app/editor/` contains controller, TUI shell, GUI shell, markdown dispatch/helpers, LSP integration, MCP tools, and workspace symbol helpers.
- Shared editor library: `src/lib/editor/` provides session/workspace, plugin host, TUI/GUI/headless backends, markdown renderer, outline panel, preview pane, theme manager, extension host, command palette, LSP client, and DB-backed session support.
- Plugin registry: `src/app/plugin/registry.spl`, `loader.spl`, and `main.spl` already implement manifest parsing, merging, duplicate symbol checks, install/remove/list, and library readiness checks.
- Office suite: `src/app/office/launcher.spl`, `render_adapter.spl`, and app-specific modules under `word/`, `sheets/`, `slides/`, `mail/`, and `planner/` provide app construction and rendering surfaces.
- Markdown rendering: `src/lib/editor/render/md_renderer.spl`, `src/app/editor/md_dispatch.spl`, and `src/app/editor/editor_markdown_helpers.spl` are the existing markdown path.
- Slides/PPT-like surface: `src/app/office/slides/{slide,slides_app,render,templates}.spl` provides slide deck models, app UI, rendering, and templates.
- Sheets/Excel-like surface: `src/app/office/sheets/{cell_ref,cell,formula,spreadsheet,sheets_app}.spl` provides spreadsheet data, formulas, refs, and UI.
- Dashboard surfaces: existing docs/specs include `kairos_like_simple_mcp_llm_dashboard` and generated dashboard specs under `doc/06_spec/feature/app/web_dashboard/`; app code is mostly web/compiler-dashboard oriented rather than a first-class IDE app capability.
- Database surfaces: `src/app/portal/db/migrations.spl`, portal models/services, `src/app/simple_portal/content_db.spl`, and `src/lib/editor/core/session_db.spl` are existing DB-related paths. Separate Simple DB docs exist under `doc/05_design/simple_db_design.md`.

## Duplication Boundaries

- Do not create a second plugin manifest parser; use `app.plugin.registry`.
- Do not create a new markdown renderer; use `std.editor.render.md_renderer` and editor markdown helpers.
- Do not create new slide or spreadsheet data models for IDE integration; extend/reuse `app.office.slides` and `app.office.sheets`.
- Do not fork editor TUI/GUI launch logic; the IDE entrypoint should remain a thin product surface over shared editor launch/backends.
- Do not create a separate dashboard or DB backend for IDE capability listing; expose existing dashboard and DB modules as capabilities first.

## Gaps Found

- `src/app/ide/main.spl` only prints startup mode/file count; it does not expose IDE app/plugin capability metadata or feature-check output.
- Office apps are present but are not registered as IDE/plugin capabilities.
- Slide outline support exists in the editor outline panel and word sidebar, but slide deck outline/style metadata needs an office-slide-specific reusable representation.
- Spreadsheet modules exist, but IDE capability metadata does not advertise Excel/tabular compatibility.
- DB/admin support exists in portal/simple portal/editor session DB paths, but no IDE DB admin capability surface is registered.

## Next Implementation Slice

Add a small reusable IDE capability registry under `src/app/ide/` that describes existing app/plugin capabilities and prints a focused `--feature-check` report from the IDE entrypoint. The registry should reference existing module ownership in metadata only, avoiding duplicate renderers/models.

## Implementation Evidence Added

- `src/app/ide/capabilities.spl` registers IDE capabilities and routes feature-check text through focused adapters.
- `src/app/ide/sheets_compat.spl` probes `app.office.sheets` workbook, sheet range, and formula evaluation support.
- `src/app/ide/db_admin.spl` exposes DB admin targets over `std.editor.core.session_db`, `app.simple_portal.content_db`, and portal migrations ownership.
- `src/app/ide/agent_dashboard.spl` checks existing editor MCP tools for dashboard-relevant LSP/wiki categories.
- `src/app/ide/markdown_render.spl` checks the shared Markdown block model, TUI renderer, and preview pane path.
- `src/app/ide/launch_sanity.spl` checks TUI, GUI, and SDL launch-mode parsing through `std.editor.core.launch`.
- `src/app/ide/plugin_manifest.spl` converts IDE app capabilities into the existing `app.plugin.registry` manifest shape and verifies parser/serializer round-trip.
- `src/app/office/slides/outline.spl` adds slide outline/style helpers over the existing presentation model.
- `src/app/office/slides/design.spl` adds per-slide CSS-like design metadata over existing slide IDs, backgrounds, and outline styles.
