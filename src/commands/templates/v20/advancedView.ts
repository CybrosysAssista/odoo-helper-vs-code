// Placeholder fields (field1..field4, line_ids, notes) are meant to be replaced by the model's own fields.
export const getAdvancedViewTemplate = (pureName: string, modelDotName: string, modelTitle: string): string => `<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- Form View -->
    <record id="${pureName}_view_form" model="ir.ui.view">
        <field name="name">${modelDotName}.view.form</field>
        <field name="model">${modelDotName}</field>
        <field name="arch" type="xml">
            <form>
                <header>
                    <button name="action_confirm" string="Confirm" type="object" class="btn-primary" invisible="state != 'draft'"/>
                    <button name="action_cancel" string="Cancel" type="object" invisible="state in ('done', 'cancel')"/>
                    <field name="state" widget="statusbar" statusbar_visible="draft,confirmed,done"/>
                </header>
                <sheet>
                    <widget name="web_ribbon" title="Archived" bg_color="text-bg-danger" invisible="active"/>
                    <div class="oe_title">
                        <h1>
                            <field name="name" placeholder="Name"/>
                        </h1>
                    </div>
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
                    <notebook>
                        <page string="Lines" name="lines">
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
                        <page string="Notes" name="notes">
                            <field name="notes"/>
                        </page>
                    </notebook>
                </sheet>
                <chatter/>
            </form>
        </field>
    </record>

    <!-- List View -->
    <record id="${pureName}_view_list" model="ir.ui.view">
        <field name="name">${modelDotName}.view.list</field>
        <field name="model">${modelDotName}</field>
        <field name="arch" type="xml">
            <list decoration-info="state == 'draft'" decoration-success="state == 'done'" decoration-muted="state == 'cancel'" sample="1">
                <field name="name"/>
                <field name="field1"/>
                <field name="field2" optional="show"/>
                <field name="create_date" optional="hide"/>
                <field name="state" widget="badge" decoration-success="state == 'done'" decoration-info="state == 'draft'"/>
            </list>
        </field>
    </record>

    <!-- Search View -->
    <record id="${pureName}_view_search" model="ir.ui.view">
        <field name="name">${modelDotName}.view.search</field>
        <field name="model">${modelDotName}</field>
        <field name="arch" type="xml">
            <search>
                <field name="name"/>
                <field name="field1"/>
                <field name="field2"/>
                <separator/>
                <filter string="Draft" name="draft" domain="[('state', '=', 'draft')]"/>
                <filter string="Confirmed" name="confirmed" domain="[('state', '=', 'confirmed')]"/>
                <filter string="Done" name="done" domain="[('state', '=', 'done')]"/>
                <separator/>
                <filter string="Archived" name="inactive" domain="[('active', '=', False)]"/>
                <group>
                    <filter string="Status" name="groupby_state" context="{'group_by': 'state'}"/>
                    <filter string="Creation Date" name="groupby_create_date" context="{'group_by': 'create_date:month'}"/>
                </group>
            </search>
        </field>
    </record>

    <!-- Calendar View -->
    <record id="${pureName}_view_calendar" model="ir.ui.view">
        <field name="name">${modelDotName}.view.calendar</field>
        <field name="model">${modelDotName}</field>
        <field name="arch" type="xml">
            <calendar date_start="create_date" color="state" mode="month">
                <field name="name"/>
                <field name="state"/>
            </calendar>
        </field>
    </record>

    <!-- Kanban View -->
    <record id="${pureName}_view_kanban" model="ir.ui.view">
        <field name="name">${modelDotName}.view.kanban</field>
        <field name="model">${modelDotName}</field>
        <field name="arch" type="xml">
            <kanban default_group_by="state" sample="1">
                <templates>
                    <t t-name="card">
                        <field name="name" class="fw-bold fs-5"/>
                        <field name="field1"/>
                        <field name="field2"/>
                    </t>
                </templates>
            </kanban>
        </field>
    </record>

    <!-- Action -->
    <record id="action_${pureName}" model="ir.actions.act_window">
        <field name="name">${modelTitle}</field>
        <field name="res_model">${modelDotName}</field>
        <field name="view_mode">list,kanban,form,calendar</field>
        <field name="search_view_id" ref="${pureName}_view_search"/>
        <field name="help" type="html">
            <p class="o_view_nocontent_smiling_face">
                Create your first ${modelTitle.toLowerCase()}!
            </p>
        </field>
    </record>

    <!-- Menus -->
    <menuitem id="menu_${pureName}_root" name="${modelTitle}" sequence="10"/>
    <menuitem id="menu_${pureName}" name="${modelTitle}" parent="menu_${pureName}_root" action="action_${pureName}" sequence="10"/>
</odoo>
`;
