import { FileSystemNode } from "../../../../utils/utils";
import { posAssetFiles } from "./structure";

/** Extends the POS ticket (orders) screen (Odoo 20) */
export class extendTicketScreen {
    constructor(private moduleName: string) { }

    public getJsContent(): string {
        return `import { TicketScreen } from "@point_of_sale/app/screens/ticket_screen/ticket_screen";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { _t } from "@web/core/l10n/translation";

patch(TicketScreen.prototype, {
    setup() {
        super.setup(...arguments);
        this.notification = useService("notification");
    },

    async onDeleteOrder(order) {
        // Custom checks before an order is deleted
        return super.onDeleteOrder(...arguments);
    },

    onClickCustomTicketAction() {
        const order = this.getSelectedOrder();
        this.notification.add(
            order ? _t("Selected order: %s", order.pos_reference || order.name) : _t("No order selected"),
            { type: "info" }
        );
    },
});
`;
    }

    public getXmlContent(): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
<templates xml:space="preserve">
    <t t-inherit="point_of_sale.TicketScreen" t-inherit-mode="extension">
        <xpath expr="//div[hasclass('controls')]" position="inside">
            <button class="btn btn-secondary btn-lg ${this.moduleName}_custom_ticket_button" t-on-click="() => this.onClickCustomTicketAction()">
                <i class="oi me-2" data-icon="info" role="img" aria-label="Order info" title="Order info"/>Order Info
            </button>
        </xpath>
    </t>
</templates>
`;
    }

    public getScssContent(): string {
        return `.${this.moduleName}_custom_ticket_button {
    white-space: nowrap;
}
`;
    }

    public getCompleteDirectoryStructure(): FileSystemNode[] {
        return posAssetFiles('ticket_screen', [
            { name: 'ticket_screen.js', content: this.getJsContent() },
            { name: 'ticket_screen.xml', content: this.getXmlContent() },
            { name: 'ticket_screen.scss', content: this.getScssContent() },
        ]);
    }
}
