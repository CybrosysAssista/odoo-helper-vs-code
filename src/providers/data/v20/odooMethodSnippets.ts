// Method snippets for Odoo 20 (signatures as in odoo/orm/models.py).
import { MethodSnippet } from '../v18/odooMethodSnippets';

const methodSuggestions: MethodSnippet[] = [
    {
        label: "Odoo Create Method",
        insertText: "@api.model_create_multi\ndef create(self, vals_list):\n    # Pre-create logic (vals_list is a list of dicts)\n    records = super().create(vals_list)\n    # Post-create logic\n    return records",
        detail: "Override create (batch).",
        documentation: "Overrides `create`, which receives a list of value dicts (`@api.model_create_multi`)."
    },
    {
        label: "Odoo Write Method",
        insertText: "def write(self, vals):\n    # Pre-write logic\n    res = super().write(vals)\n    # Post-write logic\n    return res",
        detail: "Override write.",
        documentation: "Overrides `write`."
    },
    {
        label: "Odoo Unlink Method",
        insertText: "def unlink(self):\n    # Pre-unlink logic\n    return super().unlink()",
        detail: "Override unlink.",
        documentation: "Overrides `unlink`. To forbid deleting some records, prefer an `@api.ondelete` method."
    },
    {
        label: "Odoo Ondelete Method",
        insertText: "@api.ondelete(at_uninstall=False)\ndef _unlink_except_${1:done}(self):\n    for record in self:\n        if ${2:record.state == 'done'}:\n            raise UserError(self.env._(\"${3:You cannot delete this record.}\"))",
        detail: "Block deletion under a condition.",
        documentation: "Runs before records are deleted; raise to block it. Needs `from odoo.exceptions import UserError`."
    },
    {
        label: "Odoo Onchange Method",
        insertText: "@api.onchange('${1:field_name}')\ndef _onchange_${1:field_name}(self):\n    if self.${1:field_name}:\n        self.${2:target_field} = ${3:value}",
        detail: "Form onchange.",
        documentation: "Updates fields in the form when a field changes. Only assign values on self here."
    },
    {
        label: "Odoo Compute Method",
        insertText: "${1:field_name} = fields.${2:Char}(string='${3:Field Label}', compute='_compute_${1:field_name}', store=True)\n\n@api.depends('${4:dependency_field}')\ndef _compute_${1:field_name}(self):\n    for record in self:\n        record.${1:field_name} = ${5:value}",
        detail: "Computed field with its method.",
        documentation: "A computed field and the method computing it. Every record must be assigned."
    },
    {
        label: "Odoo Constraints Method",
        insertText: "@api.constrains('${1:field_name}')\ndef _check_${1:field_name}(self):\n    for record in self:\n        if not record.${1:field_name}:\n            raise ValidationError(self.env._(\"${2:This field must be set.}\"))",
        detail: "Python constraint.",
        documentation: "Validates records on create/write. Needs `from odoo.exceptions import ValidationError`."
    },
    {
        label: "Odoo Search Name Method",
        insertText: "@api.model\ndef _search_display_name(self, operator, value):\n    # Also match records on ${1:code} when searching by name\n    domain = super()._search_display_name(operator, value)\n    if operator in Domain.NEGATIVE_OPERATORS:\n        return domain & Domain('${1:code}', operator, value)\n    return domain | Domain('${1:code}', operator, value)",
        detail: "Customise name search.",
        documentation: "Makes name search (e.g. in Many2one dropdowns) also match another field. Needs `from odoo.fields import Domain`. For a fixed set of fields, `_rec_names_search = [\"name\", \"code\"]` is enough."
    },
    {
        label: "Odoo Display Name Method",
        insertText: "@api.depends('${1:name}', '${2:code}')\ndef _compute_display_name(self):\n    for record in self:\n        record.display_name = f\"[{record.${2:code}}] {record.${1:name}}\" if record.${2:code} else record.${1:name}",
        detail: "Customise the record label.",
        documentation: "Overrides how records are labelled everywhere (replaces name_get)."
    },
    {
        label: "Odoo Default Get Method",
        insertText: "@api.model\ndef default_get(self, fields):\n    res = super().default_get(fields)\n    if '${1:field_name}' in fields:\n        res['${1:field_name}'] = ${2:default_value}\n    return res",
        detail: "Override default_get.",
        documentation: "Computes default values for new records."
    },
    {
        label: "Odoo Action Method",
        insertText: "def action_${1:open_records}(self):\n    self.ensure_one()\n    return {\n        'name': self.env._(\"${2:Records}\"),\n        'type': 'ir.actions.act_window',\n        'res_model': '${3:model.name}',\n        'view_mode': 'list,form',\n        'domain': [('${4:field}', '=', self.${4:field})],\n        'context': {'default_${4:field}': self.${4:field}},\n    }",
        detail: "Return a window action.",
        documentation: "Opens a list/form of another model, e.g. from a smart button."
    }
];
export default methodSuggestions;
