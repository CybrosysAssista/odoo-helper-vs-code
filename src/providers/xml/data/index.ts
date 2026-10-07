import { byVersion, getOdooVersion } from '../../../services/versionService';
import v18 from './v18';
import v19 from './v19';
import v20 from './v20';

export async function getXmlMeta() {
    const v = await getOdooVersion();
    return byVersion(v, { 18: v18, 19: v19, 20: v20 });
}



