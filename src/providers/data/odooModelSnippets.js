const modelSnippets = [
    {
        label: 'Odoo New Model Class',
        sortText: 'odoo new model class',
        insertText: 'from odoo import fields,models \n' +
            '\n' +
            'class ${1:ModelName}(models.Model):\n' +
            '    _name = \'${2:model.name}\'\n' +
            '    _description = \'${3:Model Description}\'\n' +
            '\n' +
            '    name = fields.Char(string=\'${4:Name}\', required=True)\n' +
            '    ${0}',
        detail: 'Create a new Odoo model class',
        documentation: '### Odoo Model Class\n\n' +
            'Scaffold a new Odoo model class with a basic structure.\n\n' +
            '**Includes:**\n' +
            '- Import statement\n' +
            '- Model class with `_name` and `_description`\n' +
            '- Example field\n\n' +
            '**Example:**\n' +
            '```python\n' +
            'from odoo import fields,models\n' +
            '\n' +
            'class MyModel(models.Model):\n' +
            '    _name = \'my.model\'\n' +
            '    _description = \'My Model Description\'\n' +
            '\n' +
            '    name = fields.Char(string=\'Name\', required=True)\n' +
            '```'
    },
    {
        label: 'Odoo Classical Inherited Model Class',
        sortText: 'odoo Classical inherited model class',
        insertText: 'from odoo import fields,models\n' +
            '\n' +
            'class ${1:ModelName}(models.Model):\n' +
            '    _name = \'${2:model.name}\'\n' +
            '    _inherit = \'${3:model.to.inherit}\'\n' +
            '    _description = \'${4:Model Description}\'\n' +
            '\n' +
            '    ${5:new_field} = fields.Char(string=\'${6:New Field}\')\n' +
            '    ${0}',
        detail: 'Create an inherited Odoo model class',
        documentation: '### Inherited Odoo Model\n\n' +
            'Create an inherited Odoo model class to extend an existing model with custom fields or logic.\n\n' +
            '**Includes:**\n' +
            '- `from odoo import fields,models ` import line\n' +
            '- `_inherit` and `_description` setup\n' +
            '- Example of a custom field\n\n' +
            '**Example:**\n' +
            '```python\n' +
            'from odoo import fields,models\n' +
            '\n' +
            'class ResPartner(models.Model):\n' +
            '    _inherit = \'res.partner\'\n' +
            '    _description = \'Extended Partner Model\'\n\n' +
            '    new_field = fields.Char(string=\'New Field\')\n' +
            '```\n\n' +
            'Use this when you need to customize core Odoo models like `res.partner`, `sale.order`, etc.'
    },
    {
        label: 'Odoo Delegated Inherited Model Class',
        sortText: 'odoo delegated model class',
        insertText: 'from odoo import fields, models\n' +
            '\n' +
            'class ${1:ModelName}(models.Model):\n' +
            '    _name = \'${2:model.name}\'\n' +
            '    _inherits = {\'${3:parent.model}\': \'${4:parent_id}\'}\n' +
            '    _description = \'${5:Model Description}\'\n' +
            '\n' +
            '    ${4:parent_id} = fields.Many2one(\'${3:parent.model}\', required=True, ondelete="cascade")\n' +
            '    ${0}',
        detail: 'Create a new delegated Odoo model class',
        documentation: '### Delegation Inheritance\n\n' +
            'Delegation inheritance allows your model to include fields of another model via `Many2one`.\n\n' +
            '**Includes:**\n' +
            '- `_name`, `_inherits`, and `_description`\n' +
            '- Delegating field (`parent_id`)\n\n' +
            '**Example:**\n' +
            '```python\n' +
            'from odoo import fields, models\n' +
            '\n' +
            'class EstateAgent(models.Model):\n' +
            '    _name = \'estate.agent\'\n' +
            '    _inherits = {\'res.partner\': \'partner_id\'}\n' +
            '    _description = \'Estate Agent\'\n\n' +
            '    partner_id = fields.Many2one(\'res.partner\', required=True, ondelete="cascade")\n' +
            '```\n'
    },
    {
        label: 'Odoo Extended Inherited Model Class',
        sortText: 'odoo extended model class',
        insertText: 'from odoo import fields, models, api\n' +
            '\n' +
            'class ${1:ModelName}(models.Model):\n' +
            '    _inherit = \'${2:model.to.extend}\'\n' +
            '\n' +
            '    @api.model\n' +
            '    def create(self, vals):\n' +
            '        # Custom logic before creation\n' +
            '        res = super().create(vals)\n' +
            '        # Custom logic after creation\n' +
            '        return res\n\n' +
            '    ${0}',
        detail: 'Extend an existing model with custom methods',
        documentation: '### Extension Inheritance\n\n' +
            'Use this to override methods of an existing Odoo model.\n\n' +
            '**Includes:**\n' +
            '- `_inherit` pointing to an existing model\n' +
            '- Example `create` method override\n\n' +
            '**Example:**\n' +
            '```python\n' +
            'from odoo import models, api\n' +
            '\n' +
            'class SaleOrder(models.Model):\n' +
            '    _inherit = \'sale.order\'\n\n' +
            '    @api.model\n' +
            '    def create(self, vals):\n' +
            '        res = super().create(vals)\n' +
            '        # Add custom logic\n' +
            '        return res\n' +
            '```\n'
    }
];

module.exports = modelSnippets; 