// Field snippets for Odoo 20. Only parameters the Odoo 20 field classes accept are used.
import { FieldSnippet } from '../v18/odooFieldSnippets';

const fieldSnippets: FieldSnippet[] = [
    {
        label: "Odoo Boolean Field",
        insertText: "fields.Boolean(string=\"${1:Name}\", default=${2:False})",
        detail: "Boolean Field",
        documentation: "True/false value.\n\n**Example:**\n```python\nis_active = fields.Boolean(string=\"Active\", default=True)\n```"
    },
    {
        label: "Odoo Char Field",
        insertText: "fields.Char(string=\"${1:Name}\", required=${2:False}, translate=${3:False})",
        detail: "Char Field",
        documentation: "Short text, optionally translatable.\n\n**Example:**\n```python\nname = fields.Char(string=\"Name\", required=True)\n```"
    },
    {
        label: "Odoo Text Field",
        insertText: "fields.Text(string=\"${1:Name}\", translate=${2:False})",
        detail: "Text Field",
        documentation: "Long plain text.\n\n**Example:**\n```python\ndescription = fields.Text(string=\"Description\")\n```"
    },
    {
        label: "Odoo Html Field",
        insertText: "fields.Html(string=\"${1:Name}\", sanitize=True, translate=${2:False})",
        detail: "Html Field",
        documentation: "Rich text, sanitized by default.\n\n**Example:**\n```python\nnote = fields.Html(string=\"Note\")\n```"
    },
    {
        label: "Odoo Integer Field",
        insertText: "fields.Integer(string=\"${1:Name}\", default=${2:0})",
        detail: "Integer Field",
        documentation: "Whole number.\n\n**Example:**\n```python\nquantity = fields.Integer(string=\"Quantity\", default=1)\n```"
    },
    {
        label: "Odoo Float Field",
        insertText: "fields.Float(string=\"${1:Name}\", digits=(${2:16}, ${3:2}))",
        detail: "Float Field",
        documentation: "Decimal number with a precision of (total, decimals), or a decimal precision name such as \"Product Price\".\n\n**Example:**\n```python\nweight = fields.Float(string=\"Weight\", digits=(16, 3))\n```"
    },
    {
        label: "Odoo Monetary Field",
        insertText: "fields.Monetary(string=\"${1:Name}\", currency_field=\"${2:currency_id}\")",
        detail: "Monetary Field",
        documentation: "Amount in a currency. The model needs the currency field it names, e.g. `currency_id = fields.Many2one(\"res.currency\")`.\n\n**Example:**\n```python\namount = fields.Monetary(string=\"Amount\", currency_field=\"currency_id\")\n```"
    },
    {
        label: "Odoo Date Field",
        insertText: "fields.Date(string=\"${1:Name}\", default=fields.Date.context_today)",
        detail: "Date Field",
        documentation: "Date (no time).\n\n**Example:**\n```python\ndate = fields.Date(string=\"Date\", default=fields.Date.context_today)\n```"
    },
    {
        label: "Odoo Datetime Field",
        insertText: "fields.Datetime(string=\"${1:Name}\", default=fields.Datetime.now)",
        detail: "Datetime Field",
        documentation: "Date and time (stored in UTC).\n\n**Example:**\n```python\nstart = fields.Datetime(string=\"Start\", default=fields.Datetime.now)\n```"
    },
    {
        label: "Odoo Selection Field",
        insertText: "fields.Selection(\n    selection=[\n        ('${1:draft}', '${2:Draft}'),\n        ('${3:confirmed}', '${4:Confirmed}'),\n        ('${5:done}', '${6:Done}'),\n    ],\n    string=\"${7:Status}\",\n    default='${1:draft}',\n)",
        detail: "Selection Field",
        documentation: "Choice from a fixed list of (value, label) pairs.\n\n**Example:**\n```python\nstate = fields.Selection([('draft', 'Draft'), ('done', 'Done')], string='Status', default='draft')\n```"
    },
    {
        label: "Odoo Many2one Field",
        insertText: "fields.Many2one('${1:res.partner}', string=\"${2:Name}\", ondelete='${3|set null,restrict,cascade|}')",
        detail: "Many2one Field",
        documentation: "Link to one record of another model. ondelete is one of set null, restrict, cascade.\n\n**Example:**\n```python\npartner_id = fields.Many2one('res.partner', string='Customer', ondelete='restrict')\n```"
    },
    {
        label: "Odoo One2many Field",
        insertText: "fields.One2many('${1:model.name}', '${2:inverse_field_id}', string=\"${3:Lines}\")",
        detail: "One2many Field",
        documentation: "Records of another model pointing back to this one through their Many2one field (the inverse field).\n\n**Example:**\n```python\nline_ids = fields.One2many('sale.order.line', 'order_id', string='Lines')\n```"
    },
    {
        label: "Odoo Many2many Field",
        insertText: "fields.Many2many('${1:res.partner.category}', string=\"${2:Tags}\")",
        detail: "Many2many Field",
        documentation: "Links to any number of records of another model. relation/column1/column2 can name the table and its columns.\n\n**Example:**\n```python\ntag_ids = fields.Many2many('res.partner.category', string='Tags')\n```"
    },
    {
        label: "Odoo Binary Field",
        insertText: "fields.Binary(string=\"${1:File}\", attachment=True)",
        detail: "Binary Field",
        documentation: "File content, stored as an attachment.\n\n**Example:**\n```python\ndocument = fields.Binary(string=\"Document\", attachment=True)\n```"
    },
    {
        label: "Odoo Image Field",
        insertText: "fields.Image(string=\"${1:Image}\", max_width=${2:1024}, max_height=${3:1024})",
        detail: "Image Field",
        documentation: "Image, resized to fit max_width \u00d7 max_height.\n\n**Example:**\n```python\nimage_1920 = fields.Image(string=\"Image\", max_width=1920, max_height=1920)\n```"
    },
    {
        label: "Odoo Json Field",
        insertText: "fields.Json(string=\"${1:Data}\")",
        detail: "Json Field",
        documentation: "JSON value (dict, list, str, number...).\n\n**Example:**\n```python\npayload = fields.Json(string=\"Payload\")\n```"
    },
    {
        label: "Odoo Reference Field",
        insertText: "fields.Reference(\n    selection=[('${1:res.partner}', '${2:Partner}'), ('${3:res.users}', '${4:User}')],\n    string=\"${5:Document}\",\n)",
        detail: "Reference Field",
        documentation: "Link to a record of one of several models.\n\n**Example:**\n```python\ndocument = fields.Reference([('sale.order', 'Sales Order'), ('account.move', 'Invoice')], string='Document')\n```"
    },
    {
        label: "Odoo Many2oneReference Field",
        insertText: "fields.Many2oneReference(string=\"${1:Record ID}\", model_field='${2:res_model}')",
        detail: "Many2oneReference Field",
        documentation: "Record id whose model is given by a Char field of this model (model_field).\n\n**Example:**\n```python\nres_id = fields.Many2oneReference(string='Record ID', model_field='res_model')\n```"
    }
];
export default fieldSnippets;
