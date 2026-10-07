export const getCronViewTemplate = (pureName: string, modelDotName: string, modelTitle: string): string => `<?xml version="1.0" encoding="utf-8"?>
<odoo noupdate="1">
    <!-- Calls ${modelDotName}._cron_${pureName}() every day; define that method on the model. -->
    <record id="ir_cron_${pureName}" model="ir.cron">
        <field name="name">${modelTitle}: Scheduled Task</field>
        <field name="model_id" ref="model_${modelDotName.replace(/\./g, '_')}"/>
        <field name="state">code</field>
        <field name="code">model._cron_${pureName}()</field>
        <field name="user_id" ref="base.user_root"/>
        <field name="interval_number">1</field>
        <field name="interval_type">days</field>
        <field name="active" eval="True"/>
    </record>
</odoo>
`;
