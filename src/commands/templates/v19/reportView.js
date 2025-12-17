module.exports = {
    getReportViewTemplate: (pureName, modelDotName, modelTitle) => `<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <data>
        <!-- Report Action -->
        <record id="action_report_${pureName}" model="ir.actions.report">
            <field name="name">${modelTitle} Report</field>
            <field name="model">${modelDotName}</field>
            <field name="report_type">qweb-pdf</field>
            <field name="report_name">${modelDotName}.report_${pureName}</field>
            <field name="report_file">${modelDotName}.report_${pureName}</field>
            <field name="binding_model_id" ref="model_${pureName.replace('.', '_')}"/>
            <field name="binding_type">report</field>
        </record>
        
        <!-- Report Template -->
        <template id="report_${pureName}_document">
            <t t-call="web.external_layout">
                <t t-set="doc" t-value="doc.with_context(lang=doc.partner_id.lang)" />
                <div class="page">
                    <div class="oe_structure"/>
                    <h2>
                        <span t-field="doc.name"/>
                    </h2>
                    
                    <div class="row mt32 mb32">
                        <div class="col-auto">
                            <strong>Field 1:</strong>
                            <p t-field="doc.field1"/>
                        </div>
                        <div class="col-auto">
                            <strong>Field 2:</strong>
                            <p t-field="doc.field2"/>
                        </div>
                        <div class="col-auto">
                            <strong>Date:</strong>
                            <p t-field="doc.create_date"/>
                        </div>
                    </div>
                    
                    <table class="table table-sm o_main_table">
                        <thead>
                            <tr>
                                <th name="th_description" class="text-left">Description</th>
                                <th name="th_quantity" class="text-right">Quantity</th>
                                <th name="th_price" class="text-right">Price</th>
                                <th name="th_subtotal" class="text-right">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            <t t-foreach="doc.line_ids" t-as="line">
                                <tr>
                                    <td name="td_description"><span t-field="line.description"/></td>
                                    <td name="td_quantity" class="text-right"><span t-field="line.quantity"/></td>
                                    <td name="td_price" class="text-right"><span t-field="line.price"/></td>
                                    <td name="td_subtotal" class="text-right"><span t-field="line.subtotal"/></td>
                                </tr>
                            </t>
                        </tbody>
                    </table>
                    
                    <div class="row">
                        <div class="col-4 offset-8">
                            <table class="table table-sm">
                                <tr class="border-black">
                                    <td><strong>Total</strong></td>
                                    <td class="text-right">
                                        <span t-field="doc.total"/>
                                    </td>
                                </tr>
                            </table>
                        </div>
                    </div>
                    
                    <div class="oe_structure"/>
                </div>
            </t>
        </template>
        
        <template id="report_${pureName}">
            <t t-call="web.html_container">
                <t t-foreach="docs" t-as="doc">
                    <t t-call="${modelDotName}.report_${pureName}_document" t-lang="doc.partner_id.lang"/>
                </t>
            </t>
        </template>
    </data>
</odoo>`
};
