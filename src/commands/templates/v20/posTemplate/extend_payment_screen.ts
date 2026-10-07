import { FileSystemNode } from "../../../../utils/utils";
import { posAssetFiles } from "./structure";

/** Extends the POS payment screen (Odoo 20) */
export class extendPaymentScreen {
    constructor(private moduleName: string) { }

    public getJsContent(): string {
        return `import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";

patch(PaymentScreen.prototype, {
    setup() {
        super.setup(...arguments);
    },

    async addNewPaymentLine(paymentMethod, args = {}) {
        // Custom logic before a payment line is added
        return super.addNewPaymentLine(...arguments);
    },

    async onClickValidate(args = {}) {
        // Custom checks before the order is validated
        return super.onClickValidate(...arguments);
    },

    onClickCustomPaymentAction() {
        this.notification.add(_t("Custom payment action"), { type: "info" });
    },
});
`;
    }

    public getXmlContent(): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
<templates xml:space="preserve">
    <t t-inherit="point_of_sale.PaymentScreenButtons" t-inherit-mode="extension">
        <xpath expr="//div[hasclass('payment-buttons')]" position="inside">
            <button class="btn btn-light btn-lg ${this.moduleName}_custom_payment_button" t-on-click="() => this.onClickCustomPaymentAction()">
                <i class="oi me-2" data-icon="bolt" role="img" aria-label="Custom" title="Custom"/>Custom Action
            </button>
        </xpath>
    </t>
</templates>
`;
    }

    public getScssContent(): string {
        return `.${this.moduleName}_custom_payment_button {
    width: 100%;
}
`;
    }

    public getCompleteDirectoryStructure(): FileSystemNode[] {
        return posAssetFiles('payment_screen', [
            { name: 'payment_screen.js', content: this.getJsContent() },
            { name: 'payment_screen.xml', content: this.getXmlContent() },
            { name: 'payment_screen.scss', content: this.getScssContent() },
        ]);
    }
}
