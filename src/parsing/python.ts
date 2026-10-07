import { TreeSitterParser } from './treeSitter';

/** A class declaring an Odoo model (`_name`) or extending one (`_inherit`). */
export interface ParsedModel {
    modelName: string;
    className: string;
    line: number;
    character: number;
    isInherited: boolean;
}

export interface ParsedField {
    className: string;
    fieldName: string;
    fieldType: string;
    attributes: { [key: string]: string };
    line: number;
    character: number;
}

export interface ParsedFunction {
    className: string;
    functionName: string;
    parameters: string[];
    line: number;
    character: number;
}

export interface ParsedPythonFile {
    models: ParsedModel[];
    fields: ParsedField[];
    functions: ParsedFunction[];
}

const CLASS_QUERY = `
    (class_definition
        name: (identifier) @class_name
        body: (block) @body
    )
`;

const POSITIONAL_ARG_MAP: { [key: string]: string[] } = {
    'Many2one': ['comodel_name', 'string'],
    'One2many': ['comodel_name', 'inverse_name', 'string'],
    'Many2many': ['comodel_name', 'relation', 'column1', 'column2', 'string'],
    'Selection': ['selection', 'string'],
    'Reference': ['selection', 'string'],
    'default': ['string']
};

const EMPTY: ParsedPythonFile = { models: [], fields: [], functions: [] };

/**
 * Finds the models a Python file declares or extends, with their fields and methods, in one parse.
 * Classes without `_name` or `_inherit` are not models and contribute nothing.
 */
export function parsePythonFile(parser: TreeSitterParser, text: string): ParsedPythonFile {
    // A file can only declare a model if it assigns `_name` or `_inherit`: skip the parse otherwise.
    if (!text.includes('_name') && !text.includes('_inherit')) {
        return EMPTY;
    }
    return parser.withTree(text, tree => {
        const result: ParsedPythonFile = { models: [], fields: [], functions: [] };
        for (const match of parser.query(CLASS_QUERY).matches(tree.rootNode)) {
            const classNameNode = match.captures.find((c: any) => c.name === 'class_name')?.node;
            const bodyNode = match.captures.find((c: any) => c.name === 'body')?.node;
            if (classNameNode && bodyNode) {
                parseClass(classNameNode, bodyNode, result);
            }
        }
        return result;
    });
}

function parseClass(classNameNode: any, bodyNode: any, result: ParsedPythonFile) {
    const className = classNameNode.text;
    let modelName: string | null = null;
    let inheritValue: string | string[] | null = null;
    let hasName = false;
    const fields: ParsedField[] = [];
    const functions: ParsedFunction[] = [];

    for (const child of bodyNode.children) {
        if (child.type === 'expression_statement') {
            const assignment = child.firstChild;
            if (assignment?.type !== 'assignment') continue;
            const left = assignment.childForFieldName('left');
            const right = assignment.childForFieldName('right');
            if (left?.text === '_name') {
                hasName = true;
                modelName = right?.type === 'string' ? right.text.slice(1, -1) : null;
            } else if (left?.text === '_inherit') {
                inheritValue = extractValue(right);
            } else if (left?.type === 'identifier' && right?.type === 'call') {
                const field = parseField(className, left, right);
                if (field) fields.push(field);
            }
        } else if (child.type === 'function_definition' || child.type === 'decorated_definition') {
            // Methods with decorators (`@api.depends`...) are wrapped in a decorated_definition.
            const definition = child.type === 'decorated_definition' ? child.childForFieldName('definition') : child;
            if (definition?.type === 'function_definition') {
                const fn = parseFunction(className, definition);
                if (fn) functions.push(fn);
            }
        }
    }

    // _name if present, else the (first) inherited model.
    const finalModelName = hasName ? modelName : Array.isArray(inheritValue) ? inheritValue[0] : inheritValue;
    if (!finalModelName) return;

    result.models.push({
        modelName: finalModelName,
        className,
        line: classNameNode.startPosition.row,
        character: classNameNode.startPosition.column,
        isInherited: !hasName
    });
    result.fields.push(...fields);
    result.functions.push(...functions);
}

function parseField(className: string, left: any, callNode: any): ParsedField | null {
    const funcNode = callNode.childForFieldName('function');
    let fieldType = '';
    if (funcNode?.type === 'attribute') {
        const obj = funcNode.childForFieldName('object');
        const attr = funcNode.childForFieldName('attribute');
        if (obj?.text === 'fields' && attr) {
            fieldType = attr.text;
        }
    } else if (funcNode?.type === 'identifier') {
        // Handle direct imports like from odoo.fields import Char
        fieldType = funcNode.text;
    }
    if (!fieldType) return null;
    return {
        className,
        fieldName: left.text,
        fieldType,
        attributes: extractAttributes(callNode, fieldType),
        line: left.startPosition.row,
        character: left.startPosition.column
    };
}

function parseFunction(className: string, definition: any): ParsedFunction | null {
    const nameNode = definition.childForFieldName('name');
    if (!nameNode) return null;
    const parameters: string[] = [];
    const paramsNode = definition.childForFieldName('parameters');
    if (paramsNode) {
        for (const param of paramsNode.namedChildren) {
            let paramName = '';
            if (param.type === 'identifier') {
                paramName = param.text;
            } else {
                const idNode = param.childForFieldName('name') || param.firstChild;
                paramName = idNode && idNode.type === 'identifier' ? idNode.text : param.text;
            }
            if (paramName) {
                parameters.push(paramName);
            }
        }
    }
    return {
        className,
        functionName: nameNode.text,
        parameters,
        line: nameNode.startPosition.row,
        character: nameNode.startPosition.column
    };
}

function extractValue(node: any): string | string[] | null {
    if (!node) return null;
    if (node.type === 'string') {
        return node.text.slice(1, -1);
    }
    if (node.type === 'list' || node.type === 'tuple') {
        return node.namedChildren.filter((child: any) => child.type === 'string').map((child: any) => child.text.slice(1, -1));
    }
    return null;
}

function extractAttributes(callNode: any, fieldType: string): { [key: string]: string } {
    const attributes: { [key: string]: string } = {};
    const argListNode = callNode.childForFieldName('arguments');
    if (argListNode) {
        let positionalIndex = 0;
        const mapping = POSITIONAL_ARG_MAP[fieldType] || POSITIONAL_ARG_MAP['default'];
        for (const arg of argListNode.namedChildren) {
            if (arg.type === 'comment') {
                continue; // e.g. `fields.Many2one('res.company',  # note`
            }
            if (arg.type === 'keyword_argument') {
                const nameNode = arg.childForFieldName('name');
                const valueNode = arg.childForFieldName('value');
                if (nameNode && valueNode) {
                    attributes[nameNode.text] = cleanValue(valueNode);
                }
            } else {
                if (positionalIndex < mapping.length) {
                    attributes[mapping[positionalIndex]] = cleanValue(arg);
                }
                positionalIndex++;
            }
        }
    }
    return attributes;
}

function cleanValue(node: any): string {
    // Strip quotes if it's a string
    return node.type === 'string' && node.text.length >= 2 ? node.text.slice(1, -1) : node.text;
}
