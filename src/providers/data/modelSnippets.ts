import { getOdooVersion } from '../../services/versionService';
import v18, { ModelSnippet } from './v18/odooModelSnippets';
import v19 from './v19/odooModelSnippets';

export async function getModelSnippets(): Promise<ModelSnippet[]> {
    const version = await getOdooVersion();
    return version === '18' ? v18 : v19;
}



