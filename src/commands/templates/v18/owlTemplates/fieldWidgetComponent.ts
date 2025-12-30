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
        return `/** @odoo-module **/

import { Component } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { standardFieldProps } from "@web/views/fields/standard_field_props";

export class ${this.componentClassName} extends Component {
    static template = "${this.templateName}";

    static props = {
        ...standardFieldProps,
    };

    onChange(ev) {
        this.props.record.update({
            [this.props.name]: ev.target.value,
        });
    }
    
    get value() {
        return this.props.record.data[this.props.name];
    }
}

registry.category("fields").add("${this.componentTechnicalName}", {
    component: ${this.componentClassName},
    supportedTypes: ["Char"],
});`;
    }

    public getXmlContent(): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
<templates xml:space="preserve">
    <t t-name="${this.templateName}" owl="1">
        <div class="o_${this.componentTechnicalName}">
            <t t-if="!props.readonly">
                <input type="text"
                       t-att-value="value || ''"
                       t-on-input="onChange" />
            </t>

            <t t-if="props.readonly">
                <span t-esc="props.value"/>
            </t>
        </div>
    </t>
</templates>`;
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
                                                        assetCategory: 'backend'
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
