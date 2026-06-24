import type { CIProject } from '../../project/ciProject';
type ITheme = 'Light' | 'LightSpecial' | 'Dark' | 'DarkSpecial' | 'Default';
export declare const getIOSTheme: (project: CIProject, customImgPath: string | undefined) => Promise<ITheme>;
export {};
