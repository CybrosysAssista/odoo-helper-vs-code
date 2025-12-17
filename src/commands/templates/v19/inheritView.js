module.exports = {
    getInheritViewTemplate: (pureName, modelDotName) => `<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <data>
        <!-- Inherit Form View -->
        <record id="${pureName}_form_inherit" model="ir.ui.view">
            <field name="name">${modelDotName}.inherit.form</field>
            <field name="model">${modelDotName}</field>
            <field name="inherit_id" ref="module.original_form_view_id"/>
            <field name="arch" type="xml">
                <!-- Add fields to an existing group -->
                <xpath expr="//group[1]" position="inside">
                    <field name="new_field1"/>
                    <field name="new_field2"/>
                </xpath>
                
                <!-- Add a new page to the notebook -->
                <xpath expr="//notebook" position="inside">
                    <page string="New Page">
                        <group>
                            <field name="new_field3"/>
                            <field name="new_field4"/>
                        </group>
                    </page>
                </xpath>
                
                <!-- Modify an existing field -->
                <xpath expr="//field[@name='existing_field']" position="attributes">
                    <attribute name="readonly">1</attribute>
                    <attribute name="string">New Label</attribute>
                </xpath>
                
                <!-- Replace a field -->
                <xpath expr="//field[@name='to_replace']" position="replace">
                    <field name="replacement_field"/>
                </xpath>
                
                <!-- Add before a specific field -->
                <xpath expr="//field[@name='reference_field']" position="before">
                    <field name="before_field"/>
                </xpath>
                
                <!-- Add after a specific field -->
                <xpath expr="//field[@name='reference_field']" position="after">
                    <field name="after_field"/>
                </xpath>
            </field>
        </record>
        
        <!-- Inherit List View -->
        <record id="${pureName}_list_inherit" model="ir.ui.view">
            <field name="name">${modelDotName}.inherit.list</field>
            <field name="model">${modelDotName}</field>
            <field name="inherit_id" ref="module.original_list_view_id"/>
            <field name="arch" type="xml">
                <xpath expr="//field[@name='reference_field']" position="after">
                    <field name="new_field"/>
                </xpath>
            </field>
        </record>
    </data>
</odoo>`
};
