# Cybrosys-Assista-Odoo-Helper
Odoo extension for Visual Studio Code

Cybrosys Assista Odoo Helper provides a collection of intelligent code shortcuts designed to accelerate Odoo development. Below is the categorized reference of all available keywords (shortcuts) with descriptions and examples.

---

## Version-aware snippets and completions (Odoo 18 vs 19)

- The extension now selects version-specific data for many completions and snippets:
  - Field types, attributes, decorators, and XML metadata are already versioned.
  - Code snippet providers are versioned: fields, models, methods, utilities.
  - User snippets are duplicated per version: `snippets/xml18.json`, `snippets/xml19.json`, `snippets/python18.json`, `snippets/python19.json`.
- Selection is automatic based on your configured/detected Odoo version (Settings → "Assista: Odoo Version").
- In addition to built-in VS Code snippets, the extension registers versioned snippet completion providers for XML and Python at runtime.

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

## 🖱️ VSCode Context Menu Features

By default, VSCode shows standard right-click options when you click on any folder in the Explorer. Assista IDE extends this menu by adding two powerful Odoo-specific options:

- **Create Odoo File**
- **Create Odoo Module**

![Screenshot from 2025-06-09 20-53-30](https://github.com/user-attachments/assets/097226b5-c422-4080-8590-3c65c14748d5)


*Main context menu showing added Odoo development options*

---

### Create Odoo File

Clicking on **Create Odoo File** reveals three submenus:

![Screenshot from 2025-06-10 10-55-27](https://github.com/user-attachments/assets/6a0ed5cd-03f3-459f-bc82-3ca381adcfbb)

*Create Odoo File submenu options*

#### 1. Odoo Model File
When selected, a search bar appears at the top of VSCode with the following file type options:
- `__init__.py` – Initializes the Python module
- `__manifest__.py` – Defines the module metadata
- `model.py` – Creates a new Python model file
- `controller.py` – Creates a new controller file for web routes

![Screenshot from 2025-06-10 10-57-02](https://github.com/user-attachments/assets/672a9d78-c096-43ef-88c1-8b7ec7e5eecc)

*Model file creation options in the search bar*

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

![Screenshot from 2025-06-10 10-57-14](https://github.com/user-attachments/assets/e7eeb5b6-a109-44ad-96d3-88fdcc5e426b)

*View file type selection menu*

#### 3. Odoo Security File
Prompts you to enter a model name and automatically generates a security file with proper access rights configuration.

---

### Create Odoo Module

The **Create Odoo Module** option lets you quickly scaffold a new module from several templates:

![Screenshot from 2025-06-10 10-56-42](https://github.com/user-attachments/assets/e1e23792-d55d-4373-ba20-379a6d1c938f)

*Create Odoo Module submenu options*

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

## 📸 OWL Advanced Module Output

When you generate an **OWL Advanced Module**, Assista IDE scaffolds a fully functional OWL environment, complete with proper folder structure, JS components, assets, and templates.

![Screenshot from 2025-06-10 10-51-54](https://github.com/user-attachments/assets/cf270149-0564-4124-abc2-985627561830)
