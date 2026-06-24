import { MiniProgramCore, MiniProgramSummer } from '../../../types';
export type IRunSummerPluginHookData = {
    command: 'clear';
} | {
    command: 'runMethod';
    plugin: string;
    projectInfo: MiniProgramCore.IPrecompileProjectSerializeInfo;
    pluginOption: MiniProgramSummer.SummerPluginOptions;
    method: string;
    args: any;
};
export type IRunSummerPluginHookResult = {
    error?: any;
    result?: any;
};
export declare function runSummerPluginHook(data: IRunSummerPluginHookData): Promise<IRunSummerPluginHookResult>;
