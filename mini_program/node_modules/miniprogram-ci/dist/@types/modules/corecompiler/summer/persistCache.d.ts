import { MiniProgramCore, MiniProgramDevtools } from '../../../types';
import { FileInfo } from './graph/basegraph';
export default class LogicPersistCache {
    private baseCacheKey;
    private persistCache;
    private project;
    constructor(project: MiniProgramCore.IPreCompileProject, cachePath: string, baseCacheKey: string);
    updateBaseCacheKey(key: string): void;
    private getCacheKey;
    get(projectPath: string, root: string, file: FileInfo): Promise<MiniProgramDevtools.CodeFile | undefined>;
    set(projectPath: string, root: string, file: FileInfo, data: MiniProgramDevtools.CodeFile): Promise<void>;
    clean(): Promise<void>;
}
