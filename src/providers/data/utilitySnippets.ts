import { getOdooVersion } from '../../services/versionService';
import v18, { UtilitySnippet } from './v18/odooUtilitySnippets';
import v19 from './v19/odooUtilitySnippets';

export async function getUtilitySnippets(): Promise<UtilitySnippet[]> {
    const version = await getOdooVersion();
    return version === '18' ? v18 : v19;
}



