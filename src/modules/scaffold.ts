import * as vscode from 'vscode';
import { getOdooVersion } from '../services/versionService';
import * as scaffold18 from './scaffold18';
import * as scaffold19 from './scaffold19';

export async function createOdooScaffold(rootUri: vscode.Uri, moduleName: string, type: string): Promise<void> {
    const version = await getOdooVersion();
    if (version === '18') {
        return scaffold18.createOdooScaffold(rootUri, moduleName, type);
    }
    // default to 19 branch
    return scaffold19.createOdooScaffold(rootUri, moduleName, type);
}
