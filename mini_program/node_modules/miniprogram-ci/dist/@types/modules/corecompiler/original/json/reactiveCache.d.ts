import { CACHE_KEY } from '../../../../utils/cache';
import { ReactiveProject } from '../../../../project/advance/reactiveProject';
import { PageJSON, MiniProgramCore } from '../../../../types';
export { ReactiveProject };
export declare function tryToGetReactiveProject(project: MiniProgramCore.IPreCompileProject): ReactiveProject;
export declare class ReactiveJSONCompiler {
    static originGetPageJSON: any;
    static originCheckPageJSON: any;
    private pageComputeds;
    private jsonComputeds;
    private project;
    constructor(project: ReactiveProject);
    release(): void;
    registerOrGet<A extends any[], T>(cacheKey: CACHE_KEY, compileFunc: (project: ReactiveProject, ...args: A) => T, ...args: A): T;
    static setOriginGetPageJSON(originGetPageJSON: Function): void;
    static setOriginCheckPageJSON(originCheckPageJSON: Function): void;
    getPageJSON(type: 'checked' | 'compiled', options: {
        miniprogramRoot: string;
        pagePath: string;
    }): PageJSON.IPageJSON;
}
export declare function tryToGetReactiveJSONCompiler(project: ReactiveProject): ReactiveJSONCompiler;
export declare function wrapCompileJSONFunc<A extends any[], T>(cacheKey: CACHE_KEY, func: (project: ReactiveProject, ...args: A) => T): (project: ReactiveProject, ...args: A) => T;
export declare function cleanReactiveCache(): void;
