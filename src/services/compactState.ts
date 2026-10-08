/**
 * Compact saved form of the per-model field and method lists. Each file path is stored once in a
 * `files` table and entries refer to it by number, and `modelName`, which is the entry's key, is
 * not repeated: about half the size, so about half the time to parse at startup.
 */
interface Located {
    filePath: string;
    modelName: string;
}

export interface PackedEntries {
    files: string[];
    rows: [string, Record<string, unknown>[]][];
}

export function packEntries<T extends Located>(entries: Iterable<[string, T[]]>): PackedEntries {
    const files: string[] = [];
    const fileIds = new Map<string, number>();
    const rows: PackedEntries['rows'] = [];
    for (const [modelName, list] of entries) {
        rows.push([modelName, list.map(({ filePath, modelName: _model, ...rest }) => {
            let id = fileIds.get(filePath);
            if (id === undefined) {
                id = files.push(filePath) - 1;
                fileIds.set(filePath, id);
            }
            return { ...rest, f: id };
        })]);
    }
    return { files, rows };
}

export function unpackEntries<T extends Located>(files: string[], rows: PackedEntries['rows']): [string, T[]][] {
    return rows.map(([modelName, list]) => [modelName, list.map(({ f, ...rest }) =>
        ({ ...rest, modelName, filePath: files[f as number] }) as unknown as T)]);
}
