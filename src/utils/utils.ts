import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { OdooModuleUtils } from './odooModuleUtils';
import { ManifestParser } from '../services/manifestParser';
import { getPythonParserService } from '../services/pythonParserService';

export type BaseFileMetaData = {
    type: 'file';
    name: string;
    content: string;
    updateManifest: boolean;
};

export type DataFileMetaDataOptions = {
    manifestCategory: 'data';
    dataCategory: 'view' | 'security' | 'data';
};

export type AssetFileMetaDataOptions = {
    manifestCategory: 'asset';
    assetCategory: 'web' | 'pos' | 'frontend' | 'backend';
};

export type DataFileMetaData = BaseFileMetaData & DataFileMetaDataOptions;

export type AssetFileMetaData = BaseFileMetaData & AssetFileMetaDataOptions;

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

        const messages: string[] = [];

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
                    // Collect messages from recursive calls
                    if (result.message && result.message.length > 0) {
                        messages.push(...result.message);
                    }
                }
            } else {
                const childPath = path.join(uri.fsPath, child.name);
                const childUri = vscode.Uri.file(childPath);
                if (fs.existsSync(childPath)) {
                    return { success: false, message: [`File ${child.name} already exists in ${uri.fsPath}`] };
                }

                fs.writeFileSync(childPath, child.content, 'utf8');

                if (child.updateManifest) {
                    const moduleRoot = await OdooModuleUtils.getModuleRoot(childUri);
                    if (!moduleRoot) {
                        return { success: false, message: [`Module root not found for ${childUri.fsPath}`] };
                    }

                    const manifestPath = path.join(moduleRoot.fsPath, '__manifest__.py');
                    if (!fs.existsSync(manifestPath)) {
                        return { success: false, message: [`Manifest not found at ${manifestPath}`] };
                    }

                    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
                    const parser = getPythonParserService().getManifestParser();
                    if (!parser) {
                        messages.push(`${child.name} created,But manifest update failed.(Python parser not ready)`);
                    }

                    parser.parseManifest(manifestContent);
                    const filePath = path.relative(moduleRoot.fsPath, childPath);
                    const result = parser.updateManifest(child, filePath);
                    if (!result.success) {
                        messages.push(`${child.name} created, ${result.message}`);
                    } else if (result.updatedContent) {
                        fs.writeFileSync(manifestPath, result.updatedContent, 'utf8');
                    }
                }
            }
        }

        return { success: true, message: messages };

    }
}

