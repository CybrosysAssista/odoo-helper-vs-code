# Changelog

All notable changes to the **cybrosys-assista-odoo-helper** extension will be documented in this file.

Check out [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) for guidelines.

## [3.1.1] - 2026-10-08
### Changed
- Open VSX and the Assista IDE: published as `cybrosys-assista-ltd.cybrosys-assista-odoo-helper`.

### Fixed
- README logo: the "Assista" text was invisible on VS Code's extension page in dark themes.

## [3.1.0] - 2026-10-08
### Changed
- The extension ships as an esbuild bundle: 22 files (about 600 KB) instead of about 800, for faster activation.
- The XML parser is loaded only once an XML file is open.
- Saved indexes are smaller (file paths stored once) and are saved and loaded in small steps; the longest pause of the editor on startup went from about 260 ms to about 60 ms on the full Odoo 20 source.
- The model under the cursor is worked out once per edit instead of on every cursor move (around 100 ms less per cursor stop in very large files).
- Manifest path completion reads folders asynchronously.
- README rewritten from the code, with accurate feature, snippet and settings references.

### Fixed
- Files created while the first index was running could be dropped from the index.
- Files of a folder that became a module (a `__manifest__.py` or `__init__.py` added later) were not indexed until edited.
- A file that crashes the background indexer is now skipped on its own; previously, after three crashes all parsing moved into the editor process.
- Manifest asset paths (`my_module/static/...`) did not complete beyond the module name.
- `def _compute_` / `_inverse_` / `_search_` field-name suggestions never appeared; they now list the fields of the enclosing class.
- Module Dependency Graph and Model Inheritance Graph were not reachable from any menu (now in the Explorer **Assista Odoo** menu and **Odoo Model Tools**).
- HTML reports were saved as `*_pdf_report.xml`; the report folder was created even when the command was cancelled.
- Odoo 18/19: data lists generated from Odoo's code (missing field types, removed `states`/`track_visibility`, non-existent decorators), kanban `card` templates, settings and cron templates, POS screen patches, OWL dashboard controller (`auth='user'`, `_read_group`).
- Install Module pointed to a settings sidebar that does not exist, and asked for confirmation in a notification that could stay hidden under its own progress notification; it now asks in a dialog.
- Field widgets, client actions, views and services registered with an object literal (`add("many2one", { component: ... })`), chained `.add()` calls or a category alias were not found: about 1,400 registrations are now found in Odoo 20 instead of about 950.
- QWeb template ids that already contain the module (`web.layout`) were indexed twice-qualified (`web.web.layout`), and `<template id=... inherit_id=...>` could be indexed under the inherited template's name.

## [3.0.0] - 2026-10-07
### Added
- Full Odoo 20 support: snippets, completions, view/report/security/settings/cron templates, module scaffolds, OWL 3 components and POS templates generate Odoo 20 code (`ir.access`, `res.groups.privilege`, `models.Constraint`, kanban `card`, Material Symbols, `jsonrpc` routes, `GeneratePrinterData` receipts).
- XML tag and attribute completions generated from each Odoo version's schemas and core views; Odoo 20 `card` view.
- Field-name completion inside every view type (calendar, graph, card, activity, hierarchy).

### Changed
- Indexing moved to a low-priority background process with a saved, incremental index; activation only in Odoo workspaces; commands load lazily.
- Indexing no longer shows status-bar progress.
- Default Odoo version is 20 when none is detected.
- New extension icon and logo.

### Fixed
- XML attribute completion never appeared; `widget` was suggested on every tag; `view_mode` suggested `tree`.
- Search view group-by `<group>` used `expand`/`string`, rejected since Odoo 19.
- Window actions from "Create Views" opened on a blank form.
- Cron templates used the removed `numbercall` field; report templates bound to the wrong model.
- Odoo 19 security groups used `category_id`/`groups_id`; settings view referenced a missing view.
- Snippets: `states=` buttons, Binary `max_size`, `_sql_constraints` on 19, `notify_*` utilities, empty view-inherit body.
- "Create Access Right" no longer writes a rule with an empty group (open to everyone); generated reports label fields with their Odoo labels instead of technical names.

## [2.1.1] - 2026-02-02
### Added
- POS component creation.
- OWL component creation.
- Advance report creation.
- Advance view creation.
- Create security file.
- Add to init from file.
- Added new and updated smart suggestions.
- Odoo aware go to navigations.
- Odoo server connectivity.
- Significant performance improvements.
- Minor bug fixes.


## [1.4.1] - 2025-07-22
### Changed
- Completions fix.

## [1.4.0] - 2025-07-22
### Added
- `t-call` suggestion in XML templates.
- Manifest `depends` suggestion.
- XPath position suggestion.
- Navigation added.
- `@api` field suggestion in Python.
- Chatter snippet updated.

## [1.3.1] - 2025-07-04
### Changed
- New logo added.

## [1.3.0] - 2025-06-30
### Added
- Settings to disable odoo warnings.
### Changed
- Minor enhancements and publishing metadata adjustments.

## [1.2.0] - 2025-06-13
### Added
- Rebranded extension as **Assista Odoo Helper**.
- Updated logo.

## [1.1.2] - 2025-06-13
### Fixed
- Miscellaneous image and metadata issues.

## [1.1.1] - 2025-06-13
### Fixed
- Publishing issues and metadata cleanup.

## [1.1.0] - 2025-06-13
### Added
- Initial full feature set including Odoo model, view, and menu file creation.
- Owl scaffolding: basic and advanced.
- View and model validations.
- Auto-suggestion for relational fields and decorators.
- Traversal and inverse suggestion.
- Python and XML snippet standards.
- Warning system for standard issues.

## [1.0.1] - 2025-06-05
### Fixed
- Author and website link in metadata.

## [1.0.0] - 2025-05-26
### Added
- Initial release.
- Full basic Odoo code assistance.
- View/model snippets.
- Decorator suggestions.
- Modular code structure.
