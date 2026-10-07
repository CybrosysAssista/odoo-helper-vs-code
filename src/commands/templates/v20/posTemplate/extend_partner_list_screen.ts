import { FileSystemNode } from "../../../../utils/utils";
import { posAssetFiles } from "./structure";

/** Extends the POS customer list (Odoo 20) */
export class extendPartnerListScreen {
    constructor(private moduleName: string) { }

    public getJsContent(): string {
        return `import { PartnerList } from "@point_of_sale/app/screens/partner_list/partner_list";
import { patch } from "@web/core/utils/patch";
import { _t } from "@web/core/l10n/translation";

// In Odoo 20 the customer list is a dialog (PartnerList).
patch(PartnerList.prototype, {
    setup() {
        super.setup(...arguments);
    },

    clickPartner(partner) {
        // Custom logic when a customer is picked
        return super.clickPartner(...arguments);
    },

    onClickCustomAction() {
        this.notification.add(_t("Custom customer action"), { type: "info" });
    },
});
`;
    }

    public getXmlContent(): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
<templates xml:space="preserve">
    <t t-inherit="point_of_sale.PartnerList" t-inherit-mode="extension">
        <xpath expr="//t[@t-set-slot='footer']/div" position="inside">
            <button class="btn btn-secondary flex-fill ${this.moduleName}_custom_partner_button" t-on-click="() => this.onClickCustomAction()">
                Custom Action
            </button>
        </xpath>
    </t>
</templates>
`;
    }

    public getScssContent(): string {
        return `.${this.moduleName}_custom_partner_button {
    white-space: nowrap;
}
`;
    }

    public getCompleteDirectoryStructure(): FileSystemNode[] {
        return posAssetFiles('partner_list', [
            { name: 'partner_list.js', content: this.getJsContent() },
            { name: 'partner_list.xml', content: this.getXmlContent() },
            { name: 'partner_list.scss', content: this.getScssContent() },
        ]);
    }
}
