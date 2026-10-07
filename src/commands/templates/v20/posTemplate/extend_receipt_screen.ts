import { FileSystemNode } from "../../../../utils/utils";
import { posAssetFiles } from "./structure";

/**
 * Extends the POS receipt (Odoo 20). There is no ReceiptScreen/OrderReceipt component anymore:
 * receipts are the QWeb templates point_of_sale.pos_order_receipt[_header|_footer], rendered from
 * the data GeneratePrinterData.generateReceiptData() produces. So the extension is a template
 * inheriting the footer (manifest data) plus a JS patch adding the value it shows.
 */
export class extendReceiptScreen {
    constructor(private moduleName: string) { }

    public getJsContent(): string {
        return `import { GeneratePrinterData } from "@point_of_sale/app/utils/printer/generate_printer_data";
import { patch } from "@web/core/utils/patch";

patch(GeneratePrinterData.prototype, {
    generateReceiptData() {
        const data = super.generateReceiptData(...arguments);
        // Shown by ${this.moduleName}.pos_order_receipt_footer
        data.extra_data.${this.moduleName}_message = "Thank you for shopping with us!";
        return data;
    },
});
`;
    }

    public getXmlContent(): string {
        return `<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <template id="pos_order_receipt_footer" inherit_id="point_of_sale.pos_order_receipt_footer">
        <xpath expr="//div[@name='footer']" position="inside">
            <div t-if="extra_data.get('${this.moduleName}_message')" class="text-center fw-bold"
                 t-out="extra_data['${this.moduleName}_message']"/>
        </xpath>
    </template>
</odoo>
`;
    }

    public getCompleteDirectoryStructure(): FileSystemNode[] {
        return [
            ...posAssetFiles('receipt', [{ name: 'generate_printer_data.js', content: this.getJsContent() }]),
            {
                type: 'folder', name: 'views', doNotExist: false, children: [{
                    type: 'file',
                    name: 'pos_order_receipt.xml',
                    content: this.getXmlContent(),
                    updateManifest: true,
                    manifestCategory: 'data',
                    dataCategory: 'view',
                    depends: ['point_of_sale'],
                }],
            },
        ];
    }
}
