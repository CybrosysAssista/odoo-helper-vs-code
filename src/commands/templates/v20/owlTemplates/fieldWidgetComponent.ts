import { FileSystemNode } from "../../../../utils/utils";

export class fieldWidgetComponent {
    private componentName: string;
    private moduleName: string;
    private componentTechnicalName: string;
    private componentClassName: string;
    private templateName: string;

    constructor(componentName: string, moduleName: string) {
        this.componentName = componentName;
        this.moduleName = moduleName;
        this.componentTechnicalName = this.componentName.replace(/[^A-Za-z_ ]/g, "").replace(/\s+/g, "_").toLowerCase();
        this.componentClassName = this.componentTechnicalName.split("_")
            .map(part =>
                part ? part[0].toUpperCase() + part.slice(1) : ""
            )
            .join("");
        this.templateName = `${this.moduleName}.${this.componentClassName}`;
    }

    public getJsContent(): string {
        return `import { Component, useProps } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";
import { standardFieldProps } from "@web/views/fields/standard_field_props";

/**
 * ${this.componentClassName}: a field widget for Char fields (Odoo 20 / Owl 3).
 * Use it in a view with <field name="..." widget="${this.componentTechnicalName}"/>.
 */
export class ${this.componentClassName} extends Component {
    static template = "${this.templateName}";
    props = useProps({ ...standardFieldProps });

    get value() {
        return this.props.record.data[this.props.name] || "";
    }

    async onChange(ev) {
        await this.props.record.update({ [this.props.name]: ev.target.value });
    }
}

export const ${this.componentTechnicalName.replace(/_([a-z])/g, (_m, c) => c.toUpperCase())}Field = {
    component: ${this.componentClassName},
    displayName: _t("${this.componentName}"),
    supportedTypes: ["char"],
};

registry.category("fields").add("${this.componentTechnicalName}", ${this.componentTechnicalName.replace(/_([a-z])/g, (_m, c) => c.toUpperCase())}Field);
`;
    }

    public getXmlContent(): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
<templates xml:space="preserve">
    <t t-name="${this.templateName}">
        <div class="o_${this.componentTechnicalName}">
            <span t-if="this.props.readonly" t-out="this.value"/>
            <input t-else="" type="text" class="o_input"
                   t-att-id="this.props.id"
                   t-att-value="this.value"
                   t-on-change="(ev) => this.onChange(ev)"/>
        </div>
    </t>
</templates>
`;
    }

    public getCssContent(): string {
        return `.o_${this.componentTechnicalName} {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.o_${this.componentTechnicalName} input {
    padding: 4px 6px;
    border-radius: 4px;
    border: 1px solid var(--border-color, #ccc);
    background-color: var(--bg-color, #fff);
    font-size: 13px;
}

.o_${this.componentTechnicalName} span {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    background-color: var(--bg-muted, #f0f0f0);
    color: var(--text-muted, #555);
    font-size: 13px;
}

.o_${this.componentTechnicalName} input:focus {
    outline: none;
    border-color: #6c5ce7 !important;
    box-shadow: 0 0 3px rgba(108, 92, 231, 0.5);
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
                                name: 'views',
                                doNotExist: false,
                                children: [
                                    {
                                        type: 'folder',
                                        name: 'fields',
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
                                                    },
                                                    {
                                                        type: 'file',
                                                        name: `${this.componentTechnicalName}.xml`,
                                                        content: this.getXmlContent(),
                                                        updateManifest: true,
                                                        manifestCategory: 'asset',
                                                        assetCategory: 'backend'
                                                    },
                                                    {
                                                        type: 'file',
                                                        name: `${this.componentTechnicalName}.scss`,
                                                        content: this.getCssContent(),
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
                ]
            }
        ];
    }
}
