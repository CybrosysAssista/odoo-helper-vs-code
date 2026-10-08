import { FileSystemNode } from "../../../../utils/utils";


export class commonComponent {
    private componentName: string;
    private moduleName: string;
    private componentTechnicalName: string;
    private componentClassName: string;
    private templateName: string;

    constructor(componentName: string, moduleName: string) {
        this.componentName = componentName
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
        const jsContent = `
/** @odoo-module **/

import { Component, useState, useRef, onWillStart, onMounted, onWillUpdateProps } from "@odoo/owl";

export class ${this.componentClassName} extends Component {
    static template = "${this.templateName}";

    setup() {
        // reactive state
        this.state = useState({
            count: 0,
            loading: true,
            message: "",
        });

        // DOM refs (defined with t-ref in template)
        this.containerRef = useRef("containerRef");
        this.inputRef = useRef("inputRef");

        // lifecycle: before start (useful for async data)
        onWillStart(async () => {
            // example async work (RPC or fetch)
            await new Promise((r) => setTimeout(r, 200));
            this.state.loading = false;
        });

        // lifecycle: after mounting in DOM
        onMounted(() => {
            const el = this.containerRef.el;
            if (el) {
                
                el.setAttribute("data-widget", "${this.componentClassName}");
            }
            if (this.inputRef.el) {
                    this.inputRef.el.focus();
            }
        });

        // lifecycle: when props will update
        onWillUpdateProps((nextProps) => {
            // react to prop changes if needed
                console.log("next props", nextProps);
        });
    }

    increment() {
        this.state.count++;
    }

    onInput(ev) {
        this.state.message = ev.target.value;
    }

    reset() {
        this.state.count = 0;
        this.state.message = "";
    }
}
        `
        return jsContent;
    }

    private getXmlContent(): string {
        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<templates xml:space="preserve">
    <t t-name="${this.templateName}" owl="1">
        <div class="o_${this.componentTechnicalName}_widget" t-ref="containerRef">
            <t t-if="state.loading">
                <div class="o-widget-loading">Loading...</div>
            </t>

            <t t-if="!state.loading">
                <h4 t-esc="${this.componentClassName}"/>
                <div class="o-widget-body">
                    <p>Count: <t t-esc="state.count"/></p>

                    <div>
                        <button class="btn btn-sm btn-primary" t-on-click="increment">Increment</button>
                        <button class="btn btn-sm btn-secondary" t-on-click="reset">Reset</button>
                    </div>

                    <div class="mt-2">
                        <input t-ref="inputRef"
                                type="text"
                                t-att-value="state.message"
                                t-on-input="(ev) => this.onInput(ev)"
                                placeholder="Type message..." />
                    </div>

                    <p class="mt-2">Message: <t t-esc="state.message"/></p>
                </div>
            </t>
        </div>
    </t>
</templates>
        `
        return xmlContent;
    }

    private getCssContent(): string {
        const cssContent = `
.o_${this.componentTechnicalName}_widget {
    padding: 12px;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 6px;
    background: var(--bg, #ffffff);
    display: inline-block;
    max-width: 420px;
}

.o_${this.componentTechnicalName}_widget .o-widget-loading {
    padding: 10px;
    color: var(--text-muted, #666);
}

.o_${this.componentTechnicalName}_widget .o-widget-body p {
    margin: 6px 0;
}

.o_${this.componentTechnicalName}_widget input[type="text"] {
    width: 100%;
    padding: 6px 8px;
    border-radius: 4px;
    border: 1px solid var(--border-color, #ccc);
}
        `
        return cssContent;
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
                                name: 'components',
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
                                                name: `${this.componentTechnicalName}.css`,
                                                content: this.getCssContent(),
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


