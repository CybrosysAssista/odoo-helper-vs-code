import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Service to handle persistence of various data to workspace storage.
 * Designed to be extendable for different types of cache/index data.
 */
export class PersistenceService {
    private static instance: PersistenceService;
    private context: vscode.ExtensionContext | undefined;

    private constructor() { }

    public static getInstance(): PersistenceService {
        if (!PersistenceService.instance) {
            PersistenceService.instance = new PersistenceService();
        }
        return PersistenceService.instance;
    }

    /**
     * Initializes the service with the extension context.
     * Must be called during extension activation.
     */
    public init(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * Saves data to the persistent storage.
     * @param id Unique identifier for the data (will be used as filename)
     * @param data The data to save (must be JSON serializable)
     */
    public async save<T>(id: string, data: T): Promise<void> {
        if (!this.context?.storageUri) {
            // console.warn(`[PersistenceService] Cannot save ${id}: storageUri not available`);
            return;
        }

        try {
            // Ensure the storage directory exists
            await vscode.workspace.fs.createDirectory(this.context.storageUri);

            const fileUri = vscode.Uri.joinPath(this.context.storageUri, `${id}.json`);
            // Compact: index files run to megabytes, and are parsed again at every startup. Serialised
            // in slices, so a large index never holds up the editor for more than a few milliseconds.
            const content = await serializeYielding(data);

            await vscode.workspace.fs.writeFile(fileUri, content);
            // console.log(`[PersistenceService] Saved data for index: ${id}`);
        } catch (error) {
            console.error(`[PersistenceService] Error saving ${id}:`, error);
        }
    }

    /**
     * Loads data from the persistent storage.
     * @param id Unique identifier for the data
     * @returns The parsed data or undefined if not found or error
     */
    public async load<T>(id: string): Promise<T | undefined> {
        if (!this.context?.storageUri) {
            return undefined;
        }

        const fileUri = vscode.Uri.joinPath(this.context.storageUri, `${id}.json`);

        try {
            const content = await vscode.workspace.fs.readFile(fileUri);
            const text = Buffer.from(content.buffer, content.byteOffset, content.byteLength).toString('utf8');  // no copy
            return JSON.parse(text) as T;
        } catch (error) {
            // Silently fail if file doesn't exist (expected for first run)
            if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
                return undefined;
            }
            console.error(`[PersistenceService] Error loading ${id}:`, error);
            return undefined;
        }
    }

    /**
     * Specialized save for Maps.
     */
    public async saveMap<K, V>(id: string, map: Map<K, V>): Promise<void> {
        const data = Array.from(map.entries());
        await this.save(id, data);
    }

    /**
     * Specialized load for Maps.
     */
    public async loadMap<K, V>(id: string): Promise<Map<K, V> | undefined> {
        const data = await this.load<[K, V][]>(id);
        if (data) {
            return new Map<K, V>(data);
        }
        return undefined;
    }

    /**
     * Specialized save for Sets.
     */
    public async saveSet<T>(id: string, set: Set<T>): Promise<void> {
        const data = Array.from(set);
        await this.save(id, data);
    }

    /**
     * Specialized load for Sets.
     */
    public async loadSet<T>(id: string): Promise<Set<T> | undefined> {
        const data = await this.load<T[]>(id);
        if (data) {
            return new Set<T>(data);
        }
        return undefined;
    }

    /**
     * Clears data for a specific ID.
     */
    public async clear(id: string): Promise<void> {
        if (!this.context?.storageUri) return;

        const fileUri = vscode.Uri.joinPath(this.context.storageUri, `${id}.json`);
        try {
            await vscode.workspace.fs.delete(fileUri, { recursive: false, useTrash: false });
        } catch (error) {
            // Ignore error if file doesn't exist
        }
    }
}

// Export a singleton instance
export const persistenceService = PersistenceService.getInstance();

/** Longest stretch of serialising before giving the editor its turn. */
const SLICE_MS = 8;

/**
 * `JSON.stringify(value)` as UTF-8 bytes, produced in slices with a yield in between. Large
 * arrays (up to two levels deep: `{ fields: [[name, [...]], ...] }`) are split per item; the
 * output is the same as `JSON.stringify`.
 */
async function serializeYielding(value: unknown): Promise<Buffer> {
    const parts: Buffer[] = [];
    let sliceStart = Date.now();
    const pause = async () => {
        if (Date.now() - sliceStart >= SLICE_MS) {
            await new Promise<void>(resolve => setImmediate(resolve));
            sliceStart = Date.now();
        }
    };
    const emit = (text: string) => parts.push(Buffer.from(text, 'utf8'));
    const write = async (item: unknown, depth: number): Promise<void> => {
        if (Array.isArray(item) && depth < 2) {
            emit('[');
            for (let i = 0; i < item.length; i++) {
                if (i) emit(',');
                await write(item[i], depth + 1);
                await pause();
            }
            emit(']');
        } else if (item && typeof item === 'object' && !Array.isArray(item) && depth === 0 && typeof (item as any).toJSON !== 'function') {
            emit('{');
            let first = true;
            for (const [key, child] of Object.entries(item)) {
                if (child === undefined || typeof child === 'function' || typeof child === 'symbol') continue;
                emit((first ? '' : ',') + JSON.stringify(key) + ':');
                first = false;
                await write(child, depth + 1);
            }
            emit('}');
        } else {
            emit(JSON.stringify(item) ?? 'null');
        }
    };
    await write(value, 0);
    return Buffer.concat(parts);
}
