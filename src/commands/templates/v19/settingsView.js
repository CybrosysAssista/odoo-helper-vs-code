module.exports = {
    getSettingsViewTemplate: (pureName, modelDotName, modelTitle) => `<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <data>
        <!-- Inherit Res Config Settings Form -->
        <record id="${pureName}_settings_view_form" model="ir.ui.view">
            <field name="name">${modelDotName}.settings.inherit.view</field>
            <field name="model">res.config.settings</field>
            <field name="inherit_id" ref="base.view_res_config_settings"/>
            <field name="arch" type="xml">
                <xpath expr="//div[@id='settings']" position="inside">
                    <div class="app_settings_block" data-string="${modelTitle} Settings">
                        <h2>${modelTitle} Settings</h2>
                        <group>
                            <field name="your_field_setting"/>
                            <!-- Add more fields if needed -->
                        </group>
                    </div>
                </xpath>
            </field>
        </record>
    </data>
</odoo>`
}; 
