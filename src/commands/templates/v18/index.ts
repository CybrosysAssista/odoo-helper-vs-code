import { commonComponent } from './owlTemplates';

export * from './basicView';
export * from './advancedView';
export * from './inheritView';
export * from './reportView';
export * from './securityView';
export * from './sequenceView';
export * from './settingsView';
export * from './cronView';

export const getPosComponentTemplate = (componentName: string, moduleName: string, type: string) => {
    if (type === 'commonComponent') {
        return new commonComponent(componentName, moduleName);
    }
    return null;
};
