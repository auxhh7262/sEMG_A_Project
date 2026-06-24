import { MiniProgramCI } from '../types';
import type { CIProject } from '../project/ciProject';
import { IUploadOptions } from './upload';
export interface IBuildApkOptions extends IUploadOptions {
    project: CIProject;
    keyStore: string;
    keyPass: string;
    storePass: string;
    keyAlias: string;
    output: string;
    resourceDir?: string;
    useAab?: boolean;
    desc?: string;
    isUploadResourceBundle?: boolean;
    resourceBundleVersion?: string;
    resourceBundleDesc?: string;
    disableCache?: boolean;
}
interface IBuildApkResult {
    errmsg: string;
    success: boolean;
}
export interface IBuildArchiveOpts {
    version: string;
    desc: string;
    miniappPkgType: MiniProgramCI.IMiniappPkgType;
    useCloudSync: boolean;
    remoteDebugEnable: boolean;
}
export interface IAndroidCloudBuildInfo {
    certificateInfo: {
        androidCertificate: {
            keyStore: string;
            keyPass: string;
            storePass: string;
            keyAlias: string;
        };
    };
    miniappPkgType: MiniProgramCI.IMiniappPkgType;
    remoteDebugEnable: boolean;
    useCloudUpload: boolean;
    useAab: boolean;
    packageVersion: string;
    packageDesc: string;
    recordInfo: string;
    uploadAppInfo: {
        uploadBetaVersion: boolean;
        userVersion: string;
        userDesc: string;
    };
}
export declare function buildApk(options: IBuildApkOptions): Promise<IBuildApkResult>;
export declare function generateCloudAndroidApk(ciOpts: IBuildApkOptions, buildArchiveOpts: IBuildArchiveOpts, cloudBuildInfo: IAndroidCloudBuildInfo): Promise<IBuildApkResult>;
export {};
