import * as vscode from 'vscode';
import { byVersion, getOdooVersion } from '../services/versionService';
import * as scaffold18 from './scaffold18';
import * as scaffold19 from './scaffold19';
import * as scaffold20 from './scaffold20';

export async function createOdooScaffold(rootUri: vscode.Uri, moduleName: string, type: string): Promise<void> {
    const version = await getOdooVersion();
    const scaffold = byVersion(version, { 18: scaffold18, 19: scaffold19, 20: scaffold20 });
    return scaffold.createOdooScaffold(rootUri, moduleName, type);
}
