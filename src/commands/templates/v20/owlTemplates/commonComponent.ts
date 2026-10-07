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
        return `import { Component, onMounted, onWillStart, proxy, signal, t, useProps } from "@odoo/owl";

/**
 * ${this.componentClassName}: a reusable OWL component (Odoo 20 / Owl 3).
 * Use it in another component's template as <${this.componentClassName} title="'...'"/>
 * after adding it to that component's \`static components\`.
 */
export class ${this.componentClassName} extends Component {
    static template = "${this.templateName}";

    // Props are declared with Owl 3 types; defaults go in .optional(default).
    props = useProps({
        title: t.string().optional("${this.componentName}"),
    });

    // Reactive state (Owl 3: proxy replaces useState).
    state = proxy({
        count: 0,
        loading: true,
        message: "",
    });

    // Element refs (Owl 3: signal.ref() replaces useRef); bound with t-ref="this.inputRef".
    inputRef = signal.ref();

    setup() {
        onWillStart(async () => {
            // Load data here, e.g. with useService("orm").
            this.state.loading = false;
        });
        onMounted(() => {
            this.inputRef()?.focus();
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
`;
    }

    public getXmlContent(): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
<templates xml:space="preserve">
    <t t-name="${this.templateName}">
        <div class="o_${this.componentTechnicalName}_widget">
            <div t-if="this.state.loading" class="o-widget-loading">Loading...</div>
            <t t-else="">
                <h4 t-out="this.props.title"/>
                <div class="o-widget-body">
                    <p>Count: <t t-out="this.state.count"/></p>
                    <div>
                        <button class="btn btn-sm btn-primary" t-on-click="() => this.increment()">Increment</button>
                        <button class="btn btn-sm btn-secondary ms-1" t-on-click="() => this.reset()">Reset</button>
                    </div>
                    <div class="mt-2">
                        <input t-ref="this.inputRef" type="text" class="form-control"
                               t-att-value="this.state.message"
                               t-on-input="(ev) => this.onInput(ev)"
                               placeholder="Type message..."/>
                    </div>
                    <p class="mt-2">Message: <t t-out="this.state.message"/></p>
                </div>
            </t>
        </div>
    </t>
</templates>
`;
    }

    public getCssContent(): string {
        const cssContent = `.o_${this.componentTechnicalName}_widget {
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
    }`;
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
                                                name: `${this.componentTechnicalName}.css`,
                                                content: this.getCssContent(),
                                                updateManifest: true,
                                                manifestCategory: 'asset',
                                                assetCategory: 'backend',
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


