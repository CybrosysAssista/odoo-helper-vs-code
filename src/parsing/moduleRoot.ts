import * as fs from 'fs';
import * as path from 'path';

/**
 * Folder -> module root found from it. Only found roots are cached: a folder that is not in a module
 * yet may become one at any moment (a manifest gets created), and checking again is cheap.
 */
const cache = new Map<string, string>();

export function clearModuleRootCache() {
    cache.clear();
}

/**
 * The Odoo module containing `fsPath`: the nearest folder (itself included) holding both a
 * `__manifest__.py` and an `__init__.py`. Folders inside a known module answer from a cache.
 */
export function findModuleRoot(fsPath: string): string | null {
    if (cache.size > 50000) {
        cache.clear();
    }
    const visited: string[] = [];
    let result: string | null = null;
    let current = fsPath;
    while (current) {
        const cached = cache.get(current);
        if (cached) {
            result = cached;
            break;
        }
        visited.push(current);
        if (fs.existsSync(path.join(current, '__manifest__.py')) && fs.existsSync(path.join(current, '__init__.py'))) {
            result = current;
            break;
        }
        const parent = path.dirname(current);
        if (parent === current) {
            break;
        }
        current = parent;
    }
    if (result) {
        for (const folder of visited) {
            cache.set(folder, result);
        }
    }
    return result;
}
