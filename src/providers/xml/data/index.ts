import { getOdooVersion } from '../../../services/versionService';
import v18 from './v18';
import v19 from './v19';

export async function getXmlMeta() {
    const v = await getOdooVersion();
    return v === '18' ? v18 : v19;
}



