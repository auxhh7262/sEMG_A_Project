import { IMiniApp } from '../types';
import { Recorder } from './progressRecorder';
import { IEntitlements } from './codesign';
export declare const DEFAULT_BUNDLE_ID = "com.tencent.devtoolssaaademo.db";
type IMiniAppBuildTips = Record<string, {
    code: number;
    msg: string;
}>;
export declare const miniappSinTypes: {
    appleId: {
        type: string;
    };
    certificate: {
        type: string;
    };
};
interface IAppleIdSignAndInstall {
    bundleId?: string;
    projectPath: string;
    ipaPath: string;
    deviceId?: string;
    appleId?: string;
    password?: string;
    entitlements?: IEntitlements;
    install?: boolean;
    output?: string;
    udid?: string;
    miniappDirPath?: string;
    devtoolsVersion?: string;
}
interface ICertificateSignAndInstall {
    projectPath: string;
    ipaPath: string;
    miniappCacheDirPath: string;
    deviceId?: string;
    entitlements?: IEntitlements;
    install?: boolean;
    output?: string;
    udid?: string;
    miniappDirPath?: string;
    devtoolsVersion?: string;
    selfCertificate: IMiniApp.ISelfCertificate;
}
interface ISignAndInstallResult {
    success: boolean;
    errMsg?: string;
    uniqueId?: string;
}
export interface IGetMiniAppBuilderOts {
    miniappDirPath?: string;
    devtoolsVersion?: string;
    recorder?: Recorder;
}
interface IGetDevicesOpts {
    projectPath?: string;
    miniappDirPath?: string;
    devtoolsVersion?: string;
    recorder?: Recorder;
}
type IClearCacheOpts = IGetDevicesOpts & {
    type: 'appleId' | 'certificate';
};
export declare function getMiniAppBuilderFromRemoteCore(opts: IGetMiniAppBuilderOts, winExeFileName: string, macExeFileName: string): Promise<{
    builderPath: string;
    exe: string;
    cwd: string;
}>;
export declare function getIOSDevices(opts: IGetDevicesOpts): Promise<IMiniApp.IOSDevice[]>;
export declare function clearCache(opts: IClearCacheOpts): Promise<void>;
export declare function doAppleIdSignAndInstallOrExport(opts: IAppleIdSignAndInstall, otherOpts: IGetMiniAppBuilderOts, iosTransformTips: IMiniAppBuildTips): Promise<ISignAndInstallResult>;
export declare function doCertificateSignAndInstallOrExport(opts: ICertificateSignAndInstall, otherOpts: IGetMiniAppBuilderOts, iosTransformTips: IMiniAppBuildTips): Promise<ISignAndInstallResult>;
export declare function signAndInstallOrExport(projectPath: string, demoIpaPath: string, miniappCacheDirPath: string, certificateInfo: IMiniApp.ISignCertficateInfo, opts: {
    deviceId?: string;
    install?: boolean;
    output?: string;
    entitlements?: IEntitlements;
    bundleId?: string;
    isPublish?: boolean;
}, otherOpts: IGetMiniAppBuilderOts): Promise<void>;
export {};
