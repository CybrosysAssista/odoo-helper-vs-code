import { byVersion, getOdooVersion } from '../../services/versionService';
import v18, { MethodSnippet } from './v18/odooMethodSnippets';
import v19 from './v19/odooMethodSnippets';
import v20 from './v20/odooMethodSnippets';

export async function getMethodSuggestions(): Promise<MethodSnippet[]> {
    const version = await getOdooVersion();
    return byVersion(version, { 18: v18, 19: v19, 20: v20 });
}



