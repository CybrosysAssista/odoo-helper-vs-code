import { getOdooVersion } from '../../services/versionService';
import v18 from './v18/decorators';
import v19 from './v19/decorators';

export async function getDecorators(): Promise<string[]> {
    const v = await getOdooVersion();
    return v === '18' ? v18 : v19;
}



