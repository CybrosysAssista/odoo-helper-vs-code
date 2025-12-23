import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getJavaScriptParserService } from './javascriptParserService';
import { OdooModuleUtils } from '../utils/odooModuleUtils';

export interface RegistryEntry {
    category: string;
    id: string;
    component: string;
    moduleName: string;
    filePath: string;
    line: number;
}

/**
 * Service to index Odoo JavaScript registry registrations
 */
export class OdooRegistryIndexer {
    private registryEntries: RegistryEntry[] = [];
    private isScanning: boolean = false;

    /**
     * Start initial background scan of the workspace
     */
    async scanWorkspace(): Promise<void> {
        if (this.isScanning) return;
        this.isScanning = true;
        this.registryEntries = [];

        console.log('[OdooRegistryIndexer] Starting workspace scan...');

        try {
            const jsFiles = await vscode.workspace.findFiles('**/*.js', '**/node_modules/**');

            for (const file of jsFiles) {
                await this.indexFile(file);
            }

            console.log(`[OdooRegistryIndexer] Scan complete. Indexed ${this.registryEntries.length} registry entries.`);
        } catch (error) {
            console.error('[OdooRegistryIndexer] Scan failed:', error);
        } finally {
            this.isScanning = false;
        }
    }

    /**
     * Index a single JavaScript file
     */
    async indexFile(uri: vscode.Uri): Promise<void> {
        // 1. Check if it's inside a valid Odoo module
        const moduleRoot = await OdooModuleUtils.getModuleRoot(uri);
        if (!moduleRoot) return;

        const moduleName = path.basename(moduleRoot.fsPath);

        try {
            const content = fs.readFileSync(uri.fsPath, 'utf8');
            const jsParser = getJavaScriptParserService();

            if (!jsParser.isInitialized()) return;

            // 2. Extract registry calls using Tree-sitter
            const calls = jsParser.findRegistryCalls(content);

            // 3. Remove existing entries for this file
            this.removeFile(uri);

            // 4. Add new entries
            for (const call of calls) {
                this.registryEntries.push({
                    ...call,
                    moduleName,
                    filePath: uri.fsPath
                });
            }
        } catch (error) {
            console.warn(`[OdooRegistryIndexer] Failed to index ${uri.fsPath}:`, error);
        }
    }

    /**
     * Remove entries for a specific file
     */
    removeFile(uri: vscode.Uri): void {
        this.registryEntries = this.registryEntries.filter(e => e.filePath !== uri.fsPath);
    }

    /**
     * Get all registry entries for a specific category
     */
    getEntriesByCategory(category: string): RegistryEntry[] {
        return this.registryEntries.filter(e => e.category === category);
    }

    /**
     * Find a specific registry entry by ID
     */
    getEntryById(id: string): RegistryEntry | undefined {
        return this.registryEntries.find(e => e.id === id);
    }

    /**
     * Get all indexed entries
     */
    getAllEntries(): RegistryEntry[] {
        return this.registryEntries;
    }

    /**
     * Clear the index
     */
    clear(): void {
        this.registryEntries = [];
    }
}

// Singleton instance
let indexerInstance: OdooRegistryIndexer | null = null;

export function getOdooRegistryIndexer(): OdooRegistryIndexer {
    if (!indexerInstance) {
        indexerInstance = new OdooRegistryIndexer();
    }
    return indexerInstance;
}
