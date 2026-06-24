import { ReactiveProject } from '../reactiveCache';
import { MiniProgramCore, PluginJSON } from '../../../../../types';
interface ICheckOptions {
    project: ReactiveProject;
    filePath: string;
    root: string;
}
export declare function checkComponentPath(options: ICheckOptions, inputJSON: PluginJSON.IPluginJSON): void;
export declare function checkWorkers(options: ICheckOptions, inputJSON: PluginJSON.IPluginJSON): void;
export declare const getDevPluginJSON: (project: ReactiveProject, localPath?: any) => PluginJSON.IPluginJSON;
export declare const getGameLocalPluginJSON: (project: MiniProgramCore.IPreCompileProject, localPath: string) => Promise<{}>;
export {};
