import { byVersion, getOdooVersion } from '../../services/versionService';
import v18, { ModelSnippet } from './v18/odooModelSnippets';
import v19 from './v19/odooModelSnippets';
import v20 from './v20/odooModelSnippets';

export async function getModelSnippets(): Promise<ModelSnippet[]> {
    const version = await getOdooVersion();
    return byVersion(version, { 18: v18, 19: v19, 20: v20 });
}



