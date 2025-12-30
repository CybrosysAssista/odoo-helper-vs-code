import { FileSystemNode } from "../../../../utils/utils";

export class serviceTemplate {
    private componentName: string;
    private moduleName: string;
    private componentTechnicalName: string;
    private componentClassName: string;

    constructor(componentName: string, moduleName: string) {
        this.componentName = componentName;
        this.moduleName = moduleName;
        this.componentTechnicalName = this.componentName.replace(/[^A-Za-z_ ]/g, "").replace(/\s+/g, "_").toLowerCase();
        this.componentClassName = this.componentTechnicalName.split("_")
            .map(part =>
                part ? part[0].toUpperCase() + part.slice(1) : ""
            )
            .join("");
    }

    public getJsContent(): string {
        return `/** @odoo-module */

import { registry } from "@web/core/registry";

const ${this.componentClassName} = {
    /**
     * Called once when the service is initialized.
     * env contains access to other services if needed.
     */
    start(env) {
        // Private state (not exposed to components)
        let counter = 0;

        // Public API returned
        return {
            increment() {
                counter++;
            },
            getValue() {
                return counter;
            },
        };
    },
};

// Register service
registry.category("services").add("${this.componentTechnicalName}", ${this.componentClassName});`;
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
                                name: 'services',
                                doNotExist: false,
                                children: [
                                    {
                                        type: 'folder',
                                        name: this.componentTechnicalName,
                                        doNotExist: true,
                                        children: [
                                            {
                                                type: 'file',
                                                name: `${this.componentTechnicalName}.js`,
                                                content: this.getJsContent(),
                                                updateManifest: true,
                                                manifestCategory: 'asset',
                                                assetCategory: 'backend'
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
