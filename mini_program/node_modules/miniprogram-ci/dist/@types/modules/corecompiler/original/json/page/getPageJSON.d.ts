import { ReactiveProject } from '../reactiveCache';
import { MiniProgramCore, PageJSON } from '../../../../../types';
export declare function originGetPageJSON(project: ReactiveProject, options: {
    miniprogramRoot: string;
    pagePath: string;
}): PageJSON.IPageJSON;
export declare function getPageJSON(project: MiniProgramCore.IPreCompileProject, options: {
    miniprogramRoot: string;
    pagePath: string;
}): Promise<PageJSON.IPageJSON>;
export declare function getPageJSONWithDisableSpreading(project: MiniProgramCore.IPreCompileProject, options: {
    miniprogramRoot: string;
    pagePath: string;
}): PageJSON.IPageJSON;
