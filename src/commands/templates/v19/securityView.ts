// Since 19, groups belong to a privilege (res.groups.privilege) and list their users in user_ids
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
    const modelUnderscore = modelDotName.replace(/\./g, '_');
    return `<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <data>
        <!-- Access Rights -->
        <record id="access_${pureName}_user" model="ir.model.access">
            <field name="name">${modelDotName}.user.access</field>
            <field name="model_id" ref="model_${modelUnderscore}"/>
            <field name="group_id" ref="group_${pureName}_user"/>
            <field name="perm_read" eval="1"/>
            <field name="perm_write" eval="1"/>
            <field name="perm_create" eval="1"/>
            <field name="perm_unlink" eval="0"/>
        </record>
        
        <record id="access_${pureName}_manager" model="ir.model.access">
            <field name="name">${modelDotName}.manager.access</field>
            <field name="model_id" ref="model_${modelUnderscore}"/>
            <field name="group_id" ref="group_${pureName}_manager"/>
            <field name="perm_read" eval="1"/>
            <field name="perm_write" eval="1"/>
            <field name="perm_create" eval="1"/>
            <field name="perm_unlink" eval="1"/>
        </record>
        
        <!-- Record Rules -->
        <record id="rule_${pureName}_user_own" model="ir.rule">
            <field name="name">${modelDotName}: Users access only their own records</field>
            <field name="model_id" ref="model_${modelUnderscore}"/>
            <field name="domain_force">[('create_uid', '=', user.id)]</field>
            <field name="groups" eval="[(4, ref('group_${pureName}_user'))]"/>
            <field name="perm_read" eval="1"/>
            <field name="perm_write" eval="1"/>
            <field name="perm_create" eval="1"/>
            <field name="perm_unlink" eval="0"/>
        </record>
        
        <record id="rule_${pureName}_manager_all" model="ir.rule">
            <field name="name">${modelDotName}: Managers access all records</field>
            <field name="model_id" ref="model_${modelUnderscore}"/>
            <field name="domain_force">[(1, '=', 1)]</field>
            <field name="groups" eval="[(4, ref('group_${pureName}_manager'))]"/>
            <field name="perm_read" eval="1"/>
            <field name="perm_write" eval="1"/>
            <field name="perm_create" eval="1"/>
            <field name="perm_unlink" eval="1"/>
        </record>
    </data>
</odoo>`;
};
