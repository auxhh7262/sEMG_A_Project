import { Recorder } from './progressRecorder';
export interface IEntitlements {
    'com.apple.developer.associated-domains'?: string;
}
export declare function codesignAndExport(projectPath: string, demoIpaPath: string, miniappCacheDir: string, opts: {
    output: string;
    outputAppWithName?: string;
    entitlements?: IEntitlements;
    bundleId?: string;
    certificate?: string;
    profile?: string;
    tpnsProfile?: string;
    isPublish?: boolean;
}, recorder: Recorder, isUsingTpush: boolean, _inLandun?: boolean, _selectForCerficate?: boolean): Promise<{
    success: boolean;
    errMsg?: undefined;
} | {
    success: boolean;
    errMsg: any;
}>;
export declare function checkXcodeEnv(recorder?: Recorder): Promise<void>;
