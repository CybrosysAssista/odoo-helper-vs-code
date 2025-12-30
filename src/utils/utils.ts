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
    depends?: string[];
};

export type DataFileMetaDataOptions = {
    manifestCategory: 'data';
    dataCategory: 'view' | 'security' | 'data';
};

export type AssetFileMetaDataOptions = {
    manifestCategory: 'asset';
    assetCategory: 'web' | 'pos' | 'frontend' | 'backend';
};

export type DependencyMetaDataOptions = {
    manifestCategory: 'dependency';
    moduleName: string;
};

export type DataFileMetaData = BaseFileMetaData & DataFileMetaDataOptions;

export type AssetFileMetaData = BaseFileMetaData & AssetFileMetaDataOptions;

export type FileMetaData = DataFileMetaData | AssetFileMetaData | DependencyFileMetaData;
export type DependencyFileMetaData = BaseFileMetaData & DependencyMetaDataOptions;
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
                        messages.push(`${child.name} created, but manifest update failed. (Python parser not ready)`);
                        continue;
                    }

                    parser.parseManifest(manifestContent);
                    const filePath = path.relative(moduleRoot.fsPath, childPath);
                    const result = parser.updateManifest(child, filePath);

                    if (result.success && result.updatedContent) {
                        fs.writeFileSync(manifestPath, result.updatedContent, 'utf8');
                    } else if (!result.success) {
                        messages.push(`${child.name} created, ${result.message}`);
                    }

                    // Handle dependencies
                    if (child.depends && child.depends.length > 0) {
                        for (const dep of child.depends) {
                            const currentManifestContent = fs.readFileSync(manifestPath, 'utf8');
                            parser.parseManifest(currentManifestContent);
                            const depResult = parser.updateManifest({
                                manifestCategory: 'dependency',
                                moduleName: dep
                            }, "");
                            if (depResult.success && depResult.updatedContent) {
                                fs.writeFileSync(manifestPath, depResult.updatedContent, 'utf8');
                            } else if (!depResult.success) {
                                messages.push(`Manifest update failed for dependency ${dep}: ${depResult.message}`);
                            }
                        }
                    }
                }
            }
        }

        return { success: true, message: messages };
    }
}
