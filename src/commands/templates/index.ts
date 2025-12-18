import { getOdooVersion } from '../../services/versionService';

async function getTemplates(): Promise<any> {
    const v = await getOdooVersion();
    if (v === '18') {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require('./v18/index');
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('./v19/index');
}

// Export wrapper functions that dispatch to the versioned modules
export const getBasicViewTemplate = async (...args: any[]): Promise<string> => (await getTemplates()).getBasicViewTemplate(...args);
export const getAdvancedViewTemplate = async (...args: any[]): Promise<string> => (await getTemplates()).getAdvancedViewTemplate(...args);
export const getInheritViewTemplate = async (...args: any[]): Promise<string> => (await getTemplates()).getInheritViewTemplate(...args);
export const getReportViewTemplate = async (...args: any[]): Promise<string> => (await getTemplates()).getReportViewTemplate(...args);
export const getSecurityGroupViewTemplate = async (...args: any[]): Promise<string> => (await getTemplates()).getSecurityGroupViewTemplate(...args);
export const getSecurityRuleViewTemplate = async (...args: any[]): Promise<string> => (await getTemplates()).getSecurityRuleViewTemplate(...args);
export const getSequenceViewTemplate = async (...args: any[]): Promise<string> => (await getTemplates()).getSequenceViewTemplate(...args);
export const getSettingsViewTemplate = async (...args: any[]): Promise<string> => (await getTemplates()).getSettingsViewTemplate(...args);
export const getCronViewTemplate = async (...args: any[]): Promise<string> => (await getTemplates()).getCronViewTemplate(...args);
export const getPosComponentTemplate = async (...args: any[]): Promise<any> => (await getTemplates()).getPosComponentTemplate(...args);
