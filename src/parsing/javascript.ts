import { TreeSitterParser } from './treeSitter';

export interface ParsedRegistryCall {
    category: string;
    id: string;
    component: string;
    line: number;
}

// registry.category("category").add("id", Component)
const REGISTRY_QUERY = `
    (call_expression
        function: (member_expression
            object: (call_expression
                function: (member_expression
                    object: (identifier) @registry
                    property: (property_identifier) @category_method)
                arguments: (arguments (string) @category_name))
            property: (property_identifier) @add_method)
        arguments: (arguments
            (string) @id
            (identifier) @component))
    (#eq? @registry "registry")
    (#eq? @category_method "category")
    (#eq? @add_method "add")
`;

/** Finds Odoo registry registrations: `registry.category("...").add("...", Component)`. */
export function findRegistryCalls(parser: TreeSitterParser, text: string): ParsedRegistryCall[] {
    // Only a file mentioning `registry` and `.category(` can register anything: skip the parse otherwise.
    if (!text.includes('registry') || !text.includes('.category(')) {
        return [];
    }
    return parser.withTree(text, tree => {
        const results: ParsedRegistryCall[] = [];
        let current: Partial<ParsedRegistryCall> = {};
        for (const capture of parser.query(REGISTRY_QUERY).captures(tree.rootNode)) {
            if (capture.name === 'category_name') {
                current.category = capture.node.text.slice(1, -1);
                current.line = capture.node.startPosition.row;
            } else if (capture.name === 'id') {
                current.id = capture.node.text.slice(1, -1);
            } else if (capture.name === 'component') {
                current.component = capture.node.text;
            }
            if (current.category && current.id && current.component && current.line !== undefined) {
                results.push(current as ParsedRegistryCall);
                current = {};
            }
        }
        return results;
    });
}
