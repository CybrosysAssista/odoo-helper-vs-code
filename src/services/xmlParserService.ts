import * as vscode from 'vscode';
import { getLanguageService, HTMLDocument, Node } from 'vscode-html-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';

export interface XmlNode extends Node {
    tag: string;
    attributes: { [key: string]: string };
}

export class XmlParserService {
    private ls = getLanguageService();

    /**
     * Parse XML content using HTML language service
     */
    public parse(text: string): HTMLDocument {
        const document = TextDocument.create('untitled://example.xml', 'xml', 0, text);
        return this.ls.parseHTMLDocument(document);
    }

    /**
     * Find node at a specific offset
     */
    public findNodeAtOffset(text: string, offset: number): Node | null {
        const doc = this.parse(text);
        return doc.findNodeAt(offset);
    }

    /**
     * Get all attributes of a node
     */
    public getAttributes(text: string, node: Node): { [key: string]: string } {
        const attributes: { [key: string]: string } = {};
        const start = node.start;
        const end = node.startTagEnd || node.end;
        const tagText = text.slice(start, end);

        // Simple regex to extract attributes from the start tag
        // <tag attr="val" attr2='val2'>
        const attrRegex = /\s+([\w.:-]+)\s*=\s*(['"])(.*?)\2/g;
        let match;
        while ((match = attrRegex.exec(tagText)) !== null) {
            attributes[match[1]] = match[3];
        }
        return attributes;
    }

    /**
     * Odoo specific: Find all <record> elements
     */
    public findRecords(text: string): Array<{ id: string; model: string; node: Node }> {
        const doc = this.parse(text);
        const records: Array<{ id: string; model: string; node: Node }> = [];

        this.traverse(doc.roots, (node) => {
            if (node.tag === 'record') {
                const attrs = this.getAttributes(text, node);
                records.push({
                    id: attrs['id'] || '',
                    model: attrs['model'] || '',
                    node: node
                });
            }
        });

        return records;
    }

    /**
     * Odoo specific: Find all <template> elements
     */
    public findTemplates(text: string): Array<{ id: string; node: Node }> {
        const doc = this.parse(text);
        const templates: Array<{ id: string; node: Node }> = [];

        this.traverse(doc.roots, (node) => {
            if (node.tag === 'template' || (node.tag === 't' && this.getAttributes(text, node)['t-name'])) {
                const attrs = this.getAttributes(text, node);
                templates.push({
                    id: attrs['id'] || attrs['t-name'] || '',
                    node: node
                });
            }
        });

        return templates;
    }

    /**
     * Traverse the HTML/XML tree
     */
    private traverse(nodes: Node[], callback: (node: Node) => void) {
        for (const node of nodes) {
            callback(node);
            if (node.children && node.children.length > 0) {
                this.traverse(node.children, callback);
            }
        }
    }
}

let xmlParserServiceInstance: XmlParserService | null = null;

export function getXmlParserService(): XmlParserService {
    if (!xmlParserServiceInstance) {
        xmlParserServiceInstance = new XmlParserService();
    }
    return xmlParserServiceInstance;
}
