import { FileSystemNode } from "../../../../utils/utils";

export class extendProductScreen {
    private moduleName: string;

    constructor(moduleName: string) {
        this.moduleName = moduleName;
    }

    public getJsContent(): string {
        return `/** @odoo-module */

import { ProductScreen } from "@point_of_sale/app/screens/product_screen/product_screen";
import { patch } from "@web/core/utils/patch";

patch(ProductScreen.prototype, {
    setup() {
        super.setup(...arguments);
        console.log("Product Screen Extended");
    },

    onCustomButtonClick() {
        console.log("Custom button clicked!");
        this.notification.add("Custom Product Screen Extension Active!", {
            type: "success",
        });
    },
    
    async _onClickPay() {
        console.log("Custom logic before payment");
        // Call the original method
        return super._onClickPay(...arguments);
    },
});`;
    }

    public getXmlContent(): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
<templates id="template" xml:space="preserve">

    <!-- Extend the ProductScreen template -->
    <t t-name="point_of_sale.ProductScreen" t-inherit="point_of_sale.ProductScreen" t-inherit-mode="extension">
        
        <!-- Add custom button after the ControlButtons component -->
        <xpath expr="//ControlButtons" position="after">
            <button class="btn btn-light custom-feature-btn" t-on-click="onCustomButtonClick">
                <i class="fa fa-star"/> Custom Feature
            </button>
        </xpath>

    </t>

</templates>`;
    }

    public getScssContent(): string {
        return `.custom-feature-btn {
    // Match Odoo's control button styling
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-weight: 500;
    transition: all 0.2s ease;

    // Subtle gradient for visual appeal
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    border: 1px solid #dee2e6;
    color: #495057;

    &:hover {
        background: linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%);
        border-color: #adb5bd;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    &:active {
        transform: translateY(0);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }

    i {
        color: #ffc107;
        font-size: 1rem;
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
                                                name: 'product_screen',
                                                doNotExist: true,
                                                children: [
                                                    {
                                                        type: 'file',
                                                        name: 'product_screen.js',
                                                        content: this.getJsContent(),
                                                        updateManifest: true,
                                                        manifestCategory: 'asset',
                                                        assetCategory: 'pos',
                                                        depends: ['point_of_sale']
                                                    },
                                                    {
                                                        type: 'file',
                                                        name: 'product_screen.xml',
                                                        content: this.getXmlContent(),
                                                        updateManifest: true,
                                                        manifestCategory: 'asset',
                                                        assetCategory: 'pos',
                                                        depends: ['point_of_sale']
                                                    },
                                                    {
                                                        type: 'file',
                                                        name: 'product_screen.scss',
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
