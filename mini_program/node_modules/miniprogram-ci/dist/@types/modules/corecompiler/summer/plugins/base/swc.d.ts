import { MiniProgramCore, MiniProgramSummer } from '../../../../../types';
export { MAX_CODE_LENGTH, } from '../../../../../config/config';
export declare function getSWCRoot(project: MiniProgramCore.IPreCompileProject, independentRoot: string): string;
export default function (project: MiniProgramCore.IPreCompileProject, options: {
    disableUseStrict: boolean;
}): MiniProgramSummer.SummerPlugin;
