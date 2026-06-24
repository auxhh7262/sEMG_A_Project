import { BaseCoreCompiler } from '../modules/corecompiler/baseCompiler';
import { MiniProgramCI } from '../types/ci';
import { OriginalCompiler } from '../modules/corecompiler/originalCompiler';
import { Builder } from '../modules/index';
import { IBuilderOptions } from '../modules';
export declare const getOriginalCompiler: (project: MiniProgramCI.IProject) => Promise<OriginalCompiler>;
export declare function getBuilder(proxyProject: MiniProgramCI.IProject, opts?: IBuilderOptions): Promise<Builder>;
export declare const getCompiler: (project: MiniProgramCI.IProject, setting: MiniProgramCI.ICompileSettings, opts?: IBuilderOptions) => Promise<BaseCoreCompiler>;
