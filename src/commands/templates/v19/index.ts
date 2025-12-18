export * from './basicView';
export * from './advancedView';
export * from './inheritView';
export * from './reportView';
export * from './securityView';
export * from './sequenceView';
export * from './settingsView';
export * from './cronView';
export * from './owlTemplates';

import { commonComponent } from './owlTemplates';

export const getPosComponentTemplate = (componentName: string, moduleName: string) => {
    return new commonComponent(componentName, moduleName);
};
