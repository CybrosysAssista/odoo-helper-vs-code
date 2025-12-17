module.exports = {
    getAdvancedViewTemplate: (pureName, modelDotName, modelTitle) => `<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <data>
        <!-- Form View -->
        <record id="${pureName}_form" model="ir.ui.view">
            <field name="name">${modelDotName}.form</field>
            <field name="model">${modelDotName}</field>
            <field name="arch" type="xml">
                <form string="${modelTitle}">
                    <header>
                        <button name="action_confirm" string="Confirm" type="object" class="oe_highlight"/>
                        <button name="action_cancel" string="Cancel" type="object"/>
                        <field name="state" widget="statusbar" statusbar_visible="draft,confirmed,done"/>
                    </header>
                    <sheet>
                        <div class="oe_title">
                            <h1>
                                <field name="name"/>
                            </h1>
                        </div>
                        <notebook>
                            <page string="General Information">
                                <group>
                                    <group>
                                        <field name="field1"/>
                                        <field name="field2"/>
                                    </group>
                                    <group>
                                        <field name="field3"/>
                                        <field name="field4"/>
                                    </group>
                                </group>
                            </page>
                            <page string="Lines">
                                <field name="line_ids">
                                    <list editable="bottom">
                                        <field name="name"/>
                                        <field name="description"/>
                                        <field name="quantity"/>
                                        <field name="price"/>
                                        <field name="subtotal" sum="Total"/>
                                    </list>
                                </field>
                            </page>
                            <page string="Notes">
                                <field name="notes"/>
                            </page>
                        </notebook>
                    </sheet>
                    <chatter/>
                </form>
            </field>
        </record>
        
        <!-- List View -->
        <record id="${pureName}_list" model="ir.ui.view">
            <field name="name">${modelDotName}.list</field>
            <field name="model">${modelDotName}</field>
            <field name="arch" type="xml">
                <list string="${modelTitle}" decoration-info="state=='draft'" decoration-success="state=='done'" decoration-warning="state=='confirmed'">
                    <field name="name"/>
                    <field name="field1"/>
                    <field name="field2"/>
                    <field name="create_date"/>
                    <field name="state"/>
                </list>
            </field>
        </record>
        
        <!-- Search View -->
        <record id="${pureName}_search" model="ir.ui.view">
            <field name="name">${modelDotName}.search</field>
            <field name="model">${modelDotName}</field>
            <field name="arch" type="xml">
                <search string="Search ${modelTitle}">
                    <field name="name"/>
                    <field name="field1"/>
                    <field name="field2"/>
                    <separator/>
                    <filter string="Draft" name="draft" domain="[('state','=','draft')]"/>
                    <filter string="Confirmed" name="confirmed" domain="[('state','=','confirmed')]"/>
                    <filter string="Done" name="done" domain="[('state','=','done')]"/>
                    <group expand="0" string="Group By">
                        <filter string="State" name="groupby_state" context="{'group_by': 'state'}"/>
                        <filter string="Creation Date" name="groupby_create_date" context="{'group_by': 'create_date:month'}"/>
                    </group>
                </search>
            </field>
        </record>
        
        <!-- Calendar View -->
        <record id="${pureName}_calendar" model="ir.ui.view">
            <field name="name">${modelDotName}.calendar</field>
            <field name="model">${modelDotName}</field>
            <field name="arch" type="xml">
                <calendar string="${modelTitle}" date_start="create_date" color="state">
                    <field name="name"/>
                    <field name="state"/>
                </calendar>
            </field>
        </record>
        
        <!-- Kanban View -->
        <record id="${pureName}_kanban" model="ir.ui.view">
            <field name="name">${modelDotName}.kanban</field>
            <field name="model">${modelDotName}</field>
            <field name="arch" type="xml">
                <kanban default_group_by="state" class="o_kanban_small_column" sample="1">
                    <field name="name"/>
                    <field name="state"/>
                    <field name="field1"/>
                    <field name="field2"/>
                    <templates>
                        <t t-name="kanban-box">
                            <div class="oe_kanban_global_click">
                                <div class="oe_kanban_details">
                                    <strong class="o_kanban_record_title">
                                        <field name="name"/>
                                    </strong>
                                    <div class="o_kanban_tags_section">
                                        <ul>
                                            <li><field name="field1"/></li>
                                            <li><field name="field2"/></li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </t>
                    </templates>
                </kanban>
            </field>
        </record>
        
        <!-- Actions -->
        <record id="action_${pureName}" model="ir.actions.act_window">
            <field name="name">${modelTitle}</field>
            <field name="res_model">${modelDotName}</field>
            <field name="view_mode">list,form,kanban,calendar</field>
            <field name="search_view_id" ref="${pureName}_search"/>
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
