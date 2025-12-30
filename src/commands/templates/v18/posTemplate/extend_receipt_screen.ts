import { FileSystemNode } from "../../../../utils/utils";

export class extendReceiptScreen {
    private moduleName: string;

    constructor(moduleName: string) {
        this.moduleName = moduleName;
    }

    public getJsContent(): string {
        return `/** @odoo-module */

import { ReceiptScreen } from "@point_of_sale/app/screens/receipt_screen/receipt_screen";
import { patch } from "@web/core/utils/patch";

patch(ReceiptScreen.prototype, {
    setup() {
        super.setup(...arguments);
        console.log("Receipt Screen Extended - Custom Module Loaded");
    },
    
    onCustomReceiptAction() {
        this.notification.add("Custom Receipt Action Executed!", {
            type: "success",
        });
    },

    async orderDone() {
        console.log("Custom logic before creating new order");

        return super.orderDone();
    },

    async printReceipt() {
        console.log("Custom receipt printing logic");

        if (super.printReceipt) {
            return super.printReceipt();
        }
    },
});`;
    }

    public getXmlContent(): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
<templates id="template" xml:space="preserve">

    <t t-name="point_of_sale.ReceiptScreen" t-inherit="point_of_sale.ReceiptScreen" t-inherit-mode="extension">
        <xpath expr="//div[@class='receipt-options d-flex flex-column gap-2']" position="inside">
            <div class="d-flex gap-1 mt-2">
                <button class="btn btn-success custom-receipt-action-btn btn-lg w-100 py-3" t-on-click="onCustomReceiptAction">
                    <i class="fa fa-star me-2"/> Custom Receipt Action
                </button>
            </div>
        </xpath>
    </t>

</templates>`;
    }

    public getScssContent(): string {
        return `.custom-receipt-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    font-weight: 600;
    transition: all 0.3s ease;

    background: linear-gradient(135deg, #28a745 0%, #218838 100%);
    border: none;
    color: white;
    box-shadow: 0 2px 4px rgba(40, 167, 69, 0.2);

    &:hover {
        background: linear-gradient(135deg, #218838 0%, #1e7e34 100%);
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(40, 167, 69, 0.3);
        color: white;
    }

    &:active {
        transform: translateY(0);
        box-shadow: 0 2px 4px rgba(40, 167, 69, 0.2);
    }

    i {
        font-size: 1.1rem;
        animation: pulse 2s ease-in-out infinite;
    }
}

@keyframes pulse {

    0%,
    100% {
        transform: scale(1);
    }

    50% {
        transform: scale(1.1);
    }
}

@media (max-width: 768px) {
    .custom-receipt-action-btn {
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
                                                name: 'receipt_screen',
                                                doNotExist: true,
                                                children: [
                                                    {
                                                        type: 'file',
                                                        name: 'receipt_screen.js',
                                                        content: this.getJsContent(),
                                                        updateManifest: true,
                                                        manifestCategory: 'asset',
                                                        assetCategory: 'pos',
                                                        depends: ['point_of_sale']
                                                    },
                                                    {
                                                        type: 'file',
                                                        name: 'receipt_screen.xml',
                                                        content: this.getXmlContent(),
                                                        updateManifest: true,
                                                        manifestCategory: 'asset',
                                                        assetCategory: 'pos',
                                                        depends: ['point_of_sale']
                                                    },
                                                    {
                                                        type: 'file',
                                                        name: 'receipt_screen.scss',
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
