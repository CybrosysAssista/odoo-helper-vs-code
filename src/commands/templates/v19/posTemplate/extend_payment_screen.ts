import { FileSystemNode } from "../../../../utils/utils";

export class extendPaymentScreen {
    private moduleName: string;

    constructor(moduleName: string) {
        this.moduleName = moduleName;
    }

    public getJsContent(): string {
        return `/** @odoo-module */

import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { patch } from "@web/core/utils/patch";

patch(PaymentScreen.prototype, {
    setup() {
        super.setup(...arguments);
        console.log("Payment Screen Extended - Custom Module Loaded");
    },

    onCustomPaymentAction() {
        console.log("Custom payment action clicked!");
        this.notification.add("Payment Screen Extension Active!", {
            type: "info",
        });
    },

    async validateOrder(isForceValidate) {
        console.log("Custom logic before order validation");

        return super.validateOrder(isForceValidate);
    },

    async addNewPaymentLine(paymentMethod) {
        console.log("Adding payment line with custom logic:", paymentMethod.name);

        return super.addNewPaymentLine(paymentMethod);
    },
});`;
    }

    public getXmlContent(): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
<templates id="template" xml:space="preserve">

    <t t-name="point_of_sale.PaymentScreenButtons" t-inherit="point_of_sale.PaymentScreenButtons" t-inherit-mode="extension">
        
        <xpath expr="//div[@class='payment-buttons d-flex flex-column gap-2']/div[1]" position="after">
            <div class="d-flex flex-column flex-sm-row gap-2 w-100">
                <button class="btn btn-info custom-payment-action-btn btn-lg lh-lg w-100" t-on-click="onCustomPaymentAction">
                    <i class="fa fa-magic me-2"/> Custom Action
                </button>
            </div>
        </xpath>

    </t>

</templates>`;
    }

    public getScssContent(): string {
        return `.custom-payment-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    font-weight: 600;
    transition: all 0.3s ease;

    background: linear-gradient(135deg, #17a2b8 0%, #138496 100%);
    border: none;
    color: white;
    box-shadow: 0 2px 4px rgba(23, 162, 184, 0.2);

    &:hover {
        background: linear-gradient(135deg, #138496 0%, #117a8b 100%);
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(23, 162, 184, 0.3);
        color: white;
    }

    &:active {
        transform: translateY(0);
        box-shadow: 0 2px 4px rgba(23, 162, 184, 0.2);
    }

    i {
        font-size: 1.1rem;
    }
}

@media (max-width: 768px) {
    .custom-payment-action-btn {
        padding: 0.6rem 1rem;
        font-size: 0.95rem;
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
                                                name: 'payment_screen',
                                                doNotExist: true,
                                                children: [
                                                    {
                                                        type: 'file',
                                                        name: 'payment_screen.js',
                                                        content: this.getJsContent(),
                                                        updateManifest: true,
                                                        manifestCategory: 'asset',
                                                        assetCategory: 'pos'
                                                    },
                                                    {
                                                        type: 'file',
                                                        name: 'payment_screen.xml',
                                                        content: this.getXmlContent(),
                                                        updateManifest: true,
                                                        manifestCategory: 'asset',
                                                        assetCategory: 'pos'
                                                    },
                                                    {
                                                        type: 'file',
                                                        name: 'payment_screen.scss',
                                                        content: this.getScssContent(),
                                                        updateManifest: true,
                                                        manifestCategory: 'asset',
                                                        assetCategory: 'pos'
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
