import { FileSystemNode } from "../../../../utils/utils";

export class extendTicketScreen {
    private moduleName: string;

    constructor(moduleName: string) {
        this.moduleName = moduleName;
    }

    public getJsContent(): string {
        return `/** @odoo-module */

import { TicketScreen } from "@point_of_sale/app/screens/ticket_screen/ticket_screen";
import { patch } from "@web/core/utils/patch";

patch(TicketScreen.prototype, {
    setup() {
        super.setup(...arguments);
        console.log("Order Management Screen Extended - Custom Module Loaded");
    },

    onReOrder() {
        console.log("Re-order action clicked!");
        const order = this.getSelectedOrder();

        if (!order) {
            return;
        }

        this.notification.add(
            \`Re-ordering items from order \${order.pos_reference || order.name}\`,
            {
                type: "success",
            }
        );
    },

    onEmailOrder() {
        console.log("Email order clicked!");
        const order = this.getSelectedOrder();

        if (!order) {
            return;
        }

        this.notification.add(
            \`Sending email for order \${order.pos_reference || order.name}\`,
            {
                type: "info",
            }
        );
    },

    async onDoRefund() {
        console.log("Custom logic before refunding the selected order");
        return super.onDoRefund(...arguments);
    },
});`;
    }

    public getXmlContent(): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
<templates id="template" xml:space="preserve">

    <t t-name="point_of_sale.TicketScreen" t-inherit="point_of_sale.TicketScreen" t-inherit-mode="extension">
        
        <xpath expr="//div[contains(@class, 'control-buttons')]" position="inside">
            <button class="control-button btn btn-info btn-lg lh-lg flex-grow-1 flex-shrink-1 custom-reorder-btn" 
                    t-on-click="onReOrder">
                <i class="fa fa-refresh me-1" /> Re-Order
            </button>
            <button class="control-button btn btn-secondary btn-lg lh-lg flex-grow-1 flex-shrink-1 custom-email-btn" 
                    t-on-click="onEmailOrder">
                <i class="fa fa-envelope me-1" /> Email
            </button>
        </xpath>

        <xpath expr="//div[contains(@class, 'header-row')]/div[contains(@class, 'end')]" position="before">
            <div class="col narrow p-2">Type</div>
        </xpath>

        <xpath expr="//div[contains(@class, 'order-row')]/div[contains(@class, 'end')]" position="before">
            <div class="col narrow p-2">
                <span class="badge bg-info text-dark">POS</span>
            </div>
        </xpath>

    </t>

</templates>`;
    }

    public getScssContent(): string {
        return `.custom-reorder-btn {
    background: linear-gradient(135deg, #17a2b8 0%, #138496 100%);
    border: none;
    color: white;
    transition: all 0.3s ease;

    &:hover {
        background: linear-gradient(135deg, #138496 0%, #117a8b 100%);
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(23, 162, 184, 0.3);
        color: white;
    }

    &:active {
        transform: translateY(0);
    }
}

.custom-email-btn {
    background: linear-gradient(135deg, #6c757d 0%, #5a6268 100%);
    border: none;
    color: white;
    transition: all 0.3s ease;

    &:hover {
        background: linear-gradient(135deg, #5a6268 0%, #545b62 100%);
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(108, 117, 125, 0.3);
        color: white;
    }

    &:active {
        transform: translateY(0);
    }
}`;
    }

    public getCompleteDirectoryStructure(): FileSystemNode[] {
        return [
            {
                type: 'folder',
                name: 'static',
                doNotExist: false,
                children: [
                    {
                        type: 'folder',
                        name: 'src',
                        doNotExist: false,
                        children: [
                            {
                                type: 'folder',
                                name: 'app',
                                doNotExist: false,
                                children: [
                                    {
                                        type: 'folder',
                                        name: 'screens',
                                        doNotExist: false,
                                        children: [
                                            {
                                                type: 'folder',
                                                name: 'ticket_screen',
                                                doNotExist: true,
                                                children: [
                                                    {
                                                        type: 'file',
                                                        name: 'ticket_screen.js',
                                                        content: this.getJsContent(),
                                                        updateManifest: true,
                                                        manifestCategory: 'asset',
                                                        assetCategory: 'pos',
                                                        depends: ['point_of_sale']
                                                    },
                                                    {
                                                        type: 'file',
                                                        name: 'ticket_screen.xml',
                                                        content: this.getXmlContent(),
                                                        updateManifest: true,
                                                        manifestCategory: 'asset',
                                                        assetCategory: 'pos',
                                                        depends: ['point_of_sale']
                                                    },
                                                    {
                                                        type: 'file',
                                                        name: 'ticket_screen.scss',
                                                        content: this.getScssContent(),
                                                        updateManifest: true,
                                                        manifestCategory: 'asset',
                                                        assetCategory: 'pos',
                                                        depends: ['point_of_sale']
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ];
    }
}
