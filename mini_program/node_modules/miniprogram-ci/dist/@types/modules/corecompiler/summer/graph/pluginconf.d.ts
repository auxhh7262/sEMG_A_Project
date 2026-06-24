import { Recorder } from '../../../../utils/progressRecorder';
import { MiniProgramBaseConf } from './baseconf';
export declare class PluginConf extends MiniProgramBaseConf {
    private plugin;
    private pages;
    private comps;
    destroy(): void;
    getConf(recorder: Recorder): Promise<{
        plugin: any;
        pages: {
            [k: string]: any;
        };
        comps: {
            [k: string]: any;
        };
    }>;
    protected resetState(): Promise<void>;
    protected load(recorder: Recorder): Promise<void>;
    protected loadPage(path: string): Promise<void>;
    protected loadComp(resolvedPath: string, literalPath: string, from: string): Promise<void>;
}
