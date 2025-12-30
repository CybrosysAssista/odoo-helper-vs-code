import { getOdooVersion } from '../../services/versionService';
import v18 from './v18/fieldAttributes';
import v19 from './v19/fieldAttributes';

export async function getFieldAttributes(): Promise<string[]> {
    const v = await getOdooVersion();
    return v === '18' ? v18 : v19;
}



