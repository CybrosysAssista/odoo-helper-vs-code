import { getOdooVersion } from '../../services/versionService';
import v18 from './v18/fieldTypes';
import v19 from './v19/fieldTypes';

export async function getFieldTypes(): Promise<string[]> {
    const v = await getOdooVersion();
    return v === '18' ? v18 : v19;
}



