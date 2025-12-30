import { getOdooVersion } from '../../services/versionService';
import v18, { MethodSnippet } from './v18/odooMethodSnippets';
import v19 from './v19/odooMethodSnippets';

export async function getMethodSuggestions(): Promise<MethodSnippet[]> {
    const version = await getOdooVersion();
    return version === '18' ? v18 : v19;
}



