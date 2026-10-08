import { lineAt, newlineOffsets } from './text';

/** [full name, 0-based line, kind] */
export type XmlEntry = [string, number, EntryKind];

/** A QWeb template name, or an XML id (`<record>`, `<menuitem>`, `<template>`). */
export const enum EntryKind { Template = 0, XmlId = 1 }

/** QWeb templates and XML ids an Odoo data file defines, qualified with `moduleName`. */
export function extractXmlEntries(xmlText: string, moduleName: string): XmlEntry[] {
    if (!xmlText.includes('<template') && !xmlText.includes('t-name') && !xmlText.includes('<record') && !xmlText.includes('<menuitem')) {
        return [];
    }
    const entries: XmlEntry[] = [];
    const newlines = newlineOffsets(xmlText);
    const qualify = (name: string) => name.includes('.') ? name : `${moduleName}.${name}`;
    // <template id="..." ...>: a template, and an XML id
    // `\sid` so that `inherit_id="..."` is never taken for the template's own id
    const templateIdRegex = /<template\b[^>]*?\sid\s*=\s*["']([^"']+)["']/g;
    let match;
    while ((match = templateIdRegex.exec(xmlText)) !== null) {
        const line = lineAt(newlines, match.index);
        entries.push([qualify(match[1]), line, EntryKind.Template]);
        entries.push([qualify(match[1]), line, EntryKind.XmlId]);
    }
    // <t t-name="..." ...>
    const tNameRegex = /<t\b[^>]*?\st-name\s*=\s*["']([^"']+)["']/g;
    while ((match = tNameRegex.exec(xmlText)) !== null) {
        entries.push([qualify(match[1]), lineAt(newlines, match.index), EntryKind.Template]);
    }
    // <record id="..."> and <menuitem id="...">
    const recordIdRegex = /<(?:record|menuitem)\b[^>]*?\bid\s*=\s*["']([^"']+)["']/g;
    while ((match = recordIdRegex.exec(xmlText)) !== null) {
        entries.push([qualify(match[1]), lineAt(newlines, match.index), EntryKind.XmlId]);
    }
    return entries;
}
