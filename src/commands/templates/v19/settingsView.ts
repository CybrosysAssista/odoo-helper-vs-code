// Odoo 19+ settings: <app>/<block>/<setting> inside base.res_config_settings_view_form.
// `your_field_setting` is a placeholder for a res.config.settings field of the module.
export const getSettingsViewTemplate = (pureName: string, modelDotName: string, modelTitle: string): string => `<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <record id="res_config_settings_view_form_${pureName}" model="ir.ui.view">
        <field name="name">res.config.settings.view.form.inherit.${pureName}</field>
        <field name="model">res.config.settings</field>
        <field name="priority" eval="50"/>
        <field name="inherit_id" ref="base.res_config_settings_view_form"/>
        <field name="arch" type="xml">
            <xpath expr="//form" position="inside">
                <app data-string="${modelTitle}" string="${modelTitle}" name="${pureName}">
                    <block title="${modelTitle}" id="${pureName}_settings">
                        <setting id="${pureName}_setting" help="Describe what this setting does">
                            <field name="your_field_setting"/>
                        </setting>
                    </block>
                </app>
            </xpath>
        </field>
    </record>

    <record id="action_${pureName}_settings" model="ir.actions.act_window">
        <field name="name">Settings</field>
        <field name="res_model">res.config.settings</field>
        <field name="view_mode">form</field>
        <field name="context">{'module': '${pureName}'}</field>
    </record>
</odoo>
`;
