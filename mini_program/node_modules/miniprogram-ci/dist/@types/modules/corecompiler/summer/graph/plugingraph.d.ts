import { Recorder } from '../../../../utils/progressRecorder';
import { MiniProgramDevtools, MiniProgramCore } from '../../../../types';
import { BaseGraph, FileInfo, IGraphOptions } from './basegraph';
export declare class PluginGraph extends BaseGraph {
    private pluginConf;
    protected conf: MiniProgramDevtools.IPluginConf | undefined;
    constructor(options: IGraphOptions);
    protected getWhiteListConfig(): Promise<Set<string>>;
    destroy(): void;
    getConf(recorder: Recorder): Promise<MiniProgramDevtools.IPluginConf>;
    compileSingleCode(filePath: string, sourceCode?: string): Promise<MiniProgramDevtools.CodeFile>;
    getDevCode(recorder: Recorder): Promise<MiniProgramDevtools.CodeFiles>;
    getProdCode(recorder: Recorder, options: MiniProgramDevtools.IPackageCodeOptions & MiniProgramCore.ICompileOptions): Promise<MiniProgramDevtools.CodeFiles>;
    protected getLocalCodeFileList(): string[];
    protected onFileChangeForGraph(type: 'unlink' | 'unlinkDir' | 'add' | 'addDir' | 'change', path: string): void;
    getPackageFile(root?: string): Promise<FileInfo[]>;
    protected getIndependentRoot(targetPath: string): string;
    protected checkFilePackage(path: string): string;
    protected compileJSON(): Promise<{
        conf: MiniProgramDevtools.IPluginConf;
        jsons: Record<string, string>;
    }>;
    protected compileJSONWithFileList(): Promise<{
        conf: MiniProgramDevtools.IPluginConf;
        jsons: Record<string, string>;
    }>;
}
