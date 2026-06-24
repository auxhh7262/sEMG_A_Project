import { MiniProgramCore } from '../types';
import { SummerCompiler, ICompilerStatus } from './corecompiler/summerCompiler';
import { Analyzer } from '../common/code-analyse';
export declare class SummerCompilerFactory {
    summerCompiler: SummerCompiler | null;
    private project;
    private createPromise;
    summerCompilerStatus: ICompilerStatus | undefined;
    private releaseCbs;
    getSummerCompiler(project: MiniProgramCore.IPreCompileProject, analyzer: Analyzer): Promise<SummerCompiler>;
    private shouldCreate;
    private releaseLastCompiler;
    private ensureCacheDir;
    private createSummerCompiler;
    private getSummerOptions;
}
export declare const summerCompilerFactory: SummerCompilerFactory;
export declare const getSummerCompiler: (project: MiniProgramCore.IPreCompileProject, analyzer: Analyzer) => Promise<SummerCompiler>;
