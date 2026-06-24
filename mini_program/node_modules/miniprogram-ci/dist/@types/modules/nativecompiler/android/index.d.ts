import { Recorder } from '../../../utils/progressRecorder';
import { IMiniApp } from '../../../types';
export declare class AndroidUtils {
    private root;
    private userConfig;
    private miniappDirPath?;
    private devtoolsVersion?;
    constructor(root: string, userConfig?: IMiniApp.AndroidProjectParams, miniappDirPath?: string | undefined, devtoolsVersion?: string | undefined);
    getProjectConfig(recorder: Recorder): IMiniApp.AndroidProjectConfig;
    runLocal(args: IMiniApp.IAndroidRunLocalArgs, recorder: Recorder): Promise<void>;
    runCloud(): Promise<void>;
    buildLocal(args: IMiniApp.IAndroidBuildLocalArgs, recorder: Recorder): Promise<string>;
    buildCloud(): Promise<void>;
    runOnAllDevices(args: IMiniApp.IAndroidRunLocalArgs, androidProject: IMiniApp.AndroidProject, recorder: Recorder): Promise<void>;
    runOnSpecificDevice(args: IMiniApp.IAndroidRunLocalArgs, androidProject: IMiniApp.AndroidProject, recorder: Recorder): Promise<void>;
    buildPlugin(args: IMiniApp.IAndroidBuildPluginArgs, recorder: Recorder): Promise<string>;
}
