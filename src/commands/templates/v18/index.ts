import { commonComponent, fieldWidgetComponent, publicComponent, serviceTemplate } from './owlTemplates';
import { extendProductScreen, extendPartnerListScreen } from './posTemplate';

export * from './basicView';
export * from './advancedView';
export * from './inheritView';
export * from './reportView';
export * from './securityView';
export * from './sequenceView';
export * from './settingsView';
export * from './cronView';

export const getOwlComponentTemplate = (componentName: string, moduleName: string, type: string) => {
    if (type === 'commonComponent') {
        return new commonComponent(componentName, moduleName);
    }
    if (type === 'fieldWidgetComponent') {
        return new fieldWidgetComponent(componentName, moduleName);
    }
    if (type === 'publicComponent') {
        return new publicComponent(componentName, moduleName);
    }
    if (type === 'serviceTemplate') {
        return new serviceTemplate(componentName, moduleName);
    }
    return null;
};

export const getPosComponentTemplate = (moduleName: string, type: string) => {
    if (type === 'extendProductScreen') {
        return new extendProductScreen(moduleName);
    }
    if (type === 'extendPartnerListScreen') {
        return new extendPartnerListScreen(moduleName);
    }
    return null;
};
