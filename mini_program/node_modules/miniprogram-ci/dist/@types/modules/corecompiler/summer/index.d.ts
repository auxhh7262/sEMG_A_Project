import { MiniProgramCore, MiniProgramDevtools } from '../../../types';
export { ICompilerStatus } from './summer';
export declare function compile(project: MiniProgramCore.IPreCompileProject, projectConfig: any, options: MiniProgramCore.ICompileOptions, _useCompilerPlugins: any): Promise<MiniProgramDevtools.ICompileResult>;
