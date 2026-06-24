import { Recorder } from '../../../../utils/progressRecorder';
import { BaseConf } from './baseconf';
export declare class GamePluginConf extends BaseConf {
    private plugin;
    destroy(): void;
    getConf(recorder: Recorder): Promise<{
        plugin: any;
    }>;
    protected resetState(): Promise<void>;
    protected load(recorder: Recorder): Promise<void>;
}
