import { MiniProgramCore, MiniProgramSummer } from '../../../../../types';
export interface IWxssOptions {
    autoPrefix: boolean;
    minify: boolean;
}
export default function (project: MiniProgramCore.IPreCompileProject, options?: IWxssOptions): MiniProgramSummer.SummerPlugin;
