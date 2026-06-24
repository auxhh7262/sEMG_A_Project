import { MiniProgramCore, MiniProgramDevtools } from '../../../../types';
import { Recorder } from '../../../../utils/progressRecorder';
import { BaseGraph, IGraphOptions } from './basegraph';
export declare class GameGraph extends BaseGraph {
    private appConf;
    protected conf: MiniProgramDevtools.IGameConf | undefined;
    constructor(options: IGraphOptions);
    protected getWhiteListConfig(): Promise<Set<string>>;
    destroy(): void;
    getConf(recorder: Recorder): Promise<MiniProgramDevtools.IGameConf>;
    compileSingleCode(filePath: string, sourceCode?: string): Promise<MiniProgramDevtools.CodeFile>;
    getDevCode(recorder: Recorder, options: MiniProgramDevtools.IPackageCodeOptions): Promise<MiniProgramDevtools.CodeFiles>;
    getProdCode(recorder: Recorder, options: MiniProgramDevtools.IPackageCodeOptions & MiniProgramCore.ICompileOptions): Promise<MiniProgramDevtools.CodeFiles>;
    protected getLocalCodeFileList(): string[];
    protected onFileChangeForGraph(type: 'unlink' | 'unlinkDir' | 'add' | 'addDir' | 'change', path: string): void;
    protected getIndependentRoot(targetPath: string): string;
    protected checkFilePackage(path: string): string;
    protected compileJSON(options: MiniProgramCore.ICompileOptions, recorder: Recorder): Promise<{
        conf: MiniProgramDevtools.IGameConf;
        jsons: {
            [x: string]: string;
        };
    }>;
    protected compileJSONWithFileList(options: MiniProgramCore.ICompileOptionsWithFileList, recorder: Recorder): Promise<{
        conf: MiniProgramDevtools.IGameConf;
        jsons: {
            [x: string]: string;
        };
    }>;
}
