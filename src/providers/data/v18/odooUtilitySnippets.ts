import * as vscode from 'vscode';

export interface UtilitySnippet {
    label: string;
    insertText: string;
    detail: string;
    documentation: string;
}

const odooUtilitySnippets: UtilitySnippet[] = [
    // === Error Handling ===
    {
        label: 'Odoo Validation Error',
        insertText: 'raise ValidationError("${1:Validation error message}")',
        detail: 'Raise ValidationError',
        documentation: 'Raises a `ValidationError` when data doesn’t meet certain conditions.\n\n' +
            '**Example:**\n```python\nif not self.name:\n    raise ValidationError("Name is required")\n```'
    },
    {
        label: 'Odoo Missing Error',
        insertText: 'raise MissingError("${1:Missing error message}")',
        detail: 'Raise MissingError',
        documentation: 'Raises a `MissingError` when a required record is missing.\n\n' +
            '**Example:**\n```python\nif not record:\n    raise MissingError("Record not found")\n```'
    },
    {
        label: 'Odoo Access Error',
        insertText: 'raise AccessError("${1:Access error message}")',
        detail: 'Raise AccessError',
        documentation: 'Raises an `AccessError` to deny unauthorized access.\n\n' +
            '**Example:**\n```python\nif not self.env.user.has_group("base.group_user"):\n    raise AccessError("Access Denied")\n```'
    },
    {
        label: 'Odoo User Error',
        insertText: 'raise UserError("${1:User error message}")',
        detail: 'Raise UserError',
        documentation: 'Raises a `UserError` to notify the user of an invalid action.\n\n' +
            '**Example:**\n```python\nif not self.amount:\n    raise UserError("Amount must be specified")\n```'
    },
    {
        label: 'Odoo Redirect Warning',
        insertText: 'raise RedirectWarning("${1:Warning message}", ${2:action_id}, "${3:Button Label}")',
        detail: 'Raise RedirectWarning',
        documentation: 'Warn the user and redirect to another action upon confirmation.\n\n' +
            '**Example:**\n```python\nraise RedirectWarning("You must configure the product!", action.id, "Configure")\n```'
    },

    // === Notifications & Actions ===
    {
        label: 'Odoo Info Notification',
        insertText: 'return self.env.user.notify_info("${1:Info message}", sticky=True)',
        detail: 'Create Info Notification',
        documentation: 'Creates a sticky info notification using `notify_info()`.\n\n' +
            '**Example:**\n```python\nself.env.user.notify_info("Process started", sticky=True)\n```'
    },
    {
        label: 'Odoo Success Notification',
        insertText: 'return self.env.user.notify_success("${1:Success message}", sticky=True)',
        detail: 'Create Success Notification',
        documentation: 'Creates a sticky success notification using `notify_success()`.\n\n' +
            '**Example:**\n```python\nself.env.user.notify_success("Operation successful", sticky=True)\n```'
    },
    {
        label: 'Odoo Warning Notification',
        insertText: 'return self.env.user.notify_warning("${1:Warning message}", sticky=True)',
        detail: 'Create Warning Notification',
        documentation: 'Creates a sticky warning notification using `notify_warning()`.\n\n' +
            '**Example:**\n```python\nself.env.user.notify_warning("Be careful!", sticky=True)\n```'
    },
    {
        label: 'Odoo Rainbow Man Notification',
        insertText: 'self.env.user.notify_success("${1:Rainbow message}", sticky=True, title="${2:Success!}", type="rainbow_man")',
        detail: 'Create Rainbow Man Notification',
        documentation: 'Displays a rainbow man animation notification.\n\n' +
            '**Example:**\n```python\nself.env.user.notify_success("You did it!", title="Well done!", type="rainbow_man")\n```'
    },
    {
        label: 'Odoo Return Action',
        insertText: 'return {\n    "type": "ir.actions.act_window",\n    "name": "${1:Action Name}",\n    "res_model": "${2:model.name}",\n    "view_mode": "${3:form}",\n    "res_id": ${4:record_id},\n    "target": "${5:self}"\n}',
        detail: 'Create Return Action',
        documentation: 'Returns an action dictionary to open a view.\n\n' +
            '**Example:**\n```python\nreturn {\n    "type": "ir.actions.act_window",\n    "name": "Order",\n    "res_model": "sale.order",\n    "view_mode": "form",\n    "res_id": self.id,\n    "target": "current"\n}\n```'
    }
];

export default odooUtilitySnippets;

