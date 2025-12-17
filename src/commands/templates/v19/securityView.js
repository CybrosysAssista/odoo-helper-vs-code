module.exports = {
    getSecurityGroupViewTemplate: (pureName, modelTitle) => `<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <data>
        <!-- Custom Groups -->
        <record id="group_${pureName}_user" model="res.groups">
            <field name="name">${modelTitle} User</field>
            <field name="category_id" ref="base.module_category_hidden"/>
            <field name="comment">Basic access to ${modelTitle}</field>
            <field name="implied_ids" eval="[(4, ref('base.group_user'))]"/>
        </record>
        
        <record id="group_${pureName}_manager" model="res.groups">
            <field name="name">${modelTitle} Manager</field>
            <field name="category_id" ref="base.module_category_hidden"/>
            <field name="comment">Full access to ${modelTitle}</field>
            <field name="implied_ids" eval="[(4, ref('group_${pureName}_user'))]"/>
        </record>
        
        <!-- Sample Users Data -->
        <record id="user_${pureName}_demo_user" model="res.users">
            <field name="name">${modelTitle} Demo User</field>
            <field name="login">${pureName}_demo_user</field>
            <field name="groups_id" eval="[(4, ref('group_${pureName}_user'))]"/>
            <field name="password">${pureName}_demo_user</field>
            <field name="email">${pureName}_demo_user@example.com</field>
        </record>
    </data>
</odoo>`,

    getSecurityRuleViewTemplate: (pureName, modelDotName) => {
        const modelUnderscore = modelDotName.replace('.', '_');
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
    }
};
