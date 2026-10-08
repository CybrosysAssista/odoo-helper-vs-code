// Field parameters accepted by Odoo 19 (`tracking` needs the model to inherit mail.thread).
const fieldAttributes: string[] = [
    "string", "help", "required", "readonly", "index", "store", "copy", "default",
    "groups", "company_dependent", "translate", "compute", "compute_sudo", "inverse", "search", "related",
    "precompute", "recursive", "prefetch", "aggregator", "group_expand", "change_default", "default_export_compatible", "exportable",
    "tracking", "size", "trim", "sanitize", "digits", "currency_field", "selection", "selection_add",
    "comodel_name", "inverse_name", "relation", "column1", "column2", "domain", "context", "ondelete",
    "delegate", "check_company", "bypass_search_access", "attachment", "max_width", "max_height", "verify_resolution", "model_field",
    "definition"
];
export default fieldAttributes;
