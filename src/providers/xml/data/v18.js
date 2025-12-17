module.exports = {
    xmlTags: [
        'record','field','menuitem','template','xpath','data','odoo','form','tree','search','kanban','calendar','gantt','graph','pivot','action','report','template','view','wizard','t'
    ],
    attributes: {
        'record': ['id', 'model', 'name'],
        'field': ['name', 'type', 'string', 'required', 'readonly', 'invisible', 'domain', 'context', 'on_change', 'widget', 'options', 'groups', 'help'],
        'menuitem': ['id', 'name', 'parent', 'sequence', 'action', 'web_icon', 'groups'],
        'template': ['id', 'name', 'inherit_id', 'primary', 'priority'],
        'xpath': ['expr', 'position', 'version'],
        'view': ['id', 'name', 'model', 'inherit_id', 'mode', 'create', 'edit', 'delete', 'duplicate', 'multi_edit'],
        'form': ['string', 'create', 'edit', 'delete', 'duplicate', 'multi_edit'],
        'tree': ['string', 'create', 'edit', 'delete', 'duplicate', 'multi_edit', 'decoration-info', 'decoration-success', 'decoration-warning', 'decoration-danger'],
        'search': ['string'],
        'kanban': ['string', 'create', 'edit', 'delete', 'duplicate', 'multi_edit', 'class', 'default_group_by', 'default_order', 'quick_create', 'quick_edit'],
        'calendar': ['string', 'create', 'edit', 'delete', 'duplicate', 'multi_edit', 'date_start', 'date_stop', 'date_delay', 'color', 'form_view_id', 'quick_add', 'all_day', 'mode'],
        'gantt': ['string', 'create', 'edit', 'delete', 'duplicate', 'multi_edit', 'date_start', 'date_stop', 'date_delay', 'color', 'form_view_id', 'quick_add', 'all_day', 'mode'],
        'graph': ['string', 'type', 'stacked'],
        'pivot': ['string', 'display_quantity', 'group_by'],
        'action': ['id', 'name', 'res_model', 'view_mode', 'view_id', 'view_type', 'target', 'context', 'domain', 'limit', 'help', 'binding_model_id', 'binding_type', 'binding_view_types'],
        'report': ['id', 'name', 'model', 'report_type', 'report_name', 'report_file', 'print_report_name', 'attachment', 'attachment_use', 'paperformat_id', 'header', 'groups', 'multi', 'bind_report_type'],
        't': ['t-call', 't-foreach', 't-as', 't-set', 't-value', 't-name', 't-lang']
    }
};


