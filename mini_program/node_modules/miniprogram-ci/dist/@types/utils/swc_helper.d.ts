import { MiniProgramDevtools } from '~/types';
export declare function isValidSWCHelperFunc(funcName: string): boolean;
export declare function getHelperDeps(helpers: Set<string>, swcRoot: string): string[];
export declare function getSWCOutputPath(setting: MiniProgramDevtools.IProjectSetting): string;
export declare function getHelperContent(mod: string, swcRoot: string): Promise<string>;
export declare function replaceSWCHelpers(code: string, filePath: string, swcRoot: string): {
    transformCode: string;
    helpers: string[];
};
export declare function collectSWCHelpers(code: string): Set<string>;
export declare function isIgnore(babelIgnore: any[], filePath: any): boolean;
