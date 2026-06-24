import { MiniProgramCore, MiniProgramSummer } from '../../../../../types';
export { MAX_CODE_LENGTH, } from '../../../../../config/config';
export declare function getSWCRoot(project: MiniProgramCore.IPreCompileProject, independentRoot: string): string;
export interface IScriptCompileOptions {
    disableUseStrict?: boolean;
    minify?: boolean;
    resultType: MiniProgramCore.IResultType;
    swcRoot: string;
    target: 'es5' | 'es2022';
    rc?: {
        parser?: Record<string, string>;
        module?: Record<string, string>;
    };
}
export interface IScriptCompileResult {
    code: string;
    map?: MiniProgramSummer.SourceMap;
    helpers: string[];
}
export interface IScriptCompileOptions {
    swc?: boolean;
    independentRoot: string;
    isBabelIgnore: boolean;
    resultType: MiniProgramCore.IResultType;
}
export default function (project: MiniProgramCore.IPreCompileProject, options: {
    disableUseStrict: boolean;
}): MiniProgramSummer.SummerPlugin;
