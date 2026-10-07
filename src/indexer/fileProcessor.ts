import * as fs from 'fs';
import * as path from 'path';
import { TreeSitterParser } from '../parsing/treeSitter';
import { parsePythonFile } from '../parsing/python';
import { findRegistryCalls } from '../parsing/javascript';
import { extractCssClasses } from '../parsing/css';
import { extractXmlEntries } from '../parsing/xml';
import { clearModuleRootCache, findModuleRoot } from '../parsing/moduleRoot';
import type { FileMetadata, FileRequest, FileResult } from './protocol';

const MANIFEST_QUERY = `
    (dictionary
        (pair
            key: (string) @key
            value: (list) @value
        )
    )
`;

/**
 * Stats, reads and parses files for the indexes. Free of any `vscode` dependency: it runs in the
 * background indexer process, and in the extension host only as a fallback.
 */
export class FileProcessor {
    private constructor(private readonly python: TreeSitterParser, private readonly javascript: TreeSitterParser) { }

    static async create(extensionPath: string): Promise<FileProcessor> {
        const [python, javascript] = await Promise.all([
            TreeSitterParser.load(extensionPath, 'python'),
            TreeSitterParser.load(extensionPath, 'javascript'),
        ]);
        return new FileProcessor(python, javascript);
    }

    /**
     * Processes `items` in order. `between` runs after each file; the in-process fallback uses it to
     * yield to the event loop.
     */
    async process(items: FileRequest[], between?: () => Promise<void>): Promise<FileResult[]> {
        // Modules may have been created or removed since the last batch.
        clearModuleRootCache();
        const results: FileResult[] = [];
        for (const item of items) {
            results.push(await this.processFile(item));
            if (between) {
                await between();
            }
        }
        return results;
    }

    private async processFile(item: FileRequest): Promise<FileResult> {
        let meta: FileMetadata;
        try {
            const stats = await fs.promises.stat(item.path);
            meta = { mtime: Math.trunc(stats.mtimeMs), size: stats.size };
        } catch {
            return { path: item.path, status: 'missing' };
        }
        if (item.meta && item.meta.mtime === meta.mtime && item.meta.size === meta.size) {
            return { path: item.path, status: 'unchanged' };
        }
        try {
            const moduleRoot = findModuleRoot(item.kind === 'manifest' ? path.dirname(item.path) : item.path) ?? undefined;
            const module = moduleRoot ? path.basename(moduleRoot) : undefined;
            const result: FileResult = { path: item.path, status: 'parsed', meta, module, moduleRoot };
            // Files outside a module are only recorded, so they are not looked at again.
            if (!moduleRoot) {
                return result;
            }
            const text = await fs.promises.readFile(item.path, 'utf8');
            switch (item.kind) {
                case 'manifest': result.manifest = { depends: this.manifestList(text, 'depends') }; break;
                case 'python': result.python = parsePythonFile(this.python, text); break;
                case 'javascript': result.registry = findRegistryCalls(this.javascript, text); break;
                case 'css': result.css = extractCssClasses(text); break;
                case 'xml': result.xml = extractXmlEntries(text, module!); break;
            }
            return result;
        } catch (error) {
            return { path: item.path, status: 'error', message: String(error) };
        }
    }

    /** String items of the list under `key` in a manifest dictionary. */
    private manifestList(text: string, key: string): string[] {
        return this.python.withTree(text, tree => {
            for (const match of this.python.query(MANIFEST_QUERY).matches(tree.rootNode)) {
                const keyNode = match.captures.find((c: any) => c.name === 'key')?.node;
                const valueNode = match.captures.find((c: any) => c.name === 'value')?.node;
                if (keyNode && valueNode && keyNode.text.slice(1, -1) === key) {
                    return valueNode.namedChildren.filter((c: any) => c.type === 'string').map((c: any) => c.text.slice(1, -1));
                }
            }
            return [];
        });
    }
}
