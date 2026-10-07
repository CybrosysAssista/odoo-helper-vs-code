import { isAtLeast } from '../services/versionService';

/**
 * The access-rights CSV of a module. Odoo 20 replaced ir.model.access (and ir.rule) with ir.access:
 * a different file, header and row shape. Rows grant internal users (base.group_user) full access;
 * a row without a group would mean "every user" before Odoo 20 and a restriction from Odoo 20 on.
 */
export interface AccessCsvSpec {
    fileName: string;
    header: string[];
    /** Recognises a row of this file for `modelName`. */
    hasModel(row: string[], modelName: string): boolean;
    row(modelName: string): string[];
}

export function accessCsvSpec(version: string): AccessCsvSpec {
    if (isAtLeast(version, '20')) {
        return {
            fileName: 'ir.access.csv',
            header: ['id', 'name', 'model_id', 'group_id/id', 'operation', 'domain'],
            hasModel: (row, model) => row[2] === model,
            row: model => [`access_${model.replace(/\./g, '_')}_user`, `${model} user`, model, 'base.group_user', 'crud', ''],
        };
    }
    return {
        fileName: 'ir.model.access.csv',
        header: ['id', 'name', 'model_id:id', 'group_id:id', 'perm_read', 'perm_write', 'perm_create', 'perm_unlink'],
        hasModel: (row, model) => row[2] === `model_${model.replace(/\./g, '_')}`,
        row: model => [`access_${model.replace(/\./g, '_')}_user`, `${model} user`, `model_${model.replace(/\./g, '_')}`, 'base.group_user', '1', '1', '1', '1'],
    };
}
