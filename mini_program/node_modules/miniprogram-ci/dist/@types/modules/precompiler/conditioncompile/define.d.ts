import { MiniProgramCore } from '../../../types';
interface IMacroDefineOpts {
    filePath: string;
    targetPlatform: MiniProgramCore.ITargetPlatform;
    targetPlatformDefines?: MiniProgramCore.ITargetPlatformDefine;
}
export declare class MacroDefine {
    private defaultConstants;
    private customConstants;
    constructor({ filePath, targetPlatform, targetPlatformDefines }: IMacroDefineOpts);
    defines(defines: MiniProgramCore.ITargetPlatformDefine): void;
    define(key: string, value: string | number | boolean): void;
    isDefined(key: string): boolean;
    getDefines(): {
        [x: string]: any;
    };
}
export {};
