import { TreeSitterParser } from './treeSitter';

export interface ParsedRegistryCall {
    category: string;
    id: string;
    component: string;
    line: number;
}

/**
 * Finds Odoo registry registrations, in every form Odoo uses:
 *   registry.category("fields").add("many2one", many2OneField)
 *   registry.category("fields").add("many2one", { component: Many2OneField, ... })
 *   registry.category("formatters").add("a", fa).add("b", fb)
 *   const fieldRegistry = registry.category("fields");  fieldRegistry.add("x", ...)
 * `line` is the line of the registered id, so navigation lands on the registration itself.
 */
export function findRegistryCalls(parser: TreeSitterParser, text: string): ParsedRegistryCall[] {
    // Only a file mentioning `registry` and `.category(` can register anything: skip the parse otherwise.
    if (!text.includes('registry') || !text.includes('.category(')) {
        return [];
    }
    return parser.withTree(text, tree => {
        const aliases = new Map<string, string>();  // variable name -> category
        const results: ParsedRegistryCall[] = [];
        const stringValue = (node: any) => node && (node.type === 'string' || node.type === 'template_string') ? node.text.slice(1, -1) : undefined;

        // The category of `registry.category("c")`, of an alias of it, or of a chained `.add(...)` on it.
        const categoryOf = (node: any): string | undefined => {
            if (!node) return undefined;
            if (node.type === 'identifier') return aliases.get(node.text);
            if (node.type === 'parenthesized_expression') return categoryOf(node.namedChildren[0]);
            if (node.type !== 'call_expression') return undefined;
            const fn = node.childForFieldName('function');
            if (fn?.type !== 'member_expression') return undefined;
            const method = fn.childForFieldName('property')?.text;
            if (method === 'category') {
                const object = fn.childForFieldName('object');
                const isRegistry = object?.type === 'identifier' ? object.text === 'registry'
                    : object?.type === 'member_expression' && object.childForFieldName('property')?.text === 'registry';
                return isRegistry ? stringValue(node.childForFieldName('arguments')?.namedChildren[0]) : undefined;
            }
            if (method === 'add') return categoryOf(fn.childForFieldName('object'));  // chained .add(...).add(...)
            return undefined;
        };

        const visit = (node: any) => {
            if (node.type === 'variable_declarator') {
                const name = node.childForFieldName('name');
                const category = categoryOf(node.childForFieldName('value'));
                if (name?.type === 'identifier' && category) aliases.set(name.text, category);
            } else if (node.type === 'call_expression') {
                const fn = node.childForFieldName('function');
                if (fn?.type === 'member_expression' && fn.childForFieldName('property')?.text === 'add') {
                    const category = categoryOf(fn.childForFieldName('object'));
                    const [idNode, valueNode] = node.childForFieldName('arguments')?.namedChildren ?? [];
                    const id = stringValue(idNode);
                    if (category && id) {
                        results.push({ category, id, component: componentName(valueNode) ?? id, line: idNode.startPosition.row });
                    }
                }
            }
            for (const child of node.namedChildren) visit(child);
        };
        visit(tree.rootNode);
        return results;
    });
}

/** `Component`, or the `component:` of an object literal (`{ component: Many2OneField, ... }`). */
function componentName(node: any): string | undefined {
    if (!node) return undefined;
    if (node.type === 'identifier' || node.type === 'member_expression') return node.text;
    if (node.type === 'object') {
        for (const pair of node.namedChildren) {
            if (pair.type === 'pair' && pair.childForFieldName('key')?.text === 'component') {
                const value = pair.childForFieldName('value');
                if (value?.type === 'identifier' || value?.type === 'member_expression') return value.text;
            }
        }
    }
    return undefined;
}
