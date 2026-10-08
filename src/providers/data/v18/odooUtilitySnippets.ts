// Utility snippets for Odoo 18 (same API as 19 and 20).
export interface UtilitySnippet {
    label: string;
    insertText: string;
    detail: string;
    documentation: string;
}

const utilitySnippets: UtilitySnippet[] = [
    {
        label: "Odoo Validation Error",
        insertText: "raise ValidationError(self.env._(\"${1:Validation error message}\"))",
        detail: "Raise a validation error",
        documentation: "Needs `from odoo.exceptions import ValidationError`."
    },
    {
        label: "Odoo User Error",
        insertText: "raise UserError(self.env._(\"${1:User error message}\"))",
        detail: "Raise a user error",
        documentation: "Needs `from odoo.exceptions import UserError`."
    },
    {
        label: "Odoo Access Error",
        insertText: "raise AccessError(self.env._(\"${1:Access error message}\"))",
        detail: "Raise an access error",
        documentation: "Needs `from odoo.exceptions import AccessError`."
    },
    {
        label: "Odoo Missing Error",
        insertText: "raise MissingError(self.env._(\"${1:Missing error message}\"))",
        detail: "Raise a missing-record error",
        documentation: "Needs `from odoo.exceptions import MissingError`."
    },
    {
        label: "Odoo Redirect Warning",
        insertText: "raise RedirectWarning(\n    self.env._(\"${1:Warning message}\"),\n    self.env.ref('${2:module.action_xml_id}').id,\n    self.env._(\"${3:Go to settings}\"),\n)",
        detail: "Raise a warning with a redirect button",
        documentation: "Needs `from odoo.exceptions import RedirectWarning`."
    },
    {
        label: "Odoo Notification",
        insertText: "return {\n    'type': 'ir.actions.client',\n    'tag': 'display_notification',\n    'params': {\n        'title': self.env._(\"${1:Title}\"),\n        'message': self.env._(\"${2:Message}\"),\n        'type': '${3|success,info,warning,danger|}',\n        'sticky': ${4:False},\n    },\n}",
        detail: "Show a notification",
        documentation: "Returned from a button method: shows a notification in the web client."
    },
    {
        label: "Odoo Rainbow Man",
        insertText: "return {\n    'effect': {\n        'fadeout': '${1|slow,medium,fast,no|}',\n        'message': self.env._(\"${2:Well done!}\"),\n        'type': 'rainbow_man',\n    },\n}",
        detail: "Show the rainbow man",
        documentation: "Returned from a button method: shows the rainbow man effect."
    },
    {
        label: "Odoo Return Action",
        insertText: "return {\n    'type': 'ir.actions.act_window',\n    'name': self.env._(\"${1:Action Name}\"),\n    'res_model': '${2:model.name}',\n    'view_mode': 'form',\n    'res_id': ${3:self.id},\n    'target': '${4|current,new|}',\n}",
        detail: "Return a window action",
        documentation: "Opens a record (in a dialog with target new)."
    },
    {
        label: "Odoo URL Action",
        insertText: "return {\n    'type': 'ir.actions.act_url',\n    'url': '${1:/web/content/}',\n    'target': '${2|new,self,download|}',\n}",
        detail: "Return a URL action",
        documentation: "Opens a URL."
    }
];
export default utilitySnippets;
