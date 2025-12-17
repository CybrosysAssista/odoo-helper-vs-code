import { getOdooVersion } from '../../services/versionService';
import v18, { FieldSnippet } from './v18/odooFieldSnippets';
import v19 from './v19/odooFieldSnippets';

export async function getFieldSnippets(): Promise<FieldSnippet[]> {
    const version = await getOdooVersion();
    return version === '18' ? v18 : v19;
}



