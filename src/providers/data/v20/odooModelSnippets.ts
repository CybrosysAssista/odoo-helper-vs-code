// Model class snippets for Odoo 20.
import { ModelSnippet } from '../v18/odooModelSnippets';

const modelSnippets: ModelSnippet[] = [
    {
        label: "Odoo New Model Class",
        sortText: "odoo new model class",
        insertText: "from odoo import api, fields, models\n\n\nclass ${1:ModelName}(models.Model):\n    _name = '${2:model.name}'\n    _description = '${3:Model Description}'\n    _order = '${4:name}'\n\n    name = fields.Char(string='Name', required=True)\n    active = fields.Boolean(default=True)\n\n    _name_uniq = models.Constraint('unique(name)', 'The name must be unique.')\n",
        detail: "New model",
        documentation: "A new model with a unique-name constraint (Odoo 20 `models.Constraint`)."
    },
    {
        label: "Odoo Classical Inherited Model Class",
        sortText: "odoo classical inherited model class",
        insertText: "from odoo import fields, models\n\n\nclass ${1:ModelName}(models.Model):\n    _name = '${2:model.name}'\n    _inherit = '${3:model.to.inherit}'\n    _description = '${4:Model Description}'\n\n    ${5:new_field} = fields.Char(string='${6:New Field}')\n",
        detail: "Classical inheritance",
        documentation: "A new model copying the fields and methods of another one (own table)."
    },
    {
        label: "Odoo Delegated Inherited Model Class",
        sortText: "odoo delegated inherited model class",
        insertText: "from odoo import fields, models\n\n\nclass ${1:ModelName}(models.Model):\n    _name = '${2:model.name}'\n    _inherits = {'${3:parent.model}': '${4:parent_id}'}\n    _description = '${5:Model Description}'\n\n    ${4:parent_id} = fields.Many2one('${3:parent.model}', required=True, ondelete='cascade')\n",
        detail: "Delegation inheritance",
        documentation: "A new model embedding a parent record; parent fields are readable on it."
    },
    {
        label: "Odoo Extended Inherited Model Class",
        sortText: "odoo extended inherited model class",
        insertText: "from odoo import api, fields, models\n\n\nclass ${1:ModelName}(models.Model):\n    _inherit = '${2:model.to.extend}'\n\n    ${3:new_field} = fields.Char(string='${4:New Field}')\n\n    @api.model_create_multi\n    def create(self, vals_list):\n        records = super().create(vals_list)\n        return records\n",
        detail: "Extension",
        documentation: "Adds fields and behaviour to an existing model (same table)."
    }
];
export default modelSnippets;
