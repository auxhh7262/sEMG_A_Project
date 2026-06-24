import { MiniProgramDevtools } from '../types';
export declare function getBabelHelperVersion(): string;
export declare function getBabelHelperDepMap(): {
    [key: string]: string[];
};
export declare function getDefaultPlugins(): Map<any, number | object>;
export declare function getCustomPlugins(disableList?: string[]): any[];
export declare function getHelperDeps(helpers: string[] | object, babelRoot: string): any;
export declare function getHelperContent(mod: string, babelRoot: string): Promise<string>;
export declare function isIgnore(babelIgnore: any[], filePath: any): boolean;
export declare function searchBabelModule(code: string, babelRoot: string): string[];
export declare function replaceBabelHelpers(code: string, skipHelpers: {
    [key: string]: boolean;
} | undefined, filePath: string, babelRoot: string): {
    transformCode: string;
    helpers: string[];
};
export declare function collectBabelHelpers(code: string): {
    [key: string]: boolean;
};
export declare function isValidBabelHelperFunc(funcName: string): boolean;
export declare function getBabelOutputPath(setting: MiniProgramDevtools.IProjectSetting): string;
