import { Recorder } from '../../../utils/progressRecorder';
import { IMiniApp } from '../../../types';
export declare const getEmulators: () => IMiniApp.AndroidDevice[];
export declare const tryLaunchEmulator: (simulator: string | null, recorder: Recorder) => Promise<{
    success: boolean;
    error?: string;
    device?: IMiniApp.AndroidDevice;
}>;
export declare function getDevices(): Promise<IMiniApp.AndroidDevice[]>;
export declare function getAvailableCPUs(device: string): string[];
export declare function getCPU(device: string): string | null;
export declare function tryInstantBuild(androidProject: IMiniApp.ProjectConfig, variant: string, recorder: Recorder): Promise<void>;
export declare function tryBuild(sourceDir: string, gradleArgs: string[], recorder: Recorder): Promise<void>;
export declare function tryInstantInstall(androidProject: IMiniApp.ProjectConfig, variant: string, recorder: Recorder): Promise<void>;
export declare function tryLaunchAppOnDevice(device: string | void, packageName: string, args: IMiniApp.IAndroidRunLocalArgs, recorder: Recorder): Promise<void>;
