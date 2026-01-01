
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

    private fileMetadata: Map<string, { mtime: number, size: number }> = new Map();

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
        if (!config.get<boolean>('indexing.enableCSSIndexing', true)) {
            console.log('[CssClassIndexer] CSS scanning is disabled in settings.');
            this.classesByModule.clear();
            this.cssClasses.clear();
            return;
        }

        console.log('[CssClassIndexer] Refreshing CSS classes (incremental)...');

        let totalFilesIndexed = 0;
        let totalClassesFound = 0;

        // 1. Index Workspace Files
        const cssFiles = await vscode.workspace.findFiles('**/*.{css,scss}', '**/{node_modules,venv,.venv,__pycache__,dist,out,build}/**');

        // 2. Index Odoo Source Path (if configured)
        const odooSourcePath = config.get<string>('odooSourcePath', '');
        const allFiles = [...cssFiles];

        if (odooSourcePath && fs.existsSync(odooSourcePath)) {
            console.log(`[CssClassIndexer] Including Odoo source path: ${odooSourcePath}`);
            const externalFiles = await this.findExternalCssFiles(odooSourcePath);
            allFiles.push(...externalFiles);
        }

        const totalFiles = allFiles.length;
        let processed = 0;

        for (const file of allFiles) {
            processed++;
            if (progress) {
                progress.report({
                    message: `Indexing CSS: ${processed}/${totalFiles} (${path.basename(file.fsPath)})`,
                    increment: (1 / totalFiles) * 100
                });
            }

            const beforeCount = this.getTotalClassCount();
            await this.indexFile(file);
            const afterCount = this.getTotalClassCount();

            totalClassesFound += (afterCount - beforeCount);
            totalFilesIndexed++;

            if (processed % 50 === 0) {
                await new Promise(resolve => setTimeout(resolve, 5));
            }
        }

        await this.cleanupDeletedFiles();

        console.log(`[CssClassIndexer] Scan Complete:`);
        console.log(` - Files indexed: ${totalFilesIndexed}`);
        console.log(` - Total class definitions: ${this.getTotalClassCount()}`);
        console.log(` - Unique class names: ${this.cssClasses.size}`);
        console.log(` - Modules with CSS: ${this.classesByModule.size}`);
    }

    private getTotalClassCount(): number {
        let count = 0;
        for (const defs of this.cssClasses.values()) {
            count += defs.length;
        }
        return count;
    }

    private async findExternalCssFiles(dir: string): Promise<vscode.Uri[]> {
        const results: vscode.Uri[] = [];
        const excluded = ['node_modules', 'venv', '.venv', '__pycache__', 'dist', 'out', 'build'];

        const walk = async (currentDir: string) => {
            try {
                const files = fs.readdirSync(currentDir);
                for (const file of files) {
                    if (excluded.includes(file)) continue;

                    const fullPath = path.join(currentDir, file);
                    const stat = fs.statSync(fullPath);

                    if (stat.isDirectory()) {
                        await walk(fullPath);
                    } else if (file.endsWith('.css') || file.endsWith('.scss')) {
                        results.push(vscode.Uri.file(fullPath));
                    }
                }
            } catch (e) { }
        };

        await walk(dir);
        return results;
    }

    /**
     * Index a single file using VS Code's built-in symbol provider.
     */
    private addIndexEntry(className: string, moduleName: string, filePath: string, line: number, moduleClassSet: Set<string>, enableAdvanced: boolean) {
        moduleClassSet.add(className);

        if (enableAdvanced) {
            const definition: CssClassDefinition = {
                className,
                moduleName,
                filePath,
                lineNumber: line
            };

            if (!this.cssClasses.has(className)) {
                this.cssClasses.set(className, []);
            }
            const existing = this.cssClasses.get(className)!;
            if (!existing.some(d => d.filePath === filePath && d.lineNumber === line)) {
                existing.push(definition);
            }
        } else {
            // Even if advanced is off, we still keep a minimal entry in cssClasses
            // to track which files have which classes (for cleanup)
            if (!this.cssClasses.has(className)) {
                this.cssClasses.set(className, []);
            }
            const existing = this.cssClasses.get(className)!;
            if (!existing.some(d => d.filePath === filePath)) {
                existing.push({ className, moduleName, filePath, lineNumber: line });
            }
        }
    }

    public async indexFile(uri: vscode.Uri): Promise<void> {
        const config = vscode.workspace.getConfiguration('cybrosys-assista-odoo-helper');
        if (!config.get<boolean>('indexing.enableCSSIndexing', true)) return;

        const enableAdvanced = config.get<boolean>('indexing.enableAdvanceCSSIndexing', false);

        try {
            const stats = await vscode.workspace.fs.stat(uri);
            const cachedMetadata = this.fileMetadata.get(uri.fsPath);

            if (cachedMetadata && cachedMetadata.mtime === stats.mtime && cachedMetadata.size === stats.size) {
                return; // Unchanged
            }

            const moduleRoot = await OdooModuleUtils.getModuleRoot(uri);
            if (!moduleRoot) {
                this.removeFileEntries(uri.fsPath);
                return;
            }

            const moduleName = path.basename(moduleRoot.fsPath);
            this.removeFileEntries(uri.fsPath, moduleName);

            let symbols: vscode.DocumentSymbol[] | undefined;
            try {
                symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                    'vscode.executeDocumentSymbolProvider',
                    uri
                );
            } catch (e) {
                // Symbols failed, fallback to regex
            }

            if (!this.classesByModule.has(moduleName)) {
                this.classesByModule.set(moduleName, new Set());
            }
            const moduleClassSet = this.classesByModule.get(moduleName)!;

            if (symbols && symbols.length > 0) {
                const processSymbol = (symbol: vscode.DocumentSymbol) => {
                    // Check for class selectors in CSS/SCSS
                    // Note: symbol.name might contain ".a.b" or ".a .b" or ".a"
                    if (symbol.kind === vscode.SymbolKind.Class || symbol.kind === vscode.SymbolKind.Property) {
                        const classMatches = symbol.name.match(/\.([a-zA-Z0-9_-]+)/g);
                        if (classMatches) {
                            for (const match of classMatches) {
                                const className = match.substring(1);
                                this.addIndexEntry(className, moduleName, uri.fsPath, symbol.range.start.line + 1, moduleClassSet, enableAdvanced);
                            }
                        }
                    }
                    if (symbol.children) {
                        symbol.children.forEach(processSymbol);
                    }
                };
                symbols.forEach(processSymbol);
            } else {
                // Fallback: Regex scan
                const content = await vscode.workspace.fs.readFile(uri);
                const text = Buffer.from(content).toString('utf8');

                // Matches .class-name but not .0-9 (numbers) nor inside strings/comments (mostly)
                // This is a simple but effective scanner for large files
                const classRegex = /\.([a-zA-Z][a-zA-Z0-9_-]*)/g;
                let match;
                while ((match = classRegex.exec(text)) !== null) {
                    const className = match[1];
                    // For fallback we don't have line numbers easily without more parsing
                    this.addIndexEntry(className, moduleName, uri.fsPath, 0, moduleClassSet, enableAdvanced);
                }
            }

            this.fileMetadata.set(uri.fsPath, { mtime: stats.mtime, size: stats.size });

        } catch (err: any) {
            if (err.code === 'FileNotFound' || err.code === 'ENOENT') {
                this.removeFileEntries(uri.fsPath);
                this.fileMetadata.delete(uri.fsPath);
            }
        }
    }

    private removeFileEntries(filePath: string, moduleName?: string) {
        for (const [className, defs] of this.cssClasses.entries()) {
            const filtered = defs.filter(d => d.filePath !== filePath);
            if (filtered.length === 0) {
                this.cssClasses.delete(className);
            } else if (filtered.length < defs.length) {
                this.cssClasses.set(className, filtered);
            }
        }
        if (moduleName && this.classesByModule.has(moduleName)) {
            // Rebuilding module set is expensive, so we just clear and let next refresh fix it
            // or we keep it as is (incremental add only).
            // For now, let's just clear to ensure accuracy if needed.
            this.classesByModule.delete(moduleName);
        }
    }

    private async cleanupDeletedFiles() {
        const toDelete: string[] = [];
        for (const filePath of this.fileMetadata.keys()) {
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
            } catch (e) {
                toDelete.push(filePath);
            }
        }
        for (const filePath of toDelete) {
            this.removeFileEntries(filePath);
            this.fileMetadata.delete(filePath);
        }
    }

    public getClassDefinitions(className: string): CssClassDefinition[] {
        return this.cssClasses.get(className) || [];
    }

    public getClassesInModule(moduleName: string): string[] {
        if (this.classesByModule.has(moduleName)) {
            return Array.from(this.classesByModule.get(moduleName)!);
        }
        return [];
    }

    public getState() {
        return {
            cssClasses: Array.from(this.cssClasses.entries()),
            classesByModule: Array.from(this.classesByModule.entries()).map(([k, v]) => [k, Array.from(v)]),
            metadata: Array.from(this.fileMetadata.entries())
        };
    }

    public loadState(state: any) {
        try {
            if (state && typeof state === 'object') {
                if (Array.isArray(state.cssClasses)) {
                    this.cssClasses = new Map(state.cssClasses);
                }
                if (Array.isArray(state.classesByModule)) {
                    this.classesByModule = new Map(
                        (state.classesByModule as [string, string[]][]).map(([k, v]) => [k, new Set(v)])
                    );
                }
                if (Array.isArray(state.metadata)) {
                    this.fileMetadata = new Map(state.metadata);
                }
            }
        } catch (e) {
            console.error('[CssClassIndexer] Failed to load state:', e);
            this.cssClasses = new Map();
            this.classesByModule = new Map();
            this.fileMetadata = new Map();
        }
    }
}
