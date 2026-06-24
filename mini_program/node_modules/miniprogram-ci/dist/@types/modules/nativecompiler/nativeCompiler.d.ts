import { MiniProgramCore, IMiniApp } from '../../types';
import { Recorder } from '../../utils/progressRecorder';
import { AndroidUtils } from './android';
import { IOSUtils } from './ios';
interface INativeProjectInfo {
    projectPath: string;
}
interface IProps {
    projectInfo: INativeProjectInfo;
    miniappDirPath?: string;
    devtoolsVersion?: string;
}
export declare class NativeCompiler {
    projectPath: string;
    processManager: any;
    miniappDirPath: string | undefined;
    devtoolsVersion: string | undefined;
    constructor(props: IProps);
    getHandler(targetPlatform?: string): AndroidUtils | IOSUtils | null;
    validNativePlatform(targetPlatform: MiniProgramCore.ITargetPlatform): boolean;
    getAndroidDevices(): Promise<any>;
    getIOSDevices(): Promise<any>;
    run(data: {
        targetPlatform: MiniProgramCore.ITargetPlatform;
        opts: IMiniApp.IIOSRunLocalSimpleArgs | IMiniApp.IAndroidRunLocalSimpleArgs;
    }, recorder: Recorder): Promise<any>;
    build(data: {
        targetPlatform: MiniProgramCore.ITargetPlatform;
        opts: IMiniApp.IAndroidBuildLocalSimpleArgs | IMiniApp.IAndroidBuildCloudSimpleArgs;
    }, recorder: Recorder): Promise<any>;
    buildPlugin(data: {
        targetPlatform: MiniProgramCore.ITargetPlatform;
        opts: IMiniApp.IBuildPluginIOSFrameworkArgs | IMiniApp.IAndroidBuildPluginArgs;
    }, recorder: Recorder): Promise<any>;
    packIOSCloudBuildMaterial(data: {
        targetPlatform: MiniProgramCore.ITargetPlatform;
        opts: IMiniApp.IIOSBuildCloudGenMaterialArgs;
    }, recorder: Recorder): Promise<any>;
    initUSBConnectionProcess(data: {
        targetPlatform: MiniProgramCore.ITargetPlatform;
    }, recorder: Recorder): Promise<any>;
    codesignIOSApp(data: {
        targetPlatform: MiniProgramCore.ITargetPlatform;
        opts: IMiniApp.CodesignIpaArgs;
    }, recorder: Recorder): Promise<any>;
}
export {};
