import { MiniProgramCore, IMiniApp } from '../../types';
import { SubProcessProxy } from '../../utils/subprocess/processManager';
import { IMessageHub } from '../../utils/messageHub';
interface IProps {
    devtoolMessagehub: IMessageHub;
    project: MiniProgramCore.IPreCompileProject;
    miniappDirPath?: string;
    devtoolsVersion?: string;
}
export declare class NativeCompiler {
    private _checkReadyTask?;
    private messageHub;
    private initedPromise;
    project: MiniProgramCore.IPreCompileProject | undefined;
    subProcessManager: SubProcessProxy | undefined;
    miniappDirPath: string | undefined;
    devtoolsVersion: string | undefined;
    constructor(props: IProps);
    ready(): Promise<any>;
    init(): Promise<void>;
    createSubProcessManager(): Promise<void>;
    private onProgressUpdate;
    runAndroid(opts: IMiniApp.IAndroidRunLocalSimpleArgs | IMiniApp.IAndroidRunCloudSimpleArgs): Promise<void>;
    runIOS(opts: IMiniApp.IIOSRunLocalSimpleArgs | IMiniApp.IIOSRunCloudSimpleArgs): Promise<void>;
    buildAndroidAPK(opts: IMiniApp.IAndroidBuildLocalSimpleArgs | IMiniApp.IAndroidBuildCloudSimpleArgs): Promise<string>;
    buildIOSIPA(opts: IMiniApp.IIOSBuildLocalSimpleArgs | IMiniApp.IIOSBuildCloudSimpleArgs): Promise<string>;
    codesignIpa(opts: IMiniApp.CodesignIpaArgs): Promise<string>;
    buildAndroidPlugin(opts: IMiniApp.IAndroidBuildPluginArgs): Promise<void>;
    buildIOSPlugin(opts: IMiniApp.IBuildPluginIOSFrameworkArgs): Promise<void>;
    packIOSCloudBuildMaterial(opts: IMiniApp.IIOSBuildCloudGenMaterialArgs): Promise<string>;
    initUSBConnectionProcess(): Promise<void>;
    destroy(): void;
}
export {};
