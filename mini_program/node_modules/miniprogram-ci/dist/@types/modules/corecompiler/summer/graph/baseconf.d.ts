import { Recorder } from '../../../../utils/progressRecorder';
import { MiniProgramCore } from '../../../../types';
export declare abstract class BaseConf {
    protected proxyProject: MiniProgramCore.IPreCompileProject;
    protected root: string;
    constructor(proxyProject: MiniProgramCore.IPreCompileProject, root: string);
    protected abstract resetState(): Promise<void>;
    protected abstract load(recorder: Recorder): Promise<void>;
    protected build(recorder: Recorder): Promise<void>;
    abstract destroy(): void;
    abstract getConf(recorder: Recorder): Promise<Record<string, any>>;
}
export declare abstract class MiniProgramBaseConf extends BaseConf {
    protected abstract loadPage(path: string): Promise<void>;
    protected abstract loadComp(resolvedPath: string, literalPath: string, from: string): Promise<void>;
}
