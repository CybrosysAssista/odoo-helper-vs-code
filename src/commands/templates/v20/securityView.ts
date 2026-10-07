// Odoo 20 security: groups belong to a privilege (res.groups.privilege); access rights and record
// rules are both ir.access records (operation = subset of "crud", optional domain).
export const getSecurityGroupViewTemplate = (pureName: string, modelTitle: string): string => `<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <record id="res_groups_privilege_${pureName}" model="res.groups.privilege">
        <field name="name">${modelTitle}</field>
        <field name="sequence">10</field>
    </record>

    <record id="group_${pureName}_user" model="res.groups">
        <field name="name">User</field>
        <field name="sequence">10</field>
        <field name="privilege_id" ref="res_groups_privilege_${pureName}"/>
        <field name="comment">Basic access to ${modelTitle}</field>
        <field name="implied_ids" eval="[(4, ref('base.group_user'))]"/>
    </record>

    <record id="group_${pureName}_manager" model="res.groups">
        <field name="name">Manager</field>
        <field name="sequence">20</field>
        <field name="privilege_id" ref="res_groups_privilege_${pureName}"/>
        <field name="comment">Full access to ${modelTitle}</field>
        <field name="implied_ids" eval="[(4, ref('group_${pureName}_user'))]"/>
        <field name="user_ids" eval="[(4, ref('base.user_admin'))]"/>
    </record>
</odoo>
`;

export const getSecurityRuleViewTemplate = (pureName: string, modelDotName: string): string => {
    const modelRef = `model_${modelDotName.replace(/\./g, '_')}`;
    return `<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- Users: their own records, everything but delete -->
    <record id="access_${pureName}_user" model="ir.access">
        <field name="name">${modelDotName}: user</field>
        <field name="model_id" ref="${modelRef}"/>
        <field name="group_id" ref="group_${pureName}_user"/>
        <field name="operation">cru</field>
        <field name="domain">[('create_uid', '=', user.id)]</field>
    </record>

    <!-- Managers: all records, all operations -->
    <record id="access_${pureName}_manager" model="ir.access">
        <field name="name">${modelDotName}: manager</field>
        <field name="model_id" ref="${modelRef}"/>
        <field name="group_id" ref="group_${pureName}_manager"/>
        <field name="operation">crud</field>
    </record>
</odoo>
`;
};
