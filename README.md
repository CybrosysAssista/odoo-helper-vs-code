<p align="center">
  <img src="https://github.com/user-attachments/assets/0967474f-a460-4253-ad39-46036ac003ab" alt="Cybrosys Assista Logo" width="400"/>
</p>

##  Supercharge Your Odoo Development with **Cybrosys Assista** 

**Cybrosys Assista** is an AI-powered developer toolkit and a **comprehensive ecosystem designed to streamline everything from Odoo development assistance to Odoo deployment and monitoring**. By blending intelligence and automation within popular IDEs like VS Code and PyCharm—as well as through its exclusive standalone Assista IDE—it provides complete lifecycle support for Odoo projects. From intelligent code generation and smart navigation to automated module scaffolding, Assista is built to boost productivity and simplify even the most complex full-stack tasks.

### The Complete Odoo Ecosystem

*   **Precision Development**: Boost your productivity with the **[Assista IDE](https://assista.cybrosys.com)** or our powerful **plugins for PyCharm and VS Code**, featuring AI-driven completions, instant scaffolding, and OWL/POS development mastery.
*   **Efficient Deployment with Easy Instance**: Streamline your release cycle with **[Easy Instance](https://easyinstance.com)**—an advanced Odoo SaaS platform equipped with Odoo-focused features for seamless, high-performance deployment.
*   **Monitoring & Quality with Assista Performance**: Ensure excellence with **[Assista Performance](https://performance.cybrosys.com)**, dedicated to real-time monitoring, code quality audits, and deep performance insights for your Odoo projects.
*   **Unified 360° Navigation**: Seamlessly navigate your entire stack with intelligent "Go-To-Definition" and cross-reference logic bridging XML, Python, and JavaScript.

**Transform your Odoo development workflow—faster, smarter, and more reliable.**

---


# Cybrosys-Assista-Odoo-Helper

Odoo extension for Visual Studio Code

---

Cybrosys Assista Odoo Helper provides a collection of intelligent code shortcuts designed to accelerate Odoo development. Below is the categorized reference of all available keywords (shortcuts) with descriptions and examples.

---

## Version-aware snippets and completions (Odoo 18 and 19)

- The extension now selects version-specific data for many completions and snippets:
  - Field types, attributes, decorators, and XML metadata are already versioned.
  - Code snippet providers are versioned: fields, models, methods, utilities.
  
- Selection is automatic based on your configured/detected Odoo version (Settings → "Assista: Odoo Version").
- In addition to built-in VS Code snippets, the extension registers versioned snippet completion providers for XML and Python at runtime.
- **Intelligent Manifest Suggestions**: Smarter auto-completion for `__manifest__.py` files, including file paths and module dependencies.

---

## 🔧 Odoo Methods

Commonly used method templates to simplify the logic inside Odoo models.

- **Odoo Create Method**  
  Used to override `create()` method in Odoo models. Lets you modify values or add logic during record creation.  
  _Example:_
  ```python
  @api.model_create_multi
  def create(self, vals_list):
      # Pre-create logic (optional)
      records = super().create(vals_list)
      # Post-create logic (optional)
      return records
  ```

- **Odoo Write Method**  
  Customizes the `write()` method to apply logic during updates. Useful for auditing or validations.  
  _Example:_
  ```python
  def write(self, values):
      # Pre-write logic (optional)
      res = super().write(values)
      # Post-write logic (optional)
      return res
  ```

- **Odoo Unlink Method**  
  Overrides `unlink()` to define behavior when deleting records. Often used for soft deletes or preventing deletion.  
  _Example:_
  ```python
  def unlink(self):
      # Pre-unlink logic (optional)
      res = super().unlink()
      # Post-unlink logic (optional)
      return res
  ```

- **Odoo Onchange Method**  
  Adds dynamic behavior in forms. Automatically updates fields when dependent values change.  
  _Example:_
  ```python
  @api.onchange('field_name')
  def _onchange_field_name(self):
      if self.field_name:
          self.target_field = value
  ```

- **Odoo Compute Method**  
  Used to calculate field values dynamically using dependent fields. Triggers only when dependencies change.  
  _Example:_
  ```python
  field_name = fields.FieldType(string='Field Label', compute='_compute_field_name', store=True)

  @api.depends('dependency_field')
  def _compute_field_name(self):
      for rec in self:
          # Compute logic
          rec.field_name = value
  ```

- **Odoo Constraints Method**  
  Adds validations at the model level that are enforced during create/write operations.  
  _Example:_
  ```python
  @api.constrains('field_name')
  def _check_field_name(self):
      for rec in self:
          if not rec.field_name:
              raise ValidationError("field_name must be set")
  ```

- **Odoo Search Method**  
  Implements custom search behavior for the model. Useful for custom name search or complex search logic.  
  _Example:_
  ```python
  @api.model
  def _search_name(self, name, args=None, operator='ilike', limit=100, name_get_uid=None):
      args = args or []
      domain = []
      if name:
          domain = ['|', '|',
              ('name', operator, name),
              ('field_name', operator, name),
              ('field_name2', operator, name)]
      return self._search(domain + args, limit=limit, access_rights_uid=name_get_uid)
  ```

- **Odoo Default Get Method**  
  Sets default values for fields when creating new records.  
  _Example:_
  ```python
  @api.model
  def default_get(self, fields_list):
      res = super().default_get(fields_list)
      res.update({
          'field_name': default_value,
      })
      return res
  ```

- **Odoo Action Method**  
  Creates a method that returns an action dictionary for opening views or performing actions.  
  _Example:_
  ```python
  def action_action_name(self):
      self.ensure_one()
      return {
          'name': _('Action Title'),
          'type': 'ir.actions.act_window',
          'res_model': 'model.name',
          'view_mode': 'list,form',
          'domain': [('field', '=', self.field)],
          'context': {'default_field': self.field},
      }
  ```

- **Odoo SQL Constraints**  
  Adds database-level constraints to ensure data integrity.  
  _Example:_
  ```python
  _sql_constraints = [
      ('constraint_name', 'constraint_type', 'message')
  ]
  ```

---

## 🧩 Odoo Models

Templates for creating different types of Odoo models.

- **Odoo Abstract Model**  
  Creates a model that serves as a base for other models.  
  _Example:_
  ```python
  from odoo import api,fields,models

  class ModelName(models.AbstractModel):
      _name = 'model.name'
      _description = 'Model Description'

      name = fields.Char(string='Name', required=True)
      active = fields.Boolean(string='Active', default=True)
  ```

- **Odoo Transient Model**  
  Creates a temporary model for wizard-like functionality.  
  _Example:_
  ```python
  from odoo import api,fields,models

  class ModelName(models.TransientModel):
      _name = 'model.name'
      _description = 'Model Description'

      name = fields.Char(string='Name', required=True)
      active = fields.Boolean(string='Active', default=True)
  ```

- **Odoo New Model Class**  
  Creates a new Odoo model class with basic structure.

  _Example:_
  ```python
  from odoo import fields,models 

  class ModelName(models.Model):
      _name = 'model.name'
      _description = 'Model Description'

      name = fields.Char(string='Name', required=True)
  ```

- **Odoo Classical Inherited Model Class**  
  Creates an inherited Odoo model class to extend an existing model.

  _Example:_
  ```python
  from odoo import fields,models

  class ModelName(models.Model):
      _name = 'model.name'
      _inherit = 'model.to.inherit'
      _description = 'Model Description'

      new_field = fields.Char(string='New Field')
  ```

- **Odoo Delegated Inherited Model Class**  
  Creates a new delegated Odoo model class that inherits fields from another model.

  _Example:_
  ```python
  from odoo import fields, models

  class ModelName(models.Model):
      _name = 'model.name'
      _inherits = {'parent.model': 'parent_id'}
      _description = 'Model Description'

      parent_id = fields.Many2one('parent.model', required=True, ondelete="cascade")
  ```

- **Odoo Extended Inherited Model Class**  
  Extends an existing model with custom methods.

  _Example:_
  ```python
  from odoo import fields, models, api

  class ModelName(models.Model):
      _inherit = 'model.to.extend'

      @api.model
      def create(self, vals):
          # Custom logic before creation
          res = super().create(vals)
          # Custom logic after creation
          return res
  ```

---

## 📋 Odoo Views

Templates for creating and inheriting Odoo views.

### Basic Views

- **Odoo Form View**  
  Creates a basic form view with essential elements.  
  _Example:_
  ```xml
  <record id="model_name_view_form" model="ir.ui.view">
      <field name="name">model.name.view.form</field>
      <field name="model">model.name</field>
      <field name="arch" type="xml">
          <form string="Form Title">
              <sheet>
                  <group>
                      <field name="name"/>
                      <!-- Add your fields here -->
                  </group>
              </sheet>
          </form>
      </field>
  </record>
  ```
- **Odoo List View**  
  Creates a basic list view for displaying records.  
  _Example:_
  ```xml
  <record id="model_name_view_list" model="ir.ui.view">
      <field name="name">model.name.view.list</field>
      <field name="model">model.name</field>
      <field name="arch" type="xml">
          <list string="List Title">
              <field name="name"/>
              <!-- Add your fields here -->
          </list>
      </field>
  </record>
  ```

- **Odoo Search View**  
  Creates a search view with filters and grouping options.  
  _Example:_
  ```xml
  <record id="model_name_view_search" model="ir.ui.view">
      <field name="name">model.name.view.search</field>
      <field name="model">model.name</field>
      <field name="arch" type="xml">
          <search string="Search Title">
              <field name="name"/>
              <!-- Add your fields here -->
              <filter string="Filter Name" name="filter_name" domain="[('field', '=', value)]"/>
              <group expand="0" string="Group By">
                  <filter string="Group By Name" name="group_by_name" context="{'group_by': 'field'}"/>
              </group>
          </search>
      </field>
  </record>
  ```

- **Odoo Calendar View**  
  Creates a calendar view for date-based records.  
  _Example:_
  ```xml
  <record id="model_name_view_calendar" model="ir.ui.view">
      <field name="name">model.name.view.calendar</field>
      <field name="model">model.name</field>
      <field name="arch" type="xml">
          <calendar string="Calendar Title" date_start="start_date_field" date_stop="end_date_field" mode="month">
              <field name="name"/>
              <!-- Add your fields here -->
          </calendar>
      </field>
  </record>
  ```

- **Odoo Kanban View**  
  Creates a kanban view for card-based display.  
  _Example:_
  ```xml
  <record id="model_name_view_kanban" model="ir.ui.view">
      <field name="name">model.name.view.kanban</field>
      <field name="model">model.name</field>
      <field name="arch" type="xml">
          <kanban string="Kanban Title" class="o_kanban_small_column">
              <field name="name"/>
              <!-- Add your fields here -->
              <templates>
                  <t t-name="kanban-box">
                      <div class="oe_kanban_global_click">
                          <div class="oe_kanban_details">
                              <strong class="o_kanban_record_title">
                                  <field name="name"/>
                              </strong>
                          </div>
                      </div>
                  </t>
              </templates>
          </kanban>
      </field>
  </record>
  ```

### View Inheritance

- **Odoo View Inherit**  
  Creates a view that inherits and modifies an existing view.  
  _Example:_
  ```xml
  <record id="model_name_view_view_type_inherit" model="ir.ui.view">
      <field name="name">model.name.inherit.view_type</field>
      <field name="model">model.name</field>
      <field name="inherit_id" ref="module.view_id"/>
      <field name="arch" type="xml">
          <!-- Add your xpath modifications here -->
      </field>
  </record>
  ```

## 🎯 Common View Elements

- **Odoo Header**  
  Adds a header with buttons and status bar.  
  _Example:_
  ```xml
  <header>
      <button name="action_confirm" string="Confirm" type="object" states="draft" class="btn-primary"/>
      <button name="action_cancel" string="Cancel" type="object" states="confirmed"/>
      <field name="state" widget="statusbar" statusbar_visible="draft,confirmed,done"/>
  </header>
  ```

- **Odoo Sheet**  
  Adds a sheet with group and fields.  
  _Example:_
  ```xml
  <sheet>
      <group>
          <field name="field_name"/>
          <!-- Add more fields here -->
      </group>
  </sheet>
  ```

- **Odoo Notebook**  
  Adds a notebook with pages.  
  _Example:_
  ```xml
  <notebook>
      <page string="Page Title" name="page_name">
          <!-- Add your page content here -->
      </page>
  </notebook>
  ```

- **Odoo Chatter**  
  Adds chatter functionality to a form view.  
  _Example:_
  ```xml
  <chatter/>
  ```

---

## 🎨 UI Elements

- **Odoo Smart Button**  
  Adds a smart button with statistics.  
  _Example:_
  ```xml
  <button name="action_view_records" type="object" class="oe_stat_button" icon="fa-list">
      <field name="record_count" widget="statinfo" string="Records"/>
  </button>
  ```

- **Odoo Button Box**  
  Adds a container for smart buttons.  
  _Example:_
  ```xml
  <div class="oe_button_box" name="button_box">
      <!-- Add smart buttons here -->
  </div>
  ```

- **Odoo Action Button**  
  Adds a button that triggers an action.  
  _Example:_
  ```xml
  <button name="%(action_name)d" string="Button Text" type="action" class="btn-primary"/>
  ```

- **Odoo Object Button**  
  Adds a button that calls a method.  
  _Example:_
  ```xml
  <button name="method_name" string="Button Text" type="object" class="btn-primary"/>
  ```

---

## 🍱 Menu Structure

- **Odoo Menu Root**  
  Creates a root menu item with icon.  
  _Example:_
  ```xml
  <menuitem id="menu_root_name"
      name="Root Menu Name"
      web_icon="module_name,static/description/icon.png"
      sequence="10"/>
  ```

- **Odoo Menu Category**  
  Creates a category menu item.  
  _Example:_
  ```xml
  <menuitem id="menu_category_name"
      name="Category Name"
      sequence="10"/>
  ```

- **Odoo Menu Action**  
  Creates a menu item that opens an action.  
  _Example:_
  ```xml
  <menuitem id="menu_menu_name"
      name="Menu Name"
      action="action_name"
      parent="parent_menu"
      sequence="10"/>
  ```

---

# 🧩 Odoo Fields

Comprehensive shortcuts to quickly define various field types in your Odoo models with proper syntax and examples.

- **Odoo Boolean Field**  
  Represents a true/false value with tracking support.

  _Example:_
  ```python
  fields.Boolean(string="Name", help="Help text", default=False, tracking=True)
  ```

- **Odoo Binary Field**  
  Used to store binary data like files with size limit.

  _Example:_
  ```python
  fields.Binary(string="Name", help="Help text", attachment=True, max_size=10)
  ```

- **Odoo Char Field**  
  A basic string field for short text with translation support.

  _Example:_
  ```python
  fields.Char(string="Name", help="Help text", required=False, tracking=True, translate=True)
  ```

- **Odoo Integer Field**  
  For integer numbers with tracking.

  _Example:_
  ```python
  fields.Integer(string="Name", help="Help text", default=0, tracking=True)
  ```

- **Odoo Image Field**  
  For storing and managing images with size limits.

  _Example:_
  ```python
  fields.Image(string="Name", help="Help text", max_width=1024, max_height=1024)
  ```

- **Odoo Float Field**  
  For decimal numbers with precision.

  _Example:_
  ```python
  fields.Float(string="Name", help="Help text", digits=(16, 2), tracking=True)
  ```

- **Odoo Text Field**  
  Used for longer text strings with translation.

  _Example:_
  ```python
  fields.Text(string="Name", help="Help text", translate=True)
  ```

- **Odoo Html Field**  
  Used to store HTML content with sanitization.

  _Example:_
  ```python
  fields.Html(string="Name", help="Help text", sanitize=True, translate=True)
  ```

- **Odoo Date Field**  
  Used for selecting a date with tracking.

  _Example:_
  ```python
  fields.Date(string="Name", help="Help text", tracking=True)
  ```

- **Odoo Datetime Field**  
  Used for selecting a date and time with tracking.

  _Example:_
  ```python
  fields.Datetime(string="Name", help="Help text", tracking=True)
  ```

- **Odoo Selection Field**  
  Allows selection from a predefined list with tracking.

  _Example:_
  ```python
  fields.Selection([
      ('draft', 'Draft'),
      ('confirmed', 'Confirmed'),
      ('done', 'Done')
  ],
  string="Status",
  default='draft',
  tracking=True,
  help="Help text")
  ```

- **Odoo Many2one Field**  
  Links to a single record of another model with company check.

  _Example:_
  ```python
  fields.Many2one('model.name', string="Name", help="Help text", tracking=True, ondelete='cascade', check_company=True)
  ```

- **Odoo Many2many Field**  
  Represents a many-to-many relationship with company check.

  _Example:_
  ```python
  fields.Many2many('model.name', string="Name", help="Help text", tracking=True, check_company=True)
  ```

- **Odoo Monetary Field**  
  Used for monetary values with currency tracking.

  _Example:_
  ```python
  fields.Monetary(string="Name", help="Help text", currency_field="currency_id", tracking=True)
  ```

- **Odoo One2many Field**  
  Represents a one-to-many relationship with tracking.

  _Example:_
  ```python
  fields.One2many('model.name', 'connection_field', string="Name", help="Help text", tracking=True)
  ```

- **Odoo Reference Field**  
  Dynamic reference to any model.

  _Example:_
  ```python
  fields.Reference(string="Name", selection=[('model1', 'Model 1'), ('model2', 'Model 2')], help="Help text")
  ```

- **Odoo Json Field**  
  Store JSON data in the database.

  _Example:_
  ```python
  fields.Json(string="Name", help="Help text")
  ```

## 🔧 Common Field Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `string` | Field label displayed in UI | `string="Product Name"` |
| `help` | Tooltip text for the field | `help="Enter product description"` |
| `required` | Makes field mandatory | `required=True` |
| `readonly` | Makes field read-only | `readonly=True` |
| `default` | Default value for the field | `default=0` or `default=lambda self: self._get_default()` |
| `tracking` | Enables field change tracking | `tracking=True` |
| `translate` | Enables field translation | `translate=True` |
| `ondelete` | Action when related record is deleted | `ondelete='cascade'` |
| `check_company` | Ensures record belongs to same company | `check_company=True` |
| `domain` | Filters available records | `domain=[('active', '=', True)]` |
| `context` | Passes context to related views | `context={'default_type': 'sale'}` |

## 💡 Best Practices

1. **Always use descriptive string labels** for better UX
2. **Add help text** to explain field purpose
3. **Use tracking=True** for important fields that need audit trail
4. **Set appropriate defaults** to improve data quality
5. **Use ondelete='cascade'** carefully to avoid data loss
6. **Add check_company=True** for multi-company environments
7. **Use translate=True** for user-facing text fields in multi-language setups
8. **Set proper digits** for Float fields to control precision
...

> 💡 *Tip: Just type the keyword and press `Tab` to auto-expand the snippet inside Assista IDE!*

---

## 🧠 Intelligent Manifest Suggestions

Assista provides advanced context-aware completions specifically for Odoo's `__manifest__.py` file to prevent typos and speed up configuration.

### 1. Manifest Path Suggestion
When adding files to your manifest, the extension provides real-time path suggestions by scanning your module's directory structure.
- **Trigger**: Inside strings within `data`, `demo`, or `assets` keys.
- **Features**:
  - Automatically lists available folders and XML/CSV/JS/CSS files.
  - Supports deep path navigation (suggests subfolders as you type).
  - Filters out hidden files (starting with `.`).

### 2. Module Dependency Suggestion
Easily find and add Odoo modules to your `depends` list.
- **Trigger**: Inside the `depends` list when starting a new string.
- **Features**:
  - Scans your entire workspace for available Odoo modules.
  - Provides a searchable list of module technical names.
  - Helps resolve dependency errors by suggesting only valid module names found in your project.

---

## � Python Inheritance Intelligence

Assista makes Odoo model inheritance seamless by providing intelligent completions for model names and function overrides.

### 1. Model Inheritance Suggestion (`_inherit`)
When extending an Odoo model, Assista suggests available model names as soon as you start typing the `_inherit` attribute.
- **Trigger**: Inside quotes or lists assigned to `_inherit` (e.g., `_inherit = "..."` or `_inherit = ["..."]`).
- **Features**:
  - Lists all Odoo models indexed in your current workspace.
  - Supports both single inheritance (string) and multiple inheritance (list).
  - Helps avoid typos in core or custom model names.

### 2. Intelligent Function Override
Easily override methods from your inherited models with automatic snippet generation.
- **Trigger**: Type `def ` inside any class that has an `_inherit` attribute.
- **Features**:
  - Automatically identifies the inherited models.
  - Suggests all methods available in the parent models.
  - **Auto-Snippet**: When a method is selected, it automatically generates the method signature and the `super()` call with original parameters.
  
  _Example:_
  ```python
  class SaleOrder(models.Model):
      _inherit = 'sale.order'
      
      def action_confirm(self):
          res = super().action_confirm()
          # Your custom logic here
          return res
  ```

---

## 💎 XML Intelligence

Assista provides a highly sophisticated XML intelligence system tailored for Odoo views, actions, and templates.

### 1. Smart Model Suggestions
Find the right model directly within your XML configuration.
- **Record Model**: Suggests models in `<record model="...">`.
- **Relational Fields**: Offers model names inside `<field name="model">` for views and `<field name="res_model">` for actions.
- **Context Search**: Indexes all Odoo models in the workspace for instant lookup.

### 2. Context-Aware Field Suggestions
When adding fields to a view, Assista automatically detects the target model based on the parent record or view definition.
- **View Awareness**: If your field is inside a `<form>`, `<tree>`, or other view tag, it correctly identifies the model from the view's `<field name="model">`.
- **Automatic Filtering**: Suggests only valid fields belonging to the resolved model.
- **Support for Inheritance**: If you're inheriting a view, it priority-suggests fields while still allowing discovery of inherited fields.

### 3. Widget Intelligence
Never guess a widget name again. Assista collects widget registrations directly from the JavaScript registry.
- **Trigger**: Inside the `widget="..."` attribute of any field.
- **Source**: Dynamically aggregated from all `registry.category("fields").add()` calls in your JS files.
- **Metadata**: Shows which module the widget belongs to and its underlying JS component.

### 4. CSS Class Autocomplete
Fast and accurate CSS class suggestions for your Odoo components.
- **Trigger**: Inside the `class="..."` attribute.
- **Priority**: Suggestions are prioritized from the current module, followed by core Odoo modules (`web`, `base`, `mail`, `portal`), and then global workspace classes.

### 5. Template & Component Discovery
- **t-call Suggestion**: Suggests all available QWeb template IDs (e.g., `<t t-call="module.template_id"/>`).
- **OWL Component ID**:
    - Suggests public OWL component IDs in `<t t-component="..."/>` and `<owl-component name="..."/>`.
    - Suggests client action tags in `<field name="tag">...</field>` for `ir.actions.client` records.
- **Source**: Reliably collected from the Odoo action registry and public component registration.

---

## 🚀 Odoo Navigation (Go-To-Definition)

Assista provides powerful "Go-To-Definition" (F12) capabilities that bridge the gap between XML, Python, and JavaScript.

### 1. XML Navigation
Seamlessly jump from your views to the underlying logic or styling.
- **Button to Python**: Click on `<button name="method_name" type="object"/>` to jump directly to the Python method definition.
- **Field to Python**: Click on any `<field name="field_name"/>` to jump to its Python definition (context-aware).
- **Model to Python**: Click on `model="..."` or `res_model="..."` to reach the model's Python class.
- **Widget to JS**: Click on `widget="..."` to jump to the JavaScript registration of that widget.
- **CSS to Styling**: Click on any class inside `class="..."` to jump to its CSS/SCSS definition (requires Advanced CSS Indexing enabled).
- **Template & Record**:
    - **t-call**: Jump to the QWeb template definition.
    - **ref/inherit_id**: Jump to the target XML record.
    - **Menuitem Parent**: Jump from a submenu to its parent menu definition.

### 2. Python Navigation
Navigate your Odoo backend code with precision.
- **Model Inheritance**: Click on model names in `_inherit` to jump to the base or inherited model definitions.
- **Self & Env**:
    - **self.field_name**: Jump to the field definition.
    - **self.method_name()**: Jump to the method definition within the model.
    - **env['model.name']**: Jump directly to the referenced model's Python class.
- **Manifest Power-Nav**:
    - **depends**: Click a module name in the dependency list to open its `__manifest__.py`.
    - **data/demo/assets**: Click any file path to open the file, or click a folder path to reveal it in the VS Code Explorer.

### 3. Client Action Navigation
- Jump from `<field name="tag">...</field>` in `ir.actions.client` records directly to the associated JavaScript client action registration.

---

## 🐍 Python Backend Intelligence

Beyond inheritance, Assista optimizes core Python development for Odoo with context-aware triggers and snippets.

### 1. Relational Field & Method Suggestions
- **Target Model Helper**: When defining `Many2one`, `One2many`, or `Many2many` fields, the extension automatically suggests model names as soon as you open the brackets.
- **Trigger Suggestions**: When defining `_compute_`, `_inverse_`, or `_search_` methods, the extension suggests field names from the current model to complete the method name.

### 2. Smart Odoo Imports
Quickly add essential Odoo imports and common Python utilities with specialized snippets.
- **Trigger**: Type `import ` or `from ` to see Odoo-specific import suggestions.
- **Includes**:
  - `odoo common imports` (api, fields, models)
  - `odoo import exceptions` (UserError, ValidationError)
  - `odoo import http` (for controllers & requests)
  - `odoo import logging` (includes `_logger` initialization)

---

## ⚖️ Odoo Linter & Code Standards

Assista includes a built-in linter that enforces Odoo's official **Technical Guide** standards in real-time.

### 1. XML Standards
- **Attribute Order**: Flags records where `model` is placed before `id`.
- **Field Placement**: Ensures `name` is always the first attribute in `<field>` tags.
- **Tag Usage**: Recommends using `<menuitem>` instead of `<record model="ir.ui.menu">`.

### 2. Naming Conventions
- Registers warnings for incorrectly named View IDs, Action IDs, and Menu IDs.
- Validates that Python classes use `CamelCase` and model names are singular.
- Ensures relational fields follow the `_id` and `_ids` suffix standards.

### 3. Python Best Practices
- **Import Order**: Enforces the standard order: 1) Stdlib, 2) Odoo Core, 3) Addons.
- **Translation Safety**: Flags incorrect formatting inside or outside `_()` translation calls.
- **Code Optimization**: Suggests using `if collection:` instead of `len(collection) > 0`.
- **Action Validation**: Warns if an `action_` method is missing a `self.ensure_one()` call.

---

## 🛠️ Global Utility Commands

Available via the Command Palette (`Ctrl+Shift+P`) or Context Menu:

- **Assista: Add to Manifest**: Automatically adds the current file to the correct section of your `__manifest__.py` (Data, Demo, or Assets).
- **Assista: Add to __init__.py**: Right-click any Python file or folder and select **Add to __init__.py** to automatically generate the import statement in the parent `__init__.py`.
- **Assista: Set Odoo Version**: Manually switch between Odoo 18 and 19 logic if auto-detection is not desired.

---

## 🏗️ Model-Driven Scaffolding

Assista takes productivity to the next level by allowing you to generate entire views, security rules, and reports directly from your Python model definitions.

### 1. Advanced View Builder
Right-click inside any Odoo Model class and select **Create Views** to launch the advanced view generator.
- **Multi-View Generation**: Select and generate Form, List, Kanban, Search, Pivot, and Calendar views in one go.
- **Smart Field Selection**:
    - **Quick Create**: Automatically selects all fields and builds standard views.
    - **Advanced Builder**: Allows you to pick specific fields for each view type.
- **Relational Intelligence**: For `One2many` fields in form views, it prompts you to select sub-fields for the embedded list view.
- **Auto-Manifest**: Automatically adds the newly created XML file to your `__manifest__.py`.

### 2. Intelligent Report Generator
Generate complex QWeb reports (PDF or HTML) without writing a single line of XML manually.
- **Header Info**: Select specific fields to display as key information in the report's header.
- **Dynamic Tables**: Select a relational field (like `order_line`) and pick its sub-fields to generate a beautifully formatted line table.
- **Action & Template**: Automatically creates the `ir.actions.report` record and the associated localized QWeb template.

### 3. Rapid Access Rights (Security)
Instantly generate security entries for your models without leaving your Python code.
- **Automatic CSV**: Appends a new access rule to `ir.model.access.csv` with standard permissions (read, write, create, unlink).
- **Group Support**: Pre-configures the rule for the target group (defaults to `base.group_user`).
- **Smart Formatting**: Automatically handles technical model name transformations (e.g., `sale.order` → `model_sale_order`) and manifest registration.

## �🖱️ VSCode Context Menu Features

By default, VSCode shows standard right-click options when you click on any folder in the Explorer. Assista IDE extends this menu by adding two powerful Odoo-specific options:

- **Create Odoo File**
- **Create Odoo Module**
- **Create OWL Component**
- **POS Components**



---

### Create Odoo File

Clicking on **Create Odoo File** reveals three submenus:



#### 1. Odoo Model File
When selected, a search bar appears at the top of VSCode with the following file type options:
- `__init__.py` – Initializes the Python module
- `__manifest__.py` – Defines the module metadata
- `model.py` – Creates a new Python model file
- `controller.py` – Creates a new controller file for web routes



#### 2. Odoo View File
This opens a list of pre-defined view templates. You can choose from:
- Empty View
- Basic View
- Advanced View
- Inherit View
- Report View
- Security Group View
- Security Rule View
- Sequence View
- Settings View
- Cron Job View



#### 3. Odoo Security File
Prompts you to enter a model name and automatically generates a security file with proper access rights configuration.

---

### Create Odoo Module

The **Create Odoo Module** option lets you quickly scaffold a new module from several templates:



#### 1. Odoo Basic Module
Generates a basic Odoo module with minimal structure.

#### 2. Odoo Advanced Module
Generates an enhanced module with extra config, views, and features.

#### 3. Odoo OWL Basic Module
Creates a module with minimal OWL (Odoo Web Library) integration.

#### 4. Odoo OWL Advanced Module
Creates an OWL-powered module with component structure and JS support.

#### 5. Odoo Systray Module
Builds a module that adds custom functionality to the systray menu.

#### 6. Odoo Website Theme
Scaffolds a module for custom website themes and QWeb templates.

---

#### OWL Advanced Module Output

When you generate an **OWL Advanced Module**, Assista IDE scaffolds a fully functional OWL environment, complete with proper folder structure, JS components, assets, and templates.


---

### Create OWL Component

The **Create OWL Component** option helps you quickly add various OWL elements to your module. When you select a component type, you will be prompted to enter a component name (e.g., `MyWidget`). The extension then automatically:
1.  Creates the necessary directory structure.
2.  Generates the JS, XML, and CSS/SCSS files.
3.  **Automatically updates the `__manifest__.py`** to include the new files in the appropriate asset bundle.

#### 1. Common Component
Generates a standard OWL component along with its corresponding XML template and styling files.
- **Generated Path**: `static/src/components/my_widget/`
- **Files**: `my_widget.js`, `my_widget.xml`, `my_widget.css`
- **Asset Bundle**: `web.assets_backend`

#### 2. Field Widget Component
Scaffolds a specialized OWL component designed for use as a field widget in Odoo views.
- **Generated Path**: `static/src/views/fields/my_field/`
- **Files**: `my_field.js`, `my_field.xml`, `my_field.scss`
- **Asset Bundle**: `web.assets_backend`

#### 3. Public Component
Creates components tailored for Odoo's public-facing website and portal interfaces, featuring advanced glassmorphic design templates.
- **Generated Path**: `static/src/components/my_public_widget/`
- **Files**: `my_public_widget.js`, `my_public_widget.xml`, `my_public_widget.scss`
- **Asset Bundle**: `web.assets_backend` (automatically registered in `public_components`)

#### 4. Owl Service
Generates a template for creating custom Odoo JavaScript services, allowing for shared logic across components.
- **Generated Path**: `static/src/services/my_service/`
- **Files**: `my_service.js`
- **Asset Bundle**: `web.assets_backend`

---

### POS Components

The **POS Components** menu allows you to extend existing Point of Sale screens effortlessly. The extension handles directory creation, JS inheritance (using `patch`), and template extension (using `xpath`).

#### 1. Product Screen
Extends the main POS screen.
- **Path**: `static/src/app/screens/product_screen/`
- **Files**: `product_screen.js`, `product_screen.xml`, `product_screen.scss`
- **Asset Bundle**: `point_of_sale.assets`

#### 2. Partner List Screen
Extends the customer management screen.
- **Path**: `static/src/app/screens/partner_list_screen/`
- **Files**: `partner_list_screen.js`, `partner_list_screen.xml`, `partner_list_screen.scss`

#### 3. Payment Screen
Customizes the interface for processing payments.
- **Path**: `static/src/app/screens/payment_screen/`
- **Files**: `payment_screen.js`, `payment_screen.xml`, `payment_screen.scss`

#### 4. Receipt Screen
Modifies the finalized order receipt screen.
- **Path**: `static/src/app/screens/receipt_screen/`
- **Files**: `receipt_screen.js`, `receipt_screen.xml`, `receipt_screen.scss`

#### 5. Order Management Screen (Ticket Screen)
Extends the interface for managing and refunding orders.
- **Path**: `static/src/app/screens/ticket_screen/`
- **Files**: `ticket_screen.js`, `ticket_screen.xml`, `ticket_screen.scss`
- 

<br/><br/><br/>


<p align="center">
  Powered by <b><a href="https://www.cybrosys.com/">Cybrosys Technologies</a></b>
</p>
