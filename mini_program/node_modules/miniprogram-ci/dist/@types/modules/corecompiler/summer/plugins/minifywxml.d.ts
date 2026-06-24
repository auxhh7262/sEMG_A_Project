import { MiniProgramCore, MiniProgramSummer } from '../../../../types';
export interface IWxmlOptions {
    minify: boolean;
}
export default function (project: MiniProgramCore.IPreCompileProject, options?: IWxmlOptions): MiniProgramSummer.SummerPlugin;
