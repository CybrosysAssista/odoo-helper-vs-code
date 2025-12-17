module.exports = {
    getBasicViewTemplate: (pureName, modelDotName, modelTitle) => `<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <data>
        <!-- Form View -->
        <record id="${pureName}_form" model="ir.ui.view">
            <field name="name">${modelDotName}.form</field>
            <field name="model">${modelDotName}</field>
            <field name="arch" type="xml">
                <form string="${modelTitle}">
                    <sheet>
                        <group>
                            <field name="name"/>
                            <!-- Add your fields here -->
                        </group>
                    </sheet>
                </form>
            </field>
        </record>
        
        <!-- List View -->
        <record id="${pureName}_list" model="ir.ui.view">
            <field name="name">${modelDotName}.list</field>
            <field name="model">${modelDotName}</field>
            <field name="arch" type="xml">
                <list string="${modelTitle}">
                    <field name="name"/>
                    <!-- Add your fields here -->
                </list>
            </field>
        </record>
        
        <!-- Action -->
        <record id="action_${pureName}" model="ir.actions.act_window">
            <field name="name">${modelTitle}</field>
            <field name="res_model">${modelDotName}</field>
            <field name="view_mode">list,form</field>
            <field name="help" type="html">
                <p class="o_view_nocontent_smiling_face">
                    Create your first ${pureName.replace('_', ' ')}!
                </p>
            </field>
        </record>
        
        <!-- Menu -->
        <menuitem id="menu_${pureName}"
                  name="${modelTitle}"
                  action="action_${pureName}"
                  sequence="10"/>
    </data>
</odoo>`
}; 
