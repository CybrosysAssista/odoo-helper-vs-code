// Placeholder fields (field1, field2, line_ids, total) are meant to be replaced by the model's own fields.
export const getReportViewTemplate = (pureName: string, modelDotName: string, modelTitle: string, reportType = 'qweb-pdf', moduleName = 'module_name'): string => `<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- Report Action -->
    <record id="action_report_${pureName}" model="ir.actions.report">
        <field name="name">${modelTitle}</field>
        <field name="model">${modelDotName}</field>
        <field name="report_type">${reportType}</field>
        <field name="report_name">${moduleName}.report_${pureName}</field>
        <field name="print_report_name">'${modelTitle} - %s' % object.display_name</field>
        <field name="binding_model_id" ref="model_${modelDotName.replace(/\./g, '_')}"/>
        <field name="binding_type">report</field>
    </record>

    <!-- One document -->
    <template id="report_${pureName}_document">
        <t t-call="web.external_layout">
            <div class="page">
                <h2 t-field="doc.name"/>

                <div class="row mt-4 mb-4">
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
                            <th name="th_description" class="text-start">Description</th>
                            <th name="th_quantity" class="text-end">Quantity</th>
                            <th name="th_price" class="text-end">Price</th>
                            <th name="th_subtotal" class="text-end">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr t-foreach="doc.line_ids" t-as="line">
                            <td name="td_description"><span t-field="line.description"/></td>
                            <td name="td_quantity" class="text-end"><span t-field="line.quantity"/></td>
                            <td name="td_price" class="text-end"><span t-field="line.price"/></td>
                            <td name="td_subtotal" class="text-end"><span t-field="line.subtotal"/></td>
                        </tr>
                    </tbody>
                </table>

                <div class="row">
                    <div class="col-4 offset-8">
                        <table class="table table-sm">
                            <tr class="border-black">
                                <td><strong>Total</strong></td>
                                <td class="text-end"><span t-field="doc.total"/></td>
                            </tr>
                        </table>
                    </div>
                </div>
            </div>
        </t>
    </template>

    <!-- Report entry point: one document per record -->
    <template id="report_${pureName}">
        <t t-call="web.html_container">
            <t t-foreach="docs" t-as="doc">
                <t t-call="${moduleName}.report_${pureName}_document"/>
            </t>
        </t>
    </template>
</odoo>
`;
