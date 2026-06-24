import { MiniProgramCore, MiniProgramDevtools, MiniProgramSummer } from '../../../types';
import { Recorder } from '../../../utils/progressRecorder';
import { PluginGraph } from './graph/plugingraph';
import { GamePluginGraph } from './graph/gameplugingraph';
import { BaseGraph } from './graph/basegraph';
import PersistCache from './persistCache';
export type ICompilerStatus = MiniProgramDevtools.ICompilerStatus;
export declare class SummerCompiler {
    project: MiniProgramCore.IPreCompileProject;
    private cachePath;
    private devtoolsProject;
    projectPath: string;
    appGraph: BaseGraph;
    pluginGraph?: PluginGraph | GamePluginGraph;
    plugins: MiniProgramSummer.SummerPlugin[];
    proxyProject: any;
    persistCache: PersistCache;
    constructor(project: MiniProgramCore.IPreCompileProject, cachePath: string, devtoolsProject: MiniProgramDevtools.IDevtoolsProjectInfo);
    getBabelSetting(): {
        ignore: string[];
        disablePlugins: string[];
        outputPath: string;
    } | undefined;
    getSWCSetting(): MiniProgramDevtools.ISWCSetting | undefined;
    private initPlugins;
    private isGameType;
    private isPluginType;
    private initAppGraph;
    private initPluginGraph;
    updateOptions(options: MiniProgramDevtools.IDevtoolsProjectInfo): void;
    destroy(): void;
    getStatus(): MiniProgramDevtools.ICompilerStatus;
    clearCache(): void;
    getPackageFiles({ graphId, root, }: MiniProgramCore.IGetPackageFilesOptions, recorder: Recorder): Promise<import("./graph/basegraph").FileInfo[] | undefined>;
    getConf({ graphId }: MiniProgramDevtools.IGetConfOptions, recorder: Recorder): Promise<MiniProgramDevtools.IAppConf | MiniProgramDevtools.IPluginConf | MiniProgramDevtools.IGameConf | MiniProgramDevtools.IGamePluginConf>;
    getCode(options: MiniProgramDevtools.IGetCodeOptions, recorder: Recorder): Promise<MiniProgramDevtools.CodeFiles>;
    getDevCodeByFileList(options: MiniProgramDevtools.IGetCodeByFileListOptions, recorder: Recorder): Promise<MiniProgramDevtools.CodeFiles>;
    getLocalFileList(graphId: MiniProgramDevtools.GraphId): Promise<MiniProgramCore.IFileInfos>;
    compileSingleCode(options: MiniProgramDevtools.ICompileSingleCodeOptions, recorder: Recorder): Promise<MiniProgramDevtools.CodeFile>;
    compileNewLogic(options: MiniProgramCore.ICompileOptionsWithFileList, recorder: Recorder): Promise<{
        app: MiniProgramDevtools.ICompileResult;
        plugin?: MiniProgramDevtools.ICompileResult;
    }>;
    compile(options: MiniProgramCore.ICompileOptions, recorder: Recorder): Promise<MiniProgramDevtools.ICompileResult>;
}
