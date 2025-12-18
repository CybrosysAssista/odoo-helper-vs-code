import { FileSystemNode } from "../../../../utils/utils";

export class extendPartnerListScreen {
    private moduleName: string;

    constructor(moduleName: string) {
        this.moduleName = moduleName;
    }

    public getJsContent(): string {
        return `/** @odoo-module */

import { PartnerList } from "@point_of_sale/app/screens/partner_list/partner_list";
import { patch } from "@web/core/utils/patch";

patch(PartnerList.prototype, {
    setup() {
        super.setup(...arguments);
        console.log("Partner List Screen Extended - Custom Module Loaded");
    },
    
    onBulkAction() {
        console.log("Bulk action clicked!");
        const partners = this.getPartners();

        this.notification.add(
            \`Bulk action available for \${partners.length} customers\`,
            {
                type: "info",
            }
        );
    },

    onImportCustomers() {
        console.log("Import customers clicked!");

        this.notification.add("Import customers feature", {
            type: "warning",
        });
    },

    clickPartner(partner) {
        console.log("Custom logic when selecting partner:", partner?.name);
        
        return super.clickPartner(partner);
    },

    getPartners() {
        const partners = super.getPartners();

        return partners;
    },
});`;
    }

    public getXmlContent(): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
<templates id="template" xml:space="preserve">

    <t t-name="point_of_sale.PartnerList" t-inherit="point_of_sale.PartnerList" t-inherit-mode="extension">
        
        <xpath expr="//t[@t-set-slot='footer']/div" position="inside">
            <button class="btn btn-info custom-bulk-action-btn btn-lg lh-lg" t-on-click="onBulkAction">
                <i class="fa fa-tasks me-2"/> Custom Action
            </button>
            <button class="btn btn-warning custom-import-btn btn-lg lh-lg" t-on-click="onImportCustomers">
                <i class="fa fa-upload me-2"/> Import
            </button>
        </xpath>

    </t>
</templates>`;
    }

    public getScssContent(): string {
        return `.custom-bulk-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 1.25rem;
    border-radius: 0.5rem;
    font-weight: 600;
    transition: all 0.3s ease;

    // Gradient background with info colors
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
        font-size: 1rem;
    }
}

.custom-import-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 1.25rem;
    border-radius: 0.5rem;
    font-weight: 600;
    transition: all 0.3s ease;

    background: linear-gradient(135deg, #ffc107 0%, #e0a800 100%);
    border: none;
    color: #212529;
    box-shadow: 0 2px 4px rgba(255, 193, 7, 0.2);

    &:hover {
        background: linear-gradient(135deg, #e0a800 0%, #d39e00 100%);
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(255, 193, 7, 0.3);
        color: #212529;
    }

    &:active {
        transform: translateY(0);
        box-shadow: 0 2px 4px rgba(255, 193, 7, 0.2);
    }

    i {
        font-size: 1rem;
    }
}

@media (max-width: 768px) {

    .custom-bulk-action-btn,
    .custom-import-btn {
        padding: 0.6rem 1rem;
        font-size: 0.9rem;

        i {
            font-size: 0.9rem;
        }
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
                                                name: 'partner_list_screen',
                                                doNotExist: true,
                                                children: [
                                                    {
                                                        type: 'file',
                                                        name: 'partner_list_screen.js',
                                                        content: this.getJsContent(),
                                                        updateManifest: true,
                                                        manifestCategory: 'asset',
                                                        assetCategory: 'pos'
                                                    },
                                                    {
                                                        type: 'file',
                                                        name: 'partner_list_screen.xml',
                                                        content: this.getXmlContent(),
                                                        updateManifest: true,
                                                        manifestCategory: 'asset',
                                                        assetCategory: 'pos'
                                                    },
                                                    {
                                                        type: 'file',
                                                        name: 'partner_list_screen.scss',
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
