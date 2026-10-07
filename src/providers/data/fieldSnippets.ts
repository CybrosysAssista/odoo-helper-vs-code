import { byVersion, getOdooVersion } from '../../services/versionService';
import v18, { FieldSnippet } from './v18/odooFieldSnippets';
import v19 from './v19/odooFieldSnippets';
import v20 from './v20/odooFieldSnippets';

export async function getFieldSnippets(): Promise<FieldSnippet[]> {
    const version = await getOdooVersion();
    return byVersion(version, { 18: v18, 19: v19, 20: v20 });
}



