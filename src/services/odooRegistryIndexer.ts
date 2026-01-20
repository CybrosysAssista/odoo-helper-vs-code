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
    private fileMetadata: Map<string, { mtime: number, size: number }> = new Map();
    private isScanning: boolean = false;

    /**
     * Start initial background scan of the workspace
     */
    async scanWorkspace(progress?: vscode.Progress<{ message?: string; increment?: number }>): Promise<void> {
        if (this.isScanning) return;
        this.isScanning = true;

        // console.log('[OdooRegistryIndexer] Refreshing workspace (incremental)...');

        try {
            // Updated exclusion patterns to avoid indexing venv and other huge/irrelevant folders
            const jsFiles = await vscode.workspace.findFiles('**/*.js', '**/{node_modules,venv,.venv,__pycache__,dist,out,build}/**');
            const totalFiles = jsFiles.length;
            let filesProcessed = 0;

            for (const file of jsFiles) {
                filesProcessed++;
                if (progress) {
                    progress.report({
                        message: `Indexing Registry: ${filesProcessed}/${totalFiles} (${path.basename(file.fsPath)})`,
                        increment: (1 / totalFiles) * 100
                    });
                }
                await this.indexFile(file);

                // Prevent blocking the event loop too long during huge scans
                if (filesProcessed % 20 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }

            await this.cleanupDeletedFiles();

            // console.log(`[OdooRegistryIndexer] Scan complete. Indexed ${this.registryEntries.length} registry entries.`);
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

        try {
            const stats = await vscode.workspace.fs.stat(uri);
            const cachedMetadata = this.fileMetadata.get(uri.fsPath);

            if (cachedMetadata && cachedMetadata.mtime === stats.mtime && cachedMetadata.size === stats.size) {
                return;
            }

            const moduleName = path.basename(moduleRoot.fsPath);
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

            // Update metadata
            this.fileMetadata.set(uri.fsPath, { mtime: stats.mtime, size: stats.size });
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

    getState() {
        return {
            entries: this.registryEntries,
            metadata: Array.from(this.fileMetadata.entries())
        };
    }

    loadState(state: any) {
        try {
            if (Array.isArray(state)) {
                // Old format: direct array
                this.registryEntries = state;
            } else if (state && typeof state === 'object') {
                // New format: { entries: [], metadata: [] }
                if (Array.isArray(state.entries)) {
                    this.registryEntries = state.entries;
                }
                if (Array.isArray(state.metadata)) {
                    this.fileMetadata = new Map(state.metadata);
                }
            }
        } catch (e) {
            console.error('[OdooRegistryIndexer] Failed to load state:', e);
            this.registryEntries = [];
            this.fileMetadata = new Map();
        }
    }

    async cleanupDeletedFiles() {
        for (const filePath of this.fileMetadata.keys()) {
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
            } catch (e) {
                this.registryEntries = this.registryEntries.filter(e => e.filePath !== filePath);
                this.fileMetadata.delete(filePath);
            }
        }
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
