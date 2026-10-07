import { byVersion, getOdooVersion } from '../../services/versionService';
import v18 from './v18/fieldTypes';
import v19 from './v19/fieldTypes';
import v20 from './v20/fieldTypes';

export async function getFieldTypes(): Promise<string[]> {
    const v = await getOdooVersion();
    return byVersion(v, { 18: v18, 19: v19, 20: v20 });
}



