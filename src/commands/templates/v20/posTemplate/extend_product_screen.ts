import { FileSystemNode } from "../../../../utils/utils";
import { posAssetFiles } from "./structure";

/** Extends the POS product screen (Odoo 20) */
export class extendProductScreen {
    constructor(private moduleName: string) { }

    public getJsContent(): string {
        return `import { ProductScreen } from "@point_of_sale/app/screens/product_screen/product_screen";
import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";

patch(ProductScreen.prototype, {
    setup() {
        super.setup(...arguments);
        // this.pos, this.notification and this.dialog are set up by ProductScreen.
    },

    async addProductToOrder(product) {
        // Custom logic before a product is added
        const result = await super.addProductToOrder(...arguments);
        // Custom logic after
        return result;
    },

    onClickCustomButton() {
        this.notification.add(_t("Custom product screen action"), { type: "success" });
    },
});
`;
    }

    public getXmlContent(): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
<templates xml:space="preserve">
    <t t-inherit="point_of_sale.ProductScreen" t-inherit-mode="extension">
        <xpath expr="//div[hasclass('subpads')]" position="inside">
            <button class="btn btn-secondary btn-lg ${this.moduleName}_custom_button" t-on-click="() => this.onClickCustomButton()">
                <i class="oi me-2" data-icon="star" role="img" aria-label="Custom" title="Custom"/>Custom
            </button>
        </xpath>
    </t>
</templates>
`;
    }

    public getScssContent(): string {
        return `.${this.moduleName}_custom_button {
    font-weight: 500;
}
`;
    }

    public getCompleteDirectoryStructure(): FileSystemNode[] {
        return posAssetFiles('product_screen', [
            { name: 'product_screen.js', content: this.getJsContent() },
            { name: 'product_screen.xml', content: this.getXmlContent() },
            { name: 'product_screen.scss', content: this.getScssContent() },
        ]);
    }
}
