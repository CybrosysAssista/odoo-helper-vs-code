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
        return `import { registry } from "@web/core/registry";

/**
 * ${this.componentClassName} service (Odoo 20).
 * Use it in a component with: this.${this.componentTechnicalName.replace(/_([a-z])/g, (_m, c) => c.toUpperCase())} = useService("${this.componentTechnicalName}");
 */
export const ${this.componentTechnicalName.replace(/_([a-z])/g, (_m, c) => c.toUpperCase())}Service = {
    // Services this one needs; they are passed to start() once ready.
    dependencies: ["orm"],

    start(env, { orm }) {
        // Private state, not exposed to components
        let counter = 0;

        // Public API
        return {
            increment() {
                counter++;
            },
            getValue() {
                return counter;
            },
            async countRecords(model, domain = []) {
                return orm.searchCount(model, domain);
            },
        };
    },
};

registry.category("services").add("${this.componentTechnicalName}", ${this.componentTechnicalName.replace(/_([a-z])/g, (_m, c) => c.toUpperCase())}Service);
`;
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
                                                assetCategory: 'backend',
                                                depends: ['base']
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
