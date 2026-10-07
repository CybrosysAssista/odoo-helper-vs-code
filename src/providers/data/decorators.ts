import { byVersion, getOdooVersion } from '../../services/versionService';
import v18 from './v18/decorators';
import v19 from './v19/decorators';
import v20 from './v20/decorators';

export async function getDecorators(): Promise<string[]> {
    const v = await getOdooVersion();
    return byVersion(v, { 18: v18, 19: v19, 20: v20 });
}



