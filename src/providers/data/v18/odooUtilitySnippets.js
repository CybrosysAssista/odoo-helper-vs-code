const vscode = require('vscode');

function createSnippetItem(label, snippet, detail, documentation) {
    const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Snippet);
    item.insertText = new vscode.SnippetString(snippet);
    item.detail = detail;
    item.documentation = documentation;
    return item;
}

const odooUtilitySnippets = [
    // === Error Handling ===
    createSnippetItem(
        'Odoo Validation Error',
        'raise ValidationError("${1:Validation error message}")',
        'Raise ValidationError',
        'Raises a `ValidationError` when data doesn’t meet certain conditions.\n\n' +
        '**Example:**\n```python\nif not self.name:\n    raise ValidationError("Name is required")\n```'
    ),
    createSnippetItem(
        'Odoo Missing Error',
        'raise MissingError("${1:Missing error message}")',
        'Raise MissingError',
        'Raises a `MissingError` when a required record is missing.\n\n' +
        '**Example:**\n```python\nif not record:\n    raise MissingError("Record not found")\n```'
    ),
    createSnippetItem(
        'Odoo Access Error',
        'raise AccessError("${1:Access error message}")',
        'Raise AccessError',
        'Raises an `AccessError` to deny unauthorized access.\n\n' +
        '**Example:**\n```python\nif not self.env.user.has_group("base.group_user"):\n    raise AccessError("Access Denied")\n```'
    ),
    createSnippetItem(
        'Odoo User Error',
        'raise UserError("${1:User error message}")',
        'Raise UserError',
        'Raises a `UserError` to notify the user of an invalid action.\n\n' +
        '**Example:**\n```python\nif not self.amount:\n    raise UserError("Amount must be specified")\n```'
    ),
    createSnippetItem(
        'Odoo Redirect Warning',
        'raise RedirectWarning("${1:Warning message}", ${2:action_id}, "${3:Button Label}")',
        'Raise RedirectWarning',
        'Warn the user and redirect to another action upon confirmation.\n\n' +
        '**Example:**\n```python\nraise RedirectWarning("You must configure the product!", action.id, "Configure")\n```'
    ),

    // === Notifications & Actions ===
    createSnippetItem(
        'Odoo Info Notification',
        'return self.env.user.notify_info("${1:Info message}", sticky=True)',
        'Create Info Notification',
        'Creates a sticky info notification using `notify_info()`.\n\n' +
        '**Example:**\n```python\nself.env.user.notify_info("Process started", sticky=True)\n```'
    ),
    createSnippetItem(
        'Odoo Success Notification',
        'return self.env.user.notify_success("${1:Success message}", sticky=True)',
        'Create Success Notification',
        'Creates a sticky success notification using `notify_success()`.\n\n' +
        '**Example:**\n```python\nself.env.user.notify_success("Operation successful", sticky=True)\n```'
    ),
    createSnippetItem(
        'Odoo Warning Notification',
        'return self.env.user.notify_warning("${1:Warning message}", sticky=True)',
        'Create Warning Notification',
        'Creates a sticky warning notification using `notify_warning()`.\n\n' +
        '**Example:**\n```python\nself.env.user.notify_warning("Be careful!", sticky=True)\n```'
    ),
    createSnippetItem(
        'Odoo Rainbow Man Notification',
        'self.env.user.notify_success("${1:Rainbow message}", sticky=True, title="${2:Success!}", type="rainbow_man")',
        'Create Rainbow Man Notification',
        'Displays a rainbow man animation notification.\n\n' +
        '**Example:**\n```python\nself.env.user.notify_success("You did it!", title="Well done!", type="rainbow_man")\n```'
    ),
    createSnippetItem(
        'Odoo Return Action',
        'return {\n    "type": "ir.actions.act_window",\n    "name": "${1:Action Name}",\n    "res_model": "${2:model.name}",\n    "view_mode": "${3:form}",\n    "res_id": ${4:record_id},\n    "target": "${5:self}"\n}',
        'Create Return Action',
        'Returns an action dictionary to open a view.\n\n' +
        '**Example:**\n```python\nreturn {\n    "type": "ir.actions.act_window",\n    "name": "Order",\n    "res_model": "sale.order",\n    "view_mode": "form",\n    "res_id": self.id,\n    "target": "current"\n}\n```'
    )
];

module.exports = odooUtilitySnippets;




