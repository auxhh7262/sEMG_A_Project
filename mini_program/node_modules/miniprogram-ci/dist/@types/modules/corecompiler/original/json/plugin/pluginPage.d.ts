import { ReactiveProject } from '../reactiveCache';
import { MiniProgramCore, PageJSON } from '../../../../../types';
interface ICheckOptions {
    project: MiniProgramCore.IPreCompileProject | ReactiveProject;
    root: string;
    filePath: string;
}
export declare function getPluginPageJSON(options: ICheckOptions): Promise<PageJSON.IPageJSON>;
export {};
