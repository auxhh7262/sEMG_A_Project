import { MiniProgramCore, MiniProgramSummer } from '../../../../../types';
export interface ILoadScriptResult {
    targetPath: string;
    source: MiniProgramSummer.SourceDescription;
    process: MiniProgramSummer.IPluginProcessInfo[];
}
export declare function loadScriptFile(project: MiniProgramCore.IPreCompileProject, targetPath: string, sourcePath: string, pluginName: string): Promise<ILoadScriptResult>;
