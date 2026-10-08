<p align="center">
  <picture>
    <source media="(prefers-color-scheme: light)" srcset="https://github.com/CybrosysAssista/odoo-helper-vs-code/raw/HEAD/logo/assista-logo-title-ink.png"/>
    <img src="https://github.com/CybrosysAssista/odoo-helper-vs-code/raw/HEAD/logo/assista-logo-title.png" alt="Cybrosys Assista" width="300"/>
  </picture>
</p>

<h1 align="center">Cybrosys Assista: Odoo Helper</h1>

<p align="center"><b>Odoo tooling inside VS Code</b> — for Odoo 18, 19 and 20</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=CybrosysTechnologiesOdooOfficialPartner.cybrosys-assista-odoo-helper">VS Code Marketplace</a> ·
  <a href="https://assista.cybrosys.com/helper-for-vs-code">Website</a> ·
  <a href="https://assista.cybrosys.com/contact">Contact</a> ·
  <a href="mailto:assista@cybrosys.com">assista@cybrosys.com</a> ·
  <a href="https://github.com/CybrosysAssista/odoo-helper-vs-code/issues">Report an issue</a>
</p>

---

**Cybrosys Assista** is a family of tools for Odoo developers and teams, built by [Cybrosys Technologies](https://www.cybrosys.com/) — from writing code in your editor to deploying and running Odoo.

**Cybrosys Assista: Odoo Helper** brings Assista's Odoo tooling into VS Code: completions, model and view scaffolding, and Odoo-aware XML and Python snippets. It understands your Odoo project — models, fields, methods, XML IDs, QWeb templates, JavaScript registries and CSS classes — and uses them to suggest the right names as you type, jump to definitions, and generate views, reports, security files, OWL components and whole modules for the Odoo version you work on.

### The Cybrosys Assista family

| Product | |
|---|---|
| **[Assista IDE](https://assista.cybrosys.com/assista-ide)** | An Odoo-native IDE with the Assista agent built in: code assistance, one-click environments, templates and module review in one workspace. |
| **[Cybrosys Assista: Odoo Helper](https://assista.cybrosys.com/helper-for-vs-code)** for VS Code | This extension. |
| **[Cybrosys Assista: Odoo Helper](https://plugins.jetbrains.com/plugin/27635-cybrosys-assista-odoo-helper/)** for PyCharm | The same Odoo tooling inside PyCharm. |
| **[EasyInstance](https://easyinstance.com/)** | Set up Odoo instances in one click, then track performance, activity logs and subscriptions from one dashboard. |
| **[Assista X](https://x.cybrosys.com)** | An AI chat assistant for your Odoo data: answers, charts and reports. |
| **[Assista Air](https://assista.cybrosys.com/assista-air)** | Chrome extensions for Odoo: tab management, one-click user switching and smart record filtering. |

## Contents

- [Highlights](#highlights)
- [Getting started](#getting-started)
- [Odoo version support](#odoo-version-support)
- [Python intelligence](#python-intelligence)
- [XML intelligence](#xml-intelligence)
- [Manifest intelligence](#manifest-intelligence)
- [Go to Definition](#go-to-definition)
- [Snippets](#snippets)
- [Generate code from a model](#generate-code-from-a-model)
- [Explorer menu: files, modules, components](#explorer-menu-files-modules-components)
- [Other commands](#other-commands)
- [Odoo server connection](#odoo-server-connection)
- [Code standards linter](#code-standards-linter)
- [Performance](#performance)
- [Settings](#settings)
- [Known limitations](#known-limitations)
- [Contact and support](#contact-and-support)

---

## Highlights

- **Version-aware** — every suggestion, snippet and generated file follows the Odoo version of your project (18, 19 or 20), detected automatically.
- **Project-aware completions** — models, fields, methods, XML IDs, templates, widgets, client actions and CSS classes come from an index of *your* workspace, including Odoo's own source when it is in the workspace.
- **Go to Definition** across XML and Python: from a view to the field, from a button to the method, from `_inherit` to the model, from a manifest entry to the file.
- **Generators** — create views, QWeb reports and access rights straight from a model class; scaffold six kinds of modules, OWL components and POS screen extensions.
- **Lightweight** — indexing runs in a separate, low-priority background process; typing never waits for it.

---

## Getting started

1. Install **Cybrosys Assista: Odoo Helper** from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=CybrosysTechnologiesOdooOfficialPartner.cybrosys-assista-odoo-helper), or search for it in the Extensions view, or run `ext install CybrosysTechnologiesOdooOfficialPartner.cybrosys-assista-odoo-helper` in Quick Open (**Ctrl+P**). For a `.vsix` file, use **Extensions: Install from VSIX…**. Requires VS Code 1.85 or newer.
2. Open a folder that contains Odoo modules. The extension activates when the workspace contains a `__manifest__.py` or an `odoo/release.py`.
3. Check the Odoo version in the status bar (for example `Odoo v20 (Auto)`). Click it to change the version.
4. Start typing — completions appear automatically. Right-click a folder in the Explorer and choose **Assista Odoo** for the generators.

A few seconds after the window opens, the extension indexes the workspace in the background. Completions that depend on the index (model and field names, for example) are available as soon as it is ready. The next time you open the workspace, the saved index is reused and only changed files are read again.

> **Tip:** add the Odoo source (the folder with `odoo/` and `addons/`) to your workspace, so that core models, fields and templates are suggested too.

---

## Odoo version support

Completions, snippets, generators and scaffolds support **Odoo 18, 19 and 20**.

**How the version is chosen** — setting `cybrosys-assista-odoo-helper.odooVersion`:

- `18`, `19` or `20` — always used as set.
- `auto` (default) — detected, in this order:
  1. `odoo/release.py` found in the workspace;
  2. `odoo/release.py` under the **Odoo Source Path** setting, then under `$ODOO_HOME`;
  3. an `odoo` version pin in `requirements*.txt`, `.in` or `.ini` files;
  4. otherwise **20**.

  `saas~N` versions are recognised. Versions above 20 are treated as 20, older ones as 18.

Change the version from the status bar item or with **Assista: Set Odoo Version**.

**What changes with the version** — examples:

| Topic | Odoo 18 | Odoo 19 | Odoo 20 |
|---|---|---|---|
| Access rights file | `ir.model.access.csv` | `ir.model.access.csv` | `ir.access.csv` (`ir.access`, with `operation` and `domain`) |
| Security groups | `category_id` | `privilege_id` (`res.groups.privilege`) | `privilege_id` |
| SQL constraints | `_sql_constraints` | `models.Constraint` | `models.Constraint`, `models.Index`, `models.UniqueIndex` |
| JSON routes | `type='json'` | `type='jsonrpc'` | `type='jsonrpc'` |
| OWL | OWL 2 | OWL 2 | OWL 3 |
| Report action | with `report_file` | with `report_file` | without `report_file` |
| Manifest version | `18.0.1.0.0` | `19.0.1.0.0` | `20.0.1.0.0` |

---

## Python intelligence

Completions in `.py` files. Items marked *index* need the background index.

| You type | You get |
|---|---|
| `fields.` | Field classes of your version (`Char`, `Many2one`, `Properties`, …), inserted as `Char(string="…")`. |
| `=` inside a `fields.X(...)` call | Field parameters valid for your version (`string`, `required`, `compute`, `ondelete`, `tracking`, …). |
| `@` | `api.` decorators of your version (`api.depends`, `api.constrains`, `api.onchange`, `api.model_create_multi`, …). |
| `fields.Many2one('` (also `One2many`, `Many2many`, `comodel_name='`) | Model names. *index* |
| `_inherit = '` (string, list or tuple) | Model names. *index* |
| `self.env['` | Model names. *index* |
| `fields.One2many('model', '` or `inverse_name='` | The `Many2one` fields of that model that point back to the current model. *index* |
| `self.` and `record.` inside `for record in …` | Fields of the current model; continues through relations (`self.partner_id.` → fields of `res.partner`). *index* |
| `@api.depends('` / `@api.onchange('` | Fields of the current model. *index* |
| `def _compute_`, `def _inverse_`, `def _search_` | Field names of the current class, to complete the method name. |
| `def ` in a class with `_inherit` | Methods of the inherited model; choosing one inserts the override with a `super()` call. *index* |
| `odoo …` | All Odoo [snippets](#snippets) (models, fields, methods, errors, actions) and import snippets (`odoo common imports`, `odoo import exceptions`, `odoo import http request`, `odoo import logging`, …). |

---

## XML intelligence

Completions in `.xml` files.

| Where the cursor is | You get |
|---|---|
| `<` (typing a tag name) | The tags of your version: data tags (`record`, `field`, `menuitem`, `template`, …), every view type (`form`, `list`, `kanban`, `card` on 20, `search`, `calendar`, `graph`, `pivot`, `activity`, `hierarchy`), view elements and QWeb `t`. |
| Inside a tag | Only the attributes that tag accepts in your version, taken from Odoo's own schemas and core views (for example `card_id` and `dialog_size` on 20, `date_delay` on 18/19). |
| `<field name="` / `<filter name="` inside a view | Fields of the view's model (the `<field name="model">` of the view record). *index* |
| `<button name="` with `type="object"` | Methods of the view's model. *index* |
| `<record model="` | Model names. *index* |
| Text of `<field name="model">` (views) or `<field name="res_model">` (window actions) | Model names. *index* |
| Text of `<field name="view_mode">` | `list`, `form`, `kanban`, `pivot`, `graph`, `calendar`, `activity`, `hierarchy`. |
| Text of `<field name="tag">` in an `ir.actions.client` record | Client action tags registered in JavaScript. *index* |
| `widget="` on a field | Field widgets registered in JavaScript (`registry.category("fields")`), with their module. *index* |
| `t-call="` | QWeb template IDs. *index* |
| `t-component="` / `<owl-component name="` | Public components (`public_components` registry). *index* |
| `position="` on `<xpath>` | `after`, `before`, `inside`, `replace`, `attributes`. |
| `class="` | CSS classes, ordered: current module, then `web`, `base`, `mail`, `portal`, then the rest. *index* |
| `odoo …` | All XML [snippets](#snippets). |

---

## Manifest intelligence

In `__manifest__.py`:

- **`depends`** — module names from your workspace when you open a quote on a line containing `depends`. *index*
- **`data`, `demo` and `assets` paths** — the module's files and folders as you type a path; choosing a folder continues into it. Asset paths start with the module name (`my_module/static/src/…`), as Odoo expects.

---

## Go to Definition

Use **F12**, **Ctrl+Click** or **Peek Definition** (**Alt+F12**).

**From XML**

| On | Goes to |
|---|---|
| `<field name="…">`, `<filter name="…">` in a view | The field in Python (all definitions, as a peek list when there are several). |
| `<button name="…" type="object">` | The Python method. |
| `model="…"`, `<field name="model">…`, `<field name="res_model">…` | The model class. |
| `ref="…"`, `inherit_id="…"`, `parent="…"`, `action="…"` | The XML record, menu item or template with that ID. |
| `t-call="…"`, `t-name="…"` | The QWeb template. |
| `widget="…"` | The JavaScript registration of the widget. |
| `<field name="tag">…` in a client action | The JavaScript registration of the action. |
| A class in `class="…"` | Its CSS/SCSS definition in the current module, `web` or `mail` (turn on **Advanced CSS Indexing**). |

**From Python**

| On | Goes to |
|---|---|
| A model name in `_inherit` | The model's definitions. |
| `self.env['model.name']` | The model class. |
| `self.field_name`, `self.partner_id.name` | The field (or method), following relations. |
| `related='partner_id.country_id'` | The field at the end of the chain. |
| A module name in the manifest `depends` | That module's `__manifest__.py`. |
| A path in the manifest `data`, `demo` or `assets` | The file, or the folder in the Explorer. |

---

## Snippets

Type the snippet prefix — they all start with `odoo` — and pick it from the suggestions. Press **Tab** to move between placeholders. Snippets follow your Odoo version.

### Python — models

| Snippet | 18 | 19 | 20 |
|---|:-:|:-:|:-:|
| Odoo New Model Class | ✓ | ✓ | ✓ |
| Odoo Classical Inherited Model Class (`_name` + `_inherit`) | ✓ | ✓ | ✓ |
| Odoo Delegated Inherited Model Class (`_inherits`) | ✓ | ✓ | ✓ |
| Odoo Extended Inherited Model Class (`_inherit`) | ✓ | ✓ | ✓ |
| `odoo abstract model` | ✓ | ✓ | ✓ |
| `odoo transient model` | ✓ | ✓ | ✓ |
| `odoo sql constraints` (`_sql_constraints`) | ✓ | | |
| `odoo constraint` (`models.Constraint`) | | ✓ | ✓ |
| `odoo index`, `odoo unique index` | | | ✓ |
| `odoo controller` (`http` and `jsonrpc` routes) | | | ✓ |

### Python — fields

Odoo Boolean, Char, Text, Html, Integer, Float, Monetary, Date, Datetime, Selection, Many2one, One2many, Many2many, Binary, Image, Reference and Json **Field** in all versions, plus **Many2oneReference Field** on 20.

### Python — methods

| Snippet | 18 | 19 | 20 |
|---|:-:|:-:|:-:|
| Odoo Create, Write, Unlink Method | ✓ | ✓ | ✓ |
| Odoo Onchange, Compute, Constraints Method | ✓ | ✓ | ✓ |
| Odoo Ondelete Method (`@api.ondelete`) | | | ✓ |
| Odoo Search Name Method (`_search_display_name`) | | | ✓ |
| Odoo Display Name Method (`_compute_display_name`) | | | ✓ |
| Odoo Default Get Method | | | ✓ |
| Odoo Action Method | | | ✓ |

Typing `@api.` also offers each decorator as a ready-made method (`@api.depends` with a `def` below it).

### Python — errors, notifications and actions

In all versions: Odoo Validation Error, User Error, Access Error, Missing Error, Redirect Warning, Notification (`display_notification`), Rainbow Man, Return Action (`ir.actions.act_window`) and URL Action (`ir.actions.act_url`).

### XML

In all versions:

| Views | View elements | Fields | Data |
|---|---|---|---|
| `odoo form view` | `odoo sheet` | `odoo field` | `odoo record` |
| `odoo list view` | `odoo header` | `odoo field widget` | `odoo action` |
| `odoo search view` | `odoo notebook` | `odoo field invisible` | `odoo menu root` |
| `odoo kanban view` | `odoo page` | `odoo field readonly` | `odoo menu category` |
| `odoo calendar view` | `odoo chatter` | `odoo field required` | `odoo menu action` |
| `odoo graph view` | `odoo button box` | `odoo field state` | `odoo groups` |
| `odoo pivot view` | `odoo smart button` | `odoo domain` | `odoo xml` |
| `odoo view inherit` | `odoo object button` | `odoo options` | |
| `odoo xpath` | `odoo action button` | | |
| | `odoo label` | | |

Odoo 20 adds `odoo editable list`, `odoo field optional`, `odoo column invisible`, `odoo ribbon`, `odoo settings` (settings app and block), `odoo report` (report action), `odoo cron` and `odoo access` (`ir.access` rule).

### Examples (Odoo 20 output)

`odoo form view`

```xml
<record id="model_name_view_form" model="ir.ui.view">
    <field name="name">model.name.view.form</field>
    <field name="model">model.name</field>
    <field name="arch" type="xml">
        <form>
            <sheet>
                <div class="oe_title">
                    <h1><field name="name" placeholder="Name"/></h1>
                </div>
                <group>
                    <group>
                        <field name="name"/>
                    </group>
                </group>
            </sheet>
        </form>
    </field>
</record>
```

`odoo kanban view`

```xml
<record id="model_name_view_kanban" model="ir.ui.view">
    <field name="name">model.name.view.kanban</field>
    <field name="model">model.name</field>
    <field name="arch" type="xml">
        <kanban sample="1">
            <templates>
                <t t-name="card">
                    <field name="name" class="fw-bold fs-5"/>
                </t>
            </templates>
        </kanban>
    </field>
</record>
```

`odoo access`

```xml
<record id="access_model_name_user" model="ir.access">
    <field name="name">model.name user</field>
    <field name="model_id" ref="model_model_name"/>
    <field name="group_id" ref="base.group_user"/>
    <field name="operation">crud</field>
    <field name="domain">[(1, '=', 1)]</field>
</record>
```

Odoo New Model Class

```python
from odoo import api, fields, models


class ModelName(models.Model):
    _name = 'model.name'
    _description = 'Model Description'
    _order = 'name'

    name = fields.Char(string='Name', required=True)
    active = fields.Boolean(default=True)

    _name_uniq = models.Constraint('unique(name)', 'The name must be unique.')
```

Odoo Ondelete Method

```python
@api.ondelete(at_uninstall=False)
def _unlink_except_done(self):
    for record in self:
        if record.state == 'done':
            raise UserError(self.env._("You cannot delete this record."))
```

Odoo Notification

```python
return {
    'type': 'ir.actions.client',
    'tag': 'display_notification',
    'params': {
        'title': self.env._("Title"),
        'message': self.env._("Message"),
        'type': 'success',
        'sticky': False,
    },
}
```

---

## Generate code from a model

Right-click inside a model class in a Python file and open **Odoo Model Tools**.

### Create Views

Builds a views file for the model.

1. Choose the views: Form, List, Kanban, Search, Calendar, Pivot, Window Action and Menu.
2. Choose **Quick Create** (all fields) or **Advanced Builder** (pick the fields of each view; for `One2many` fields in the form, pick the columns of the embedded list).

The file is written to `views/<model>_views.xml`, added to the manifest `data` list and opened. The output follows your version — `<list>`, a kanban `card` template, `<chatter/>` when the model inherits `mail.thread`, a calendar only when a date field is chosen, and a window action that does not open on the form. Available for models that define `_name`.

### Create Report

Builds a QWeb report.

1. Choose **PDF** or **HTML**.
2. Choose the title field, the fields shown in the header, and optionally a `One2many` or `Many2many` field with its columns for a line table.

Writes `report/<model>_pdf_report.xml` or `report/<model>_html_report.xml` with the `ir.actions.report` record (in the model's **Print** menu) and a template based on `web.external_layout`, and adds it to the manifest.

### Create Access Right

Adds an access rule for the model, for internal users (`base.group_user`), with full permissions:

- Odoo 20: a row in `security/ir.access.csv` (`operation` = `crud`);
- Odoo 18 and 19: a row in `security/ir.model.access.csv`.

The file is created with its header if needed, added to the manifest and opened. Nothing is added when the model already has a rule.

### Model Inheritance Graph

Shows the model at the cursor, every module that extends it, and the fields and methods each one adds. Double-click a node to open its code. Needs an internet connection (the graph library is loaded from unpkg.com).

---

## Explorer menu: files, modules, components

Right-click a folder in the Explorer and open **Assista Odoo**.

### Create Odoo File

| Entry | Options and result |
|---|---|
| **Create Model File** | `__init__`, `__manifest__`, `Odoo Model`, `Odoo Controller`. Model and controller files are created inside a module, not at its root. |
| **Create View File** | Empty View, Basic View, Advanced View, Inherit View, Report View, Security Group View, Security Rule View, Sequence View, Settings View, Cron Job View. |
| **Create Security File** | On the module's `security` folder: asks for a model and adds an access row to the access file of your version. |
| **Add to `__init__.py`** | Adds `from . import <name>` for the file or folder to the parent `__init__.py`. |

### Create Odoo Module

Asks for a technical name (lowercase letters and `_`) and creates the module in the selected folder.

| Module | Contents |
|---|---|
| **Create Basic Module** | Manifest, a model, its views and the access file. |
| **Create Advanced Module** | Basic Module plus sequence and cron data and demo data. |
| **Create Basic OWL Module** | Basic Module plus an OWL client action (JavaScript and XML template). |
| **Create Advanced OWL Module** | Advanced Module plus an OWL dashboard with charts, fed by a JSON controller. Odoo 20 uses Chart.js through Odoo's `web.chartjs_lib`; 18 and 19 use Google Charts. |
| **Create Module with Systray Menu** | A systray item (OWL component and template). |
| **Create Website Theme** | Layout, header and footer templates for `website`. |

### Create Owl Components

Asks for a component name, creates the files in the current module and adds them to the manifest `assets`.

| Component | Created in | Bundle |
|---|---|---|
| **Common Component** | `static/src/components/<name>/` (`.js`, `.xml`, `.css`) | `web.assets_backend` |
| **Field Widget Component** | `static/src/views/fields/<name>/` (`.js`, `.xml`, `.scss`) | `web.assets_backend` |
| **Public Component** | `static/src/components/<name>/` (`.js`, `.xml`, `.scss`), registered in `public_components` | `web.assets_frontend` on 20, `web.assets_backend` on 18 and 19 |
| **Owl Service** | `static/src/services/<name>/<name>.js` | `web.assets_backend` |

The folder name is the component name in lowercase without spaces (`MyWidget` → `mywidget`). Odoo 20 components use OWL 3.

### POS Components → Extend Screen

Extends a Point of Sale screen with `patch()` and template inheritance, adds the files to `point_of_sale._assets_pos` and `point_of_sale` to `depends`.

| Screen | Files under `static/src/app/screens/` |
|---|---|
| **Product Screen** | `product_screen/product_screen.{js,xml,scss}` |
| **Partner List Screen** | `partner_list/partner_list.*` on 20; `partner_list_screen/partner_list_screen.*` on 18 and 19 |
| **Payment Screen** | `payment_screen/payment_screen.*` |
| **Receipt Screen** | On 20: `receipt/generate_printer_data.js` (patches the receipt data) and `views/pos_order_receipt.xml` (extends the `point_of_sale.pos_order_receipt_footer` template). On 18 and 19: `receipt_screen/receipt_screen.*` |
| **Order Management Screen** | `ticket_screen/ticket_screen.*` |

### Create Report

**Create PDF Report** or **Create HTML Report** — creates a report template file (the *Report View* template) in the selected folder.

### Install Module and Module Dependency Graph

- **Install Module** — on a module folder: installs the module on your configured [Odoo server](#odoo-server-connection), or upgrades it when it is already installed (after confirmation).
- **Module Dependency Graph** — on a module folder: shows the module's `depends` tree. Click a module to open its manifest, or download the graph as HTML. Needs an internet connection.

---

## Other commands

From the Command Palette (**Ctrl+Shift+P**):

| Command | What it does |
|---|---|
| **Assista: Set Odoo Version** | Auto, 20, 19 or 18 for this workspace (also from the status bar). |
| **Assista: Update Odoo Server Settings** | Server URL, database, user and password (also from the status bar). |
| **Assista: Remove Index Data (Clear Cache)** | Deletes the saved index. Reload the window to rebuild it. |
| **Add File to Manifest** | Adds the current file to the manifest `data` list. |
| **Add to \_\_init\_\_.py** | Also in the editor and Explorer context menus for Python files and folders. |

---

## Odoo server connection

Connect a running Odoo server to install modules from VS Code and to see which modules are installed in the Model Inheritance Graph.

1. Click **Odoo Server** in the status bar, or run **Assista: Update Odoo Server Settings**.
2. Enter the URL, database, user and password.

The status bar then shows the server host. The connection uses Odoo's XML-RPC API.

> **Note:** these settings, including the password, are stored as plain text in VS Code's storage for this workspace. Use a development account.

---

## Code standards linter

Optional warnings based on Odoo's coding guidelines. **Off by default** — turn on **Enable Code Standard Warnings** in the settings. Checks run on Python and XML files as you edit.

**Python**

- Model files in `models/` named after the model class; class names in CamelCase; `_name` in singular; transient model names containing `wizard`.
- `Many2one` field names ending in `_id`; `One2many` and `Many2many` field names ending in `_ids`.
- Method prefixes: `_compute_`, `_search_`, `_default_`, `_selection_`, `_onchange_`, `_check_`, `action_`.
- `action_` methods calling `self.ensure_one()`.
- Import order: standard library, then `odoo`, then `odoo.addons`.
- Translations: no `%` formatting or concatenation inside `_()`, no nested `_()`.
- Avoid `.clone()`, `cr.commit()`, `if len(x) > 0`, `for k in d.keys()` and `.get(k, None)`.

**XML**

- `id` before `model` on `<record>`; `name` first on `<field>`.
- `noupdate` on `<odoo>` rather than on `<data>`.
- `<menuitem>` instead of `<record model="ir.ui.menu">`.
- ID and name conventions for views (`<model>_view_<type>`, `<model>.view.<type>`, `.inherit.` for inherited views), actions, menus, groups and rules.

**File names** in `views/`, `security/`, `report/`, `wizard/`, `data/` and `controllers/`.

---

## Performance

The extension is built to stay out of your way:

- It activates only in Odoo workspaces, and loads its commands the first time you use them. It ships as a small bundle, so activation takes tens of milliseconds.
- Indexing runs in a separate process at the lowest OS priority. It starts a few seconds after the window opens and stops when idle. The editor, the debugger and your Odoo server always come first.
- The index is saved between sessions; afterwards only changed files are read again. File changes are batched.
- Saving and loading the index is done in small steps, so the editor never waits on it for long.
- Indexing is silent — no status bar progress and no notifications.
- Completions work from the index, and per-keystroke work is kept small, so typing stays responsive in large files.

As a reference, indexing the complete Odoo 20 source (all of `addons/` and `odoo/addons/`) for the first time takes about half a minute in the background, and the editor stays responsive throughout.

Large workspaces can turn off parts of the index in the [settings](#settings).

---

## Settings

| Setting | Default | Description |
|---|---|---|
| `cybrosys-assista-odoo-helper.odooVersion` | `auto` | Odoo version: `auto`, `18`, `19` or `20`. |
| `cybrosys-assista-odoo-helper.odooSourcePath` | *(empty)* | Path of the Odoo source (the folder with `odoo/release.py`), used for version detection and for Odoo's CSS classes. |
| `cybrosys-assista-odoo-helper.enableCodeStandardWarnings` | `false` | Turns on the [code standards linter](#code-standards-linter). |
| `cybrosys-assista-odoo-helper.indexing.enableCoreIndexing` | `true` | Index Python models, fields and methods. Needed for most completions and navigation. |
| `cybrosys-assista-odoo-helper.indexing.enableRegistryIndexing` | `true` | Index JavaScript registries (widgets, client actions, public components). |
| `cybrosys-assista-odoo-helper.indexing.enableCSSIndexing` | `true` | Index CSS/SCSS classes for `class="…"` completion. |
| `cybrosys-assista-odoo-helper.indexing.enableAdvanceCSSIndexing` | `false` | Go to Definition for CSS classes. |

---

## Known limitations

- Go to Definition works from XML and Python files, not from JavaScript.
- Inside an `<xpath>` of an inherited view, field suggestions use the view record rather than the inherited view's model.
- `depends` suggestions appear on lines that contain the word `depends`.
- **Add File to Manifest** adds to the `data` list only, and needs that list to exist.
- After **Remove Index Data**, reload the window to rebuild the index.
- The two graphs load their drawing library from the internet.

---

## Contact and support

- **Email:** [assista@cybrosys.com](mailto:assista@cybrosys.com) — questions, feedback and support.
- **Contact form:** [assista.cybrosys.com/contact](https://assista.cybrosys.com/contact)
- **Bugs and feature requests:** [GitHub issues](https://github.com/CybrosysAssista/odoo-helper-vs-code/issues)

When reporting a problem, include your Odoo version, VS Code version and operating system.

See the [Changelog](CHANGELOG.md) for what changed in each release.

Licensed under the [Apache License 2.0](LICENSE).

<p align="center">
  Made by <b><a href="https://www.cybrosys.com/">Cybrosys Technologies</a></b>
</p>
