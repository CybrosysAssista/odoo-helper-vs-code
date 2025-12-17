module.exports = {
    getCronViewTemplate: (pureName, modelDotName, modelTitle) => `<?xml version="1.0" encoding="utf-8"?>
<odoo noupdate="1">
    <!-- Scheduled Action -->
    <record id="ir_cron_${pureName}" model="ir.cron">
        <field name="name">${modelTitle} Scheduler</field>
        <field name="model_id" ref="model_${pureName.replace('.', '_')}"/>
        <field name="state">code</field>
        <field name="code">
            model.method_to_run()
        </field>
        <field name="interval_number">1</field>
        <field name="interval_type">days</field>
        <field name="numbercall">-1</field>
        <field name="active" eval="True"/>
    </record>
</odoo>`
};
