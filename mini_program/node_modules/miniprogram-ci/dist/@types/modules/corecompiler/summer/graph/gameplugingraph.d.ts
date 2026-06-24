import { Recorder } from '../../../../utils/progressRecorder';
import { MiniProgramDevtools, MiniProgramCore } from '../../../../types';
import { BaseGraph, FileInfo, IGraphOptions } from './basegraph';
export declare class GamePluginGraph extends BaseGraph {
    private pluginConf;
    protected conf: MiniProgramDevtools.IGamePluginConf | undefined;
    constructor(options: IGraphOptions);
    protected getWhiteListConfig(): Promise<Set<string>>;
    destroy(): void;
    getConf(recorder: Recorder): Promise<MiniProgramDevtools.IGamePluginConf>;
    compileSingleCode(filePath: string, sourceCode?: string): Promise<MiniProgramDevtools.CodeFile>;
    getDevCode(recorder: Recorder): Promise<MiniProgramDevtools.CodeFiles>;
    getProdCode(recorder: Recorder, options: MiniProgramDevtools.IPackageCodeOptions & MiniProgramCore.ICompileOptions): Promise<MiniProgramDevtools.CodeFiles>;
    protected getLocalCodeFileList(): string[];
    protected onFileChangeForGraph(type: 'unlink' | 'unlinkDir' | 'add' | 'addDir' | 'change', path: string): void;
    getPackageFile(root?: string): Promise<FileInfo[]>;
    protected checkFilePackage(path: string): string;
    protected getIndependentRoot(targetPath: string): string;
    protected compileJSON(): Promise<{
        conf: MiniProgramDevtools.IGamePluginConf;
        jsons: Record<string, string>;
    }>;
    protected compileJSONWithFileList(): Promise<{
        conf: MiniProgramDevtools.IGamePluginConf;
        jsons: Record<string, string>;
    }>;
}
