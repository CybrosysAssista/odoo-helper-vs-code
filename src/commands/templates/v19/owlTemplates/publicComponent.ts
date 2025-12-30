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
        return `/** @odoo-module **/

import { Component, useState, useRef, onWillStart, onMounted, onWillUnmount, onWillUpdateProps } from "@odoo/owl";
import { registry } from "@web/core/registry";

/**
 * ${this.childClassName}
 * Child component for displaying data
 */
export class ${this.childClassName} extends Component {
    static template = "${this.childTemplateName}";
    
    static props = {
        value: { type: [String, Number], optional: true },
        label: { type: String, optional: true },
    };
}

/**
 * ${this.componentClassName}
 * Main public component
 */
export class ${this.componentClassName} extends Component {
    static template = "${this.templateName}";
    static components = { ${this.childClassName} };
    
    static props = {
        initialValue: { type: Number, optional: true },
        title: { type: String, optional: true },
        showControls: { type: Boolean, optional: true },
    };

    setup() {
        // Reactive state
        this.state = useState({
            count: this.props.initialValue || 0,
            loading: true,
            message: "",
            isActive: false,
        });

        // DOM refs (defined with t-ref in template)
        this.containerRef = useRef("containerRef");
        this.inputRef = useRef("inputRef");

        // Lifecycle: before start (useful for async data)
        onWillStart(async () => {
            // Example async work (RPC or fetch)
            await new Promise((r) => setTimeout(r, 200));
            this.state.loading = false;
        });

        // Lifecycle: after mounting in DOM
        onMounted(() => {
            const el = this.containerRef.el;
            if (el) {
                el.setAttribute("data-component", "${this.componentClassName}");
            }
            if (this.inputRef.el) {
                this.inputRef.el.focus();
            }
        });

        // Lifecycle: cleanup before unmount
        onWillUnmount(() => {
            // Cleanup timers, listeners, etc.
            console.log("Component unmounting");
        });

        // Lifecycle: when props will update
        onWillUpdateProps((nextProps) => {
            // React to prop changes if needed
            if (nextProps.initialValue !== this.props.initialValue) {
                this.state.count = nextProps.initialValue || 0;
            }
        });
    }

    // Methods
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
        this.state.count = this.props.initialValue || 0;
        this.state.message = "";
    }

    toggleActive() {
        this.state.isActive = !this.state.isActive;
    }
}

// Register the component in the public_components registry
registry.category("public_components").add('${this.componentTechnicalName}', ${this.componentClassName});`;
    }

    public getXmlContent(): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
<templates xml:space="preserve">

    <!-- ${this.childClassName} Template -->
    <t t-name="${this.childTemplateName}">
        <div class="o_${this.componentTechnicalName}_display">
            <h5 t-if="props.label" t-esc="props.label"/>
            <div class="display-value">
                <span t-esc="props.value || 0"/>
            </div>
        </div>
    </t>

    <!-- ${this.componentClassName} Template -->
    <t t-name="${this.templateName}">
        <div class="o_${this.componentTechnicalName}_component" t-ref="containerRef"
             t-att-class="{ 'is-active': state.isActive }">
            
            <!-- Loading State -->
            <t t-if="state.loading">
                <div class="o-component-loading">
                    <i class="fa fa-spinner fa-spin"/> Loading...
                </div>
            </t>

            <!-- Main Content -->
            <t t-if="!state.loading">
                <!-- Header -->
                <div class="o-component-header">
                    <h4 t-esc="props.title || '${this.componentClassName}'"/>
                </div>

                <!-- Body -->
                <div class="o-component-body">
                    <!-- Child Component -->
                    <${this.childClassName} 
                        value="state.count" 
                        label="'Current Count'"/>

                    <!-- Controls -->
                    <t t-if="props.showControls !== false">
                        <div class="o-component-controls">
                            <button class="btn btn-sm btn-success" 
                                    t-on-click="increment">
                                <i class="fa fa-plus"/> Increment
                            </button>
                            <button class="btn btn-sm btn-danger" 
                                    t-on-click="decrement">
                                <i class="fa fa-minus"/> Decrement
                            </button>
                            <button class="btn btn-sm btn-secondary" 
                                    t-on-click="reset">
                                <i class="fa fa-refresh"/> Reset
                            </button>
                        </div>
                    </t>

                    <!-- Input Field -->
                    <div class="o-component-input mt-3">
                        <input t-ref="inputRef"
                               type="text"
                               class="form-control"
                               t-att-value="state.message"
                               t-on-input="onInput"
                               placeholder="Type message..." />
                    </div>

                    <!-- Message Display -->
                    <div class="o-component-message mt-2" t-if="state.message">
                        <strong>Message:</strong> <t t-esc="state.message"/>
                    </div>

                    <!-- Toggle Button -->
                    <div class="mt-3">
                        <button class="btn btn-sm btn-info" 
                                t-on-click="toggleActive">
                            <t t-if="state.isActive">Deactivate</t>
                            <t t-else="">Activate</t>
                        </button>
                    </div>
                </div>
            </t>
        </div>
    </t>

</templates>`;
    }

    public getCssContent(): string {
        return `/* ${this.componentClassName} Styles - Glassmorphic Design */

.o_${this.componentTechnicalName}_component {
    padding: 2rem;
    background: rgba(255, 255, 255, 0.25);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 
        0 8px 32px 0 rgba(31, 38, 135, 0.15),
        inset 0 0 0 1px rgba(255, 255, 255, 0.1);
    max-width: 500px;
    margin: 2rem auto;
    position: relative;
    overflow: hidden;
    transition: all 0.3s ease;
}

.o_${this.componentTechnicalName}_component.is-active {
    border-color: rgba(102, 126, 234, 0.5);
    box-shadow: 
        0 8px 32px 0 rgba(102, 126, 234, 0.3),
        inset 0 0 0 1px rgba(255, 255, 255, 0.2);
}

/* Gradient overlay */
.o_${this.componentTechnicalName}_component::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, 
        rgba(255, 255, 255, 0.1) 0%, 
        rgba(255, 255, 255, 0.05) 100%);
    pointer-events: none;
    border-radius: 16px;
}

/* Loading State */
.o_${this.componentTechnicalName}_component .o-component-loading {
    padding: 2rem;
    text-align: center;
    color: #667eea;
    font-size: 1.1rem;
    position: relative;
    z-index: 1;
}

/* Header */
.o_${this.componentTechnicalName}_component .o-component-header {
    margin-bottom: 1.5rem;
    position: relative;
    z-index: 1;
}

.o_${this.componentTechnicalName}_component .o-component-header h4 {
    color: #2c3e50;
    font-weight: 600;
    margin: 0;
    text-shadow: 0 2px 4px rgba(255, 255, 255, 0.5);
}

/* Body */
.o_${this.componentTechnicalName}_component .o-component-body {
    position: relative;
    z-index: 1;
}

/* Display Component */
.o_${this.componentTechnicalName}_display {
    margin: 1.5rem 0;
    padding: 1.5rem;
    background: rgba(102, 126, 234, 0.15);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-radius: 12px;
    border: 1px solid rgba(102, 126, 234, 0.3);
    box-shadow: 
        0 4px 16px rgba(102, 126, 234, 0.2),
        inset 0 0 0 1px rgba(255, 255, 255, 0.2);
    text-align: center;
}

.o_${this.componentTechnicalName}_display h5 {
    font-size: 0.85rem;
    color: #667eea;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 0.75rem;
}

.o_${this.componentTechnicalName}_display .display-value {
    font-size: 2.5rem;
    font-weight: 700;
    font-family: 'Courier New', monospace;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    filter: drop-shadow(0 2px 4px rgba(102, 126, 234, 0.3));
}

/* Controls */
.o_${this.componentTechnicalName}_component .o-component-controls {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    flex-wrap: wrap;
    margin-top: 1rem;
}

.o_${this.componentTechnicalName}_component .btn {
    padding: 0.5rem 1rem;
    font-weight: 500;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
}

.o_${this.componentTechnicalName}_component .btn-success {
    background: rgba(40, 167, 69, 0.2);
    border-color: rgba(40, 167, 69, 0.4);
    color: #1e7e34;
}

.o_${this.componentTechnicalName}_component .btn-success:hover {
    background: rgba(40, 167, 69, 0.3);
    border-color: rgba(40, 167, 69, 0.6);
}

.o_${this.componentTechnicalName}_component .btn-danger {
    background: rgba(220, 53, 69, 0.2);
    border-color: rgba(220, 53, 69, 0.4);
    color: #bd2130;
}

.o_${this.componentTechnicalName}_component .btn-danger:hover {
    background: rgba(220, 53, 69, 0.3);
    border-color: rgba(220, 53, 69, 0.6);
}

.o_${this.componentTechnicalName}_component .btn-secondary {
    background: rgba(108, 117, 125, 0.2);
    border-color: rgba(108, 117, 125, 0.4);
    color: #545b62;
}

.o_${this.componentTechnicalName}_component .btn-secondary:hover {
    background: rgba(108, 117, 125, 0.3);
    border-color: rgba(108, 117, 125, 0.6);
}

.o_${this.componentTechnicalName}_component .btn-info {
    background: rgba(23, 162, 184, 0.2);
    border-color: rgba(23, 162, 184, 0.4);
    color: #117a8b;
}

.o_${this.componentTechnicalName}_component .btn-info:hover {
    background: rgba(23, 162, 184, 0.3);
    border-color: rgba(23, 162, 184, 0.6);
}

.o_${this.componentTechnicalName}_component .btn:hover {
    transform: translateY(-2px);
    box-shadow: 
        0 6px 20px rgba(0, 0, 0, 0.15),
        inset 0 0 0 1px rgba(255, 255, 255, 0.3);
}

/* Input Field */
.o_${this.componentTechnicalName}_component .o-component-input input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    border: 1px solid rgba(102, 126, 234, 0.3);
    background: rgba(255, 255, 255, 0.5);
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
    transition: all 0.3s ease;
}

.o_${this.componentTechnicalName}_component .o-component-input input:focus {
    outline: none;
    border-color: rgba(102, 126, 234, 0.6);
    background: rgba(255, 255, 255, 0.7);
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

/* Message Display */
.o_${this.componentTechnicalName}_component .o-component-message {
    padding: 0.75rem;
    background: rgba(102, 126, 234, 0.1);
    border-radius: 8px;
    border: 1px solid rgba(102, 126, 234, 0.2);
    color: #2c3e50;
}

/* Responsive */
@media (max-width: 768px) {
    .o_${this.componentTechnicalName}_component {
        padding: 1.5rem;
        margin: 1rem;
    }
    
    .o_${this.componentTechnicalName}_display .display-value {
        font-size: 2rem;
    }
    
    .o_${this.componentTechnicalName}_component .o-component-controls {
        flex-direction: column;
    }
    
    .o_${this.componentTechnicalName}_component .btn {
        width: 100%;
    }
}

@media (max-width: 480px) {
    .o_${this.componentTechnicalName}_component {
        padding: 1rem;
    }
    
    .o_${this.componentTechnicalName}_display {
        padding: 1rem;
    }
    
    .o_${this.componentTechnicalName}_display .display-value {
        font-size: 1.75rem;
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
        ];
    }
}
