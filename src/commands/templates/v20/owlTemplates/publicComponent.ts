import { FileSystemNode } from "../../../../utils/utils";

export class publicComponent {
    private componentName: string;
    private moduleName: string;
    private componentTechnicalName: string;
    private componentClassName: string;
    private templateName: string;
    private childClassName: string;
    private childTemplateName: string;

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
        this.childClassName = `${this.componentClassName}Display`;
        this.childTemplateName = `${this.moduleName}.${this.childClassName}`;
    }

    public getJsContent(): string {
        return `import { Component, onWillStart, proxy, t, useProps } from "@odoo/owl";
import { registry } from "@web/core/registry";

/**
 * ${this.childClassName}: shows one labelled value.
 */
export class ${this.childClassName} extends Component {
    static template = "${this.childTemplateName}";
    props = useProps({
        value: t.or([t.string(), t.number()]).optional(""),
        label: t.string().optional(""),
    });
}

/**
 * ${this.componentClassName}: an OWL component for website/portal pages (Odoo 20 / Owl 3).
 * Place it in a QWeb page or template with:
 *     <owl-component name="${this.moduleName}.${this.componentClassName}" t-att-props="json.dumps({'title': 'Hello'})"/>
 */
export class ${this.componentClassName} extends Component {
    static template = "${this.templateName}";
    static components = { ${this.childClassName} };

    props = useProps({
        initialValue: t.number().optional(0),
        title: t.string().optional("${this.componentName}"),
        showControls: t.boolean().optional(true),
    });

    state = proxy({
        count: 0,
        loading: true,
        message: "",
    });

    setup() {
        this.state.count = this.props.initialValue;
        onWillStart(async () => {
            // Load data here, e.g. with rpc() from "@web/core/network/rpc".
            this.state.loading = false;
        });
    }

    increment() {
        this.state.count++;
    }

    decrement() {
        this.state.count--;
    }

    onInput(ev) {
        this.state.message = ev.target.value;
    }

    reset() {
        this.state.count = this.props.initialValue;
        this.state.message = "";
    }
}

registry.category("public_components").add("${this.moduleName}.${this.componentClassName}", ${this.componentClassName});
`;
    }

    public getXmlContent(): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
<templates xml:space="preserve">
    <t t-name="${this.childTemplateName}">
        <div class="o_${this.componentTechnicalName}_display">
            <h5 t-if="this.props.label" t-out="this.props.label"/>
            <div class="display-value" t-out="this.props.value"/>
        </div>
    </t>

    <t t-name="${this.templateName}">
        <div class="o_${this.componentTechnicalName} card p-3">
            <h4 t-out="this.props.title"/>
            <div t-if="this.state.loading" class="text-muted">Loading...</div>
            <t t-else="">
                <${this.childClassName} label="'Count'" value="this.state.count"/>
                <div t-if="this.props.showControls" class="d-flex gap-2 my-2">
                    <button class="btn btn-sm btn-secondary" t-on-click="() => this.decrement()">-</button>
                    <button class="btn btn-sm btn-primary" t-on-click="() => this.increment()">+</button>
                    <button class="btn btn-sm btn-light" t-on-click="() => this.reset()">Reset</button>
                </div>
                <input type="text" class="form-control" placeholder="Type a message..."
                       t-att-value="this.state.message" t-on-input="(ev) => this.onInput(ev)"/>
                <${this.childClassName} t-if="this.state.message" label="'Message'" value="this.state.message"/>
            </t>
        </div>
    </t>
</templates>
`;
    }

    public getCssContent(): string {
        return `.o_${this.componentTechnicalName} {
    max-width: 480px;

    .o_${this.componentTechnicalName}_display .display-value {
        font-size: 1.5rem;
        font-weight: 600;
    }
}
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
                                                assetCategory: 'frontend',
                                                depends: ['base']
                                            },
                                            {
                                                type: 'file',
                                                name: `${this.componentTechnicalName}.xml`,
                                                content: this.getXmlContent(),
                                                updateManifest: true,
                                                manifestCategory: 'asset',
                                                assetCategory: 'frontend'
                                            },
                                            {
                                                type: 'file',
                                                name: `${this.componentTechnicalName}.scss`,
                                                content: this.getCssContent(),
                                                updateManifest: true,
                                                manifestCategory: 'asset',
                                                assetCategory: 'frontend'
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
