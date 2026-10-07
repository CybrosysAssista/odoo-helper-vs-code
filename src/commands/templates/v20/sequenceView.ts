export const getSequenceViewTemplate = (pureName: string, modelDotName: string, modelTitle: string): string => `<?xml version="1.0" encoding="utf-8"?>
<odoo noupdate="1">
    <!-- Use it with: self.env['ir.sequence'].next_by_code('${modelDotName}') -->
    <record id="seq_${pureName}" model="ir.sequence">
        <field name="name">${modelTitle}</field>
        <field name="code">${modelDotName}</field>
        <field name="prefix">${pureName.replace(/_/g, '').toUpperCase().slice(0, 3)}/%(year)s/</field>
        <field name="padding">5</field>
        <field name="company_id" eval="False"/>
    </record>
</odoo>
`;
