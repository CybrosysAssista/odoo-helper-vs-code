import { byVersion, getOdooVersion } from '../../services/versionService';
import v18, { UtilitySnippet } from './v18/odooUtilitySnippets';
import v19 from './v19/odooUtilitySnippets';
import v20 from './v20/odooUtilitySnippets';

export async function getUtilitySnippets(): Promise<UtilitySnippet[]> {
    const version = await getOdooVersion();
    return byVersion(version, { 18: v18, 19: v19, 20: v20 });
}



