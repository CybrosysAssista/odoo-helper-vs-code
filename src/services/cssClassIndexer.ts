
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { OdooModuleUtils } from '../utils/odooModuleUtils';

export interface CssClassDefinition {
    className: string;
    moduleName: string;
    filePath: string;
    lineNumber: number;
}

export class CssClassIndexer {
    private static instance: CssClassIndexer;

    // Stores detailed definition info (path, line) for features like Go-to-Definition
    private cssClasses: Map<string, CssClassDefinition[]> = new Map();

    // Stores just class names per module for fast completion
    private classesByModule: Map<string, Set<string>> = new Map();

    private constructor() { }

    public static getInstance(): CssClassIndexer {
        if (!CssClassIndexer.instance) {
            CssClassIndexer.instance = new CssClassIndexer();
        }
        return CssClassIndexer.instance;
    }

    /**
     * Index all CSS/SCSS files in the workspace.
     */
    public async indexWorkspace(progress?: vscode.Progress<{ message?: string; increment?: number }>): Promise<void> {
        const config = vscode.workspace.getConfiguration('cybrosys-assista-odoo-helper');
        // Check 'enableCSSIndexing' (default true)
        if (!config.get<boolean>('indexing.enableCSSIndexing', true)) {
            console.log('[CssClassIndexer] CSS scanning is disabled in settings.');
            this.classesByModule.clear();
            this.cssClasses.clear();
            return;
        }

        this.cssClasses.clear();
        this.classesByModule.clear();
        const files = await vscode.workspace.findFiles('**/*.{css,scss}', '**/{node_modules,venv,.venv,__pycache__,dist,out,build}/**');
        const totalFiles = files.length;
        let filesProcessed = 0;

        for (const uri of files) {
            filesProcessed++;
            if (progress) {
                progress.report({
                    message: `Indexing CSS: ${filesProcessed}/${totalFiles} (${path.basename(uri.fsPath)})`,
                    increment: (1 / totalFiles) * 100
                });
            }
            await this.indexFile(uri);

            // Yield occasionally to maintain UI responsiveness
            if (filesProcessed % 20 === 0) {
                await new Promise(resolve => setTimeout(resolve, 5));
            }
        }
    }

    /**
     * Index a single file using VS Code's built-in symbol provider.
     * @param uri URI of the file to index.
     */
    public async indexFile(uri: vscode.Uri): Promise<void> {
        const config = vscode.workspace.getConfiguration('cybrosys-assista-odoo-helper');
        if (!config.get<boolean>('indexing.enableCSSIndexing', true)) {
            return;
        }

        const enableAdvanced = config.get<boolean>('indexing.enableAdvanceCSSIndexing', false);

        const moduleRoot = await OdooModuleUtils.getModuleRoot(uri);
        if (!moduleRoot) {
            return; // Not inside a valid Odoo module
        }

        const moduleName = path.basename(moduleRoot.fsPath);

        let symbols: vscode.DocumentSymbol[] | undefined;
        try {
            // We rely on VS Code's built-in CSS/SCSS language support
            symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                uri
            );
        } catch (e) {
            console.warn(`[CssClassIndexer] Failed to get symbols for ${uri.fsPath}:`, e);
            return;
        }

        if (!symbols) {
            return;
        }

        // Initialize module index if needed
        if (!this.classesByModule.has(moduleName)) {
            this.classesByModule.set(moduleName, new Set());
        }
        const moduleClassSet = this.classesByModule.get(moduleName)!;

        const processSymbol = (symbol: vscode.DocumentSymbol) => {
            // Check if it is a Class
            // Note: CSS symbols for classes usually have SymbolKind.Class
            if (symbol.kind === vscode.SymbolKind.Class) {
                // The symbol name is the selector, e.g., ".btn-primary" or ".btn.btn-primary"
                // We extract parts that look like class names
                const classMatches = symbol.name.match(/\.([a-zA-Z0-9_-]+)/g);
                if (classMatches) {
                    for (const match of classMatches) {
                        const className = match.substring(1); // remove leading '.'

                        // Add to module set (fast completion)
                        moduleClassSet.add(className);

                        // Add to detailed definitions ONLY if advanced indexing is enabled
                        if (enableAdvanced) {
                            const definition: CssClassDefinition = {
                                className: className,
                                moduleName: moduleName,
                                filePath: uri.fsPath,
                                lineNumber: symbol.range.start.line + 1
                            };

                            if (!this.cssClasses.has(className)) {
                                this.cssClasses.set(className, []);
                            }
                            this.cssClasses.get(className)!.push(definition);
                        }
                    }
                }
            }

            if (symbol.children) {
                symbol.children.forEach(processSymbol);
            }
        };

        symbols.forEach(processSymbol);
    }

    /**
     * Get definitions for a specific class name.
     * @param className Class name to find.
     * @returns Array of CssClassDefinition
     */
    public getClassDefinitions(className: string): CssClassDefinition[] {
        return this.cssClasses.get(className) || [];
    }

    /**
     * Get all unique class names found in a specific module.
     * @param moduleName The name of the module.
     * @returns Array of class names.
     */
    public getClassesInModule(moduleName: string): string[] {
        if (this.classesByModule.has(moduleName)) {
            return Array.from(this.classesByModule.get(moduleName)!);
        }
        return [];
    }
}
