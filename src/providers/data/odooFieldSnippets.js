const vscode = require('vscode');

function createFieldItem(label, snippet, detail, documentation) {
    const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Snippet);
    item.insertText = new vscode.SnippetString(snippet);
    item.detail = detail;
    item.documentation = documentation;
    return item;
}
const fieldSnippets = [
    // Boolean and Binary
    createFieldItem(
        'Odoo Boolean Field',
        'fields.Boolean(string="${1:Name}", help="${2:Help text}", default=False, tracking=True)',
        'Boolean Field',
        'Represents a true/false value with tracking support.\n\n' +
        '**Example:**\n' +
        '```python\n' +
        'is_active = fields.Boolean(string="Is Active", help="Indicates if record is active", default=False, tracking=True)\n' +
        '```'
    ),
    createFieldItem(
        'Odoo Binary Field',
        'fields.Binary(string="${1:Name}", help="${2:Help text}", attachment=True, max_size=10)',
        'Binary Field',
        'Used to store binary data like files with size limit.\n\n' +
        '**Example:**\n' +
        '```python\n' +
        'file_data = fields.Binary(string="File", help="Upload a file", attachment=True, max_size=10)\n' +
        '```'
    ),
    // Char
    createFieldItem(
        'Odoo Char Field',
        'fields.Char(string="${1:Name}", help="${2:Help text}", required=False, tracking=True, translate=True)',
        'Char Field',
        'A basic string field for short text with translation support.\n\n' +
        '**Example:**\n' +
        '```python\n' +
        'name = fields.Char(string="Name", help="Enter the name", required=False, tracking=True, translate=True)\n' +
        '```'
    ),
    // Integer and Image
    createFieldItem(
        'Odoo Integer Field',
        'fields.Integer(string="${1:Name}", help="${2:Help text}", default=0, tracking=True)',
        'Integer Field',
        'For integer numbers with tracking.\n\n' +
        '**Example:**\n' +
        '```python\n' +
        'quantity = fields.Integer(string="Quantity", help="Enter quantity", default=0, tracking=True)\n' +
        '```'
    ),
    createFieldItem(
        'Odoo Image Field',
        'fields.Image(string="${1:Name}", help="${2:Help text}", max_width=1024, max_height=1024)',
        'Image Field',
        'For storing and managing images with size limits.\n\n' +
        '**Example:**\n' +
        '```python\n' +
        'image = fields.Image(string="Image", help="Upload an image", max_width=1024, max_height=1024)\n' +
        '```'
    ),
    // Float
    createFieldItem(
        'Odoo Float Field',
        'fields.Float(string="${1:Name}", help="${2:Help text}", digits=(16, 2), tracking=True)',
        'Float Field',
        'For decimal numbers with precision.\n\n' +
        '**Example:**\n' +
        '```python\n' +
        'price = fields.Float(string="Price", help="Enter price", digits=(16, 2), tracking=True)\n' +
        '```'
    ),
    // Text
    createFieldItem(
        'Odoo Text Field',
        'fields.Text(string="${1:Name}", help="${2:Help text}", translate=True)',
        'Text Field',
        'Used for longer text strings with translation.\n\n' +
        '**Example:**\n' +
        '```python\n' +
        'description = fields.Text(string="Description", help="Enter description", translate=True)\n' +
        '```'
    ),
    // Html
    createFieldItem(
        'Odoo Html Field',
        'fields.Html(string="${1:Name}", help="${2:Help text}", sanitize=True, translate=True)',
        'Html Field',
        'Used to store HTML content with sanitization.\n\n' +
        '**Example:**\n' +
        '```python\n' +
        'content = fields.Html(string="Content", help="Enter HTML content", sanitize=True, translate=True)\n' +
        '```'
    ),
    // Date and Datetime
    createFieldItem(
        'Odoo Date Field',
        'fields.Date(string="${1:Name}", help="${2:Help text}", tracking=True)',
        'Date Field',
        'Used for selecting a date with tracking.\n\n' +
        '**Example:**\n' +
        '```python\n' +
        'date = fields.Date(string="Date", help="Select a date", tracking=True)\n' +
        '```'
    ),
    createFieldItem(
        'Odoo Datetime Field',
        'fields.Datetime(string="${1:Name}", help="${2:Help text}", tracking=True)',
        'Datetime Field',
        'Used for selecting a date and time with tracking.\n\n' +
        '**Example:**\n' +
        '```python\n' +
        'datetime = fields.Datetime(string="DateTime", help="Select date and time", tracking=True)\n' +
        '```'
    ),
    // Selection
    createFieldItem(
        'Odoo Selection Field',
        'fields.Selection([\n    (\'draft\', \'Draft\'),\n    (\'confirmed\', \'Confirmed\'),\n    (\'done\', \'Done\')\n],\nstring="${1:Status}",\ndefault=\'draft\',\ntracking=True,\nhelp="${2:Help text}")',
        'Selection Field',
        'Allows selection from a predefined list with tracking.\n\n' +
        '**Example:**\n' +
        '```python\n' +
        'status = fields.Selection([\n    (\'draft\', \'Draft\'),\n    (\'confirmed\', \'Confirmed\'),\n    (\'done\', \'Done\')\n],\nstring="Status",\ndefault=\'draft\',\ntracking=True,\nhelp="Select status")\n' +
        '```'
    ),
    // Many2one, Many2many, Monetary
    createFieldItem(
        'Odoo Many2one Field',
        "fields.Many2one('${1:model.name}', string=\"${2:Name}\", help=\"${3:Help text}\", tracking=True, ondelete='cascade', check_company=True)",
        'Many2one Field',
        'Links to a single record of another model with company check.\n\n' +
        '**Example:**\n' +
        '```python\n' +
        "partner_id = fields.Many2one('res.partner', string=\"Partner\", help=\"Select a partner\", tracking=True, ondelete='cascade', check_company=True)\n" +
        '```'
    ),
    createFieldItem(
        'Odoo Many2many Field',
        "fields.Many2many('${1:model.name}', string=\"${2:Name}\", help=\"${3:Help text}\", tracking=True, check_company=True)",
        'Many2many Field',
        'Represents a many-to-many relationship with company check.\n\n' +
        '**Example:**\n' +
        '```python\n' +
        "tag_ids = fields.Many2many('res.tag', string=\"Tags\", help=\"Select tags\", tracking=True, check_company=True)\n" +
        '```'
    ),
    createFieldItem(
        'Odoo Monetary Field',
        'fields.Monetary(string="${1:Name}", help="${2:Help text}", currency_field="currency_id", tracking=True)',
        'Monetary Field',
        'Used for monetary values with currency tracking.\n\n' +
        '**Example:**\n' +
        '```python\n' +
        'amount = fields.Monetary(string="Amount", help="Enter amount", currency_field="currency_id", tracking=True)\n' +
        '```'
    ),
    // One2many
    createFieldItem(
        'Odoo One2many Field',
        "fields.One2many('${1:model.name}', '${2:connection_field}', string=\"${3:Name}\", help=\"${4:Help text}\", tracking=True)",
        'One2many Field',
        'Represents a one-to-many relationship with tracking.\n\n' +
        '**Example:**\n' +
        '```python\n' +
        "line_ids = fields.One2many('sale.order.line', 'order_id', string=\"Order Lines\", help=\"List of order lines\", tracking=True)\n" +
        '```'
    ),
    // Reference
    createFieldItem(
        'Odoo Reference Field',
        "fields.Reference(string=\"${1:Name}\", selection=[('model1', 'Model 1'), ('model2', 'Model 2')], help=\"${2:Help text}\")",
        'Reference Field',
        'Dynamic reference to any model.\n\n' +
        '**Example:**\n' +
        '```python\n' +
        "ref = fields.Reference(string=\"Reference\", selection=[('res.partner', 'Partner'), ('product.product', 'Product')], help=\"Select a reference\")\n" +
        '```'
    ),
    // Json
    createFieldItem(
        'Odoo Json Field',
        'fields.Json(string="${1:Name}", help="${2:Help text}")',
        'Json Field',
        'Store JSON data in the database.\n\n' +
        '**Example:**\n' +
        '```python\n' +
        'data = fields.Json(string="Data", help="Enter JSON data")\n' +
        '```'
    )
];

module.exports = fieldSnippets;