export const getBasicViewTemplate = (pureName: string, modelDotName: string, modelTitle: string): string => `<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- Form View -->
    <record id="${pureName}_view_form" model="ir.ui.view">
        <field name="name">${modelDotName}.view.form</field>
        <field name="model">${modelDotName}</field>
        <field name="arch" type="xml">
            <form>
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
    <record id="${pureName}_view_list" model="ir.ui.view">
        <field name="name">${modelDotName}.view.list</field>
        <field name="model">${modelDotName}</field>
        <field name="arch" type="xml">
            <list>
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
                Create your first ${modelTitle.toLowerCase()}!
            </p>
        </field>
    </record>

    <!-- Menu -->
    <menuitem id="menu_${pureName}"
              name="${modelTitle}"
              action="action_${pureName}"
              sequence="10"/>
</odoo>
`;
