import { byVersion, getOdooVersion } from '../../services/versionService';
import v18 from './v18/fieldAttributes';
import v19 from './v19/fieldAttributes';
import v20 from './v20/fieldAttributes';

export async function getFieldAttributes(): Promise<string[]> {
    const v = await getOdooVersion();
    return byVersion(v, { 18: v18, 19: v19, 20: v20 });
}



