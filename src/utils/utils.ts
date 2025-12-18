import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { OdooModuleUtils } from './odooModuleUtils';

export type BaseFileMetaData = {
    type: 'file';
    name: string;
    content: string;
    updateManifest: boolean;
};

export type DataFileMetaData = BaseFileMetaData & {
    manifestCategory: 'data';
    dataCategory: 'view' | 'security' | 'data';
};

export type AssetFileMetaData = BaseFileMetaData & {
    manifestCategory: 'asset';
    assetCategory: 'web' | 'pos' | 'frontend' | 'backend';
};

export type FileMetaData = DataFileMetaData | AssetFileMetaData;
export type FileSystemNode = FileMetaData | FolderMetaData;

export type FolderMetaData = {
    type: 'folder';
    name: string;
    doNotExist: boolean;
    children: FileSystemNode[] | null;
};

export class helperUtils {
    static async createRecursiveDirectory(uri: vscode.Uri, directoryTree: FileSystemNode[]): Promise<{ success: boolean, message: string[] }> {
        if (!fs.existsSync(uri.fsPath)) {
            return { success: false, message: [`Directory "${uri.fsPath}" does not accessible.`] };
        }

        for (const child of directoryTree) {
            if (child.type === 'folder') {
                const childPath = path.join(uri.fsPath, child.name);
                const childUri = vscode.Uri.file(childPath);
                if (child.doNotExist && fs.existsSync(childPath)) {
                    return { success: false, message: [`Folder ${child.name} already exists in ${uri.fsPath}`] };
                }

                if (!fs.existsSync(childPath)) {
                    fs.mkdirSync(childPath, { recursive: true });
                }

                if (child.children) {
                    const result = await this.createRecursiveDirectory(childUri, child.children);
                    if (!result.success) {
                        return result;
                    }
                }
            } else {
                const childPath = path.join(uri.fsPath, child.name);
                const childUri = vscode.Uri.file(childPath);
                if (fs.existsSync(childPath)) {
                    return { success: false, message: [`File ${child.name} already exists in ${uri.fsPath}`] };
                }

                fs.writeFileSync(childPath, child.content, 'utf8');
            }
        }

        return { success: true, message: [] };

    }
}

