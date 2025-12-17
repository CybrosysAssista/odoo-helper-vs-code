const fieldSnippets = [
    // Boolean and Binary
    {
        label: 'Odoo Boolean Field',
        insertText: 'fields.Boolean(string="${1:Name}", help="${2:Help text}", default=False, tracking=True)',
        detail: 'Boolean Field',
        documentation: 'Represents a true/false value with tracking support.\n\n' +
            '**Example:**\n' +
            '```python\n' +
            'is_active = fields.Boolean(string="Is Active", help="Indicates if record is active", default=False, tracking=True)\n' +
            '```'
    },
    {
        label: 'Odoo Binary Field',
        insertText: 'fields.Binary(string="${1:Name}", help="${2:Help text}", attachment=True, max_size=10)',
        detail: 'Binary Field',
        documentation: 'Used to store binary data like files with size limit.\n\n' +
            '**Example:**\n' +
            '```python\n' +
            'file_data = fields.Binary(string="File", help="Upload a file", attachment=True, max_size=10)\n' +
            '```'
    },
    // Char
    {
        label: 'Odoo Char Field',
        insertText: 'fields.Char(string="${1:Name}", help="${2:Help text}", required=False, tracking=True, translate=True)',
        detail: 'Char Field',
        documentation: 'A basic string field for short text with translation support.\n\n' +
            '**Example:**\n' +
            '```python\n' +
            'name = fields.Char(string="Name", help="Enter the name", required=False, tracking=True, translate=True)\n' +
            '```'
    },
    // Integer and Image
    {
        label: 'Odoo Integer Field',
        insertText: 'fields.Integer(string="${1:Name}", help="${2:Help text}", default=0, tracking=True)',
        detail: 'Integer Field',
        documentation: 'For integer numbers with tracking.\n\n' +
            '**Example:**\n' +
            '```python\n' +
            'quantity = fields.Integer(string="Quantity", help="Enter quantity", default=0, tracking=True)\n' +
            '```'
    },
    {
        label: 'Odoo Image Field',
        insertText: 'fields.Image(string="${1:Name}", help="${2:Help text}", max_width=1024, max_height=1024)',
        detail: 'Image Field',
        documentation: 'For storing and managing images with size limits.\n\n' +
            '**Example:**\n' +
            '```python\n' +
            'image = fields.Image(string="Image", help="Upload an image", max_width=1024, max_height=1024)\n' +
            '```'
    },
    // Float
    {
        label: 'Odoo Float Field',
        insertText: 'fields.Float(string="${1:Name}", help="${2:Help text}", digits=(16, 2), tracking=True)',
        detail: 'Float Field',
        documentation: 'For decimal numbers with precision.\n\n' +
            '**Example:**\n' +
            '```python\n' +
            'price = fields.Float(string="Price", help="Enter price", digits=(16, 2), tracking=True)\n' +
            '```'
    },
    // Text
    {
        label: 'Odoo Text Field',
        insertText: 'fields.Text(string="${1:Name}", help="${2:Help text}", translate=True)',
        detail: 'Text Field',
        documentation: 'Used for longer text strings with translation.\n\n' +
            '**Example:**\n' +
            '```python\n' +
            'description = fields.Text(string="Description", help="Enter description", translate=True)\n' +
            '```'
    },
    // Html
    {
        label: 'Odoo Html Field',
        insertText: 'fields.Html(string="${1:Name}", help="${2:Help text}", sanitize=True, translate=True)',
        detail: 'Html Field',
        documentation: 'Used to store HTML content with sanitization.\n\n' +
            '**Example:**\n' +
            '```python\n' +
            'content = fields.Html(string="Content", help="Enter HTML content", sanitize=True, translate=True)\n' +
            '```'
    },
    // Date and Datetime
    {
        label: 'Odoo Date Field',
        insertText: 'fields.Date(string="${1:Name}", help="${2:Help text}", tracking=True)',
        detail: 'Date Field',
        documentation: 'Used for selecting a date with tracking.\n\n' +
            '**Example:**\n' +
            '```python\n' +
            'date = fields.Date(string="Date", help="Select a date", tracking=True)\n' +
            '```'
    },
    {
        label: 'Odoo Datetime Field',
        insertText: 'fields.Datetime(string="${1:Name}", help="${2:Help text}", tracking=True)',
        detail: 'Datetime Field',
        documentation: 'Used for selecting a date and time with tracking.\n\n' +
            '**Example:**\n' +
            '```python\n' +
            'datetime = fields.Datetime(string="DateTime", help="Select date and time", tracking=True)\n' +
            '```'
    },
    // Selection
    {
        label: 'Odoo Selection Field',
        insertText: 'fields.Selection([\n    (\'draft\', \'Draft\'),\n    (\'confirmed\', \'Confirmed\'),\n    (\'done\', \'Done\')\n],\nstring="${1:Status}",\ndefault=\'draft\',\ntracking=True,\nhelp="${2:Help text}")',
        detail: 'Selection Field',
        documentation: 'Allows selection from a predefined list with tracking.\n\n' +
            '**Example:**\n' +
            '```python\n' +
            'status = fields.Selection([\n    (\'draft\', \'Draft\'),\n    (\'confirmed\', \'Confirmed\'),\n    (\'done\', \'Done\')\n],\nstring="Status",\ndefault=\'draft\',\ntracking=True,\nhelp="Select status")\n' +
            '```'
    },
    // Many2one, Many2many, Monetary
    {
        label: 'Odoo Many2one Field',
        insertText: "fields.Many2one('${1:model.name}', string=\"${2:Name}\", help=\"${3:Help text}\", tracking=True, ondelete='cascade', check_company=True)",
        detail: 'Many2one Field',
        documentation: 'Links to a single record of another model with company check.\n\n' +
            '**Example:**\n' +
            '```python\n' +
            "partner_id = fields.Many2one('res.partner', string=\"Partner\", help=\"Select a partner\", tracking=True, ondelete='cascade', check_company=True)\n" +
            '```'
    },
    {
        label: 'Odoo Many2many Field',
        insertText: "fields.Many2many('${1:model.name}', string=\"${2:Name}\", help=\"${3:Help text}\", tracking=True, check_company=True)",
        detail: 'Many2many Field',
        documentation: 'Represents a many-to-many relationship with company check.\n\n' +
            '**Example:**\n' +
            '```python\n' +
            "tag_ids = fields.Many2many('res.tag', string=\"Tags\", help=\"Select tags\", tracking=True, check_company=True)\n" +
            '```'
    },
    {
        label: 'Odoo Monetary Field',
        insertText: 'fields.Monetary(string="${1:Name}", help="${2:Help text}", currency_field="currency_id", tracking=True)',
        detail: 'Monetary Field',
        documentation: 'Used for monetary values with currency tracking.\n\n' +
            '**Example:**\n' +
            '```python\n' +
            'amount = fields.Monetary(string="Amount", help="Enter amount", currency_field="currency_id", tracking=True)\n' +
            '```'
    },
    // One2many
    {
        label: 'Odoo One2many Field',
        insertText: "fields.One2many('${1:model.name}', '${2:connection_field}', string=\"${3:Name}\", help=\"${4:Help text}\", tracking=True)",
        detail: 'One2many Field',
        documentation: 'Represents a one-to-many relationship with tracking.\n\n' +
            '**Example:**\n' +
            '```python\n' +
            "line_ids = fields.One2many('sale.order.line', 'order_id', string=\"Order Lines\", help=\"List of order lines\", tracking=True)\n" +
            '```'
    },
    // Reference
    {
        label: 'Odoo Reference Field',
        insertText: "fields.Reference(string=\"${1:Name}\", selection=[('model1', 'Model 1'), ('model2', 'Model 2')], help=\"${2:Help text}\")",
        detail: 'Reference Field',
        documentation: 'Dynamic reference to any model.\n\n' +
            '**Example:**\n' +
            '```python\n' +
            "ref = fields.Reference(string=\"Reference\", selection=[('res.partner', 'Partner'), ('product.product', 'Product')], help=\"Select a reference\")\n" +
            '```'
    },
    // Json
    {
        label: 'Odoo Json Field',
        insertText: 'fields.Json(string="${1:Name}", help="${2:Help text}")',
        detail: 'Json Field',
        documentation: 'Store JSON data in the database.\n\n' +
            '**Example:**\n' +
            '```python\n' +
            'data = fields.Json(string="Data", help="Enter JSON data")\n' +
            '```'
    }
];

module.exports = fieldSnippets;

