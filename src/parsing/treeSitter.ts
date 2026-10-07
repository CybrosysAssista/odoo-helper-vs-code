import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const TreeSitter = require('web-tree-sitter');

/**
 * Tree-sitter parsers for indexing, free of any `vscode` dependency so they also run in the
 * background indexer process (`src/indexer/worker.ts`).
 *
 * Trees and compiled queries live in WASM memory, which is never garbage collected: every tree is
 * freed after use and each query is compiled once.
 */
export class TreeSitterParser {
    private parser: any;
    private queries = new Map<string, any>();

    private constructor(private readonly language: any) {
        this.parser = new TreeSitter.Parser();
        this.parser.setLanguage(language);
    }

    /** Loads `resources/tree-sitter-<name>.wasm` from the extension folder. */
    static async load(extensionPath: string, name: 'python' | 'javascript'): Promise<TreeSitterParser> {
        await TreeSitter.Parser.init();
        const language = await TreeSitter.Language.load(path.join(extensionPath, 'resources', `tree-sitter-${name}.wasm`));
        return new TreeSitterParser(language);
    }

    /** Parses `text`, runs `fn` on the tree and always frees the tree afterwards. */
    withTree<T>(text: string, fn: (tree: any) => T): T {
        const tree = this.parser.parse(text);
        try {
            return fn(tree);
        } finally {
            tree.delete();
        }
    }

    /** Returns a compiled query, compiling it only once. */
    query(source: string): any {
        let query = this.queries.get(source);
        if (!query) {
            query = new TreeSitter.Query(this.language, source);
            this.queries.set(source, query);
        }
        return query;
    }
}
