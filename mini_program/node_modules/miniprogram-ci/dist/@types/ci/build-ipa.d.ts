import { IMiniApp, MiniProgramCI } from '../types';
import type { CIProject } from '../project/ciProject';
import { IUploadOptions } from './upload';
export interface IBuildIpaOptions extends IUploadOptions {
    project: CIProject;
    output: string;
    isDistribute?: boolean;
    isRemoteBuild?: boolean;
    profilePath: string;
    certificateName: string;
    p12Path: string;
    p12Password: string;
    tpnsProfilePath?: string;
    desc?: string;
    isUploadBeta?: boolean;
    isUploadResourceBundle?: boolean;
    resourceBundleVersion?: string;
    resourceBundleDesc?: string;
    resourceDir?: string;
    disableCache?: boolean;
}
interface IBuildIpaResult {
    errmsg: string;
    success: boolean;
}
export interface IIOSCloudBuildInfo {
    certificateInfo: {
        signType: IMiniApp.ISignType;
        selfCertificate: IMiniApp.ISelfCertificate;
    };
    miniappPkgType: MiniProgramCI.IMiniappPkgType;
    remoteDebugEnable: boolean;
    useCloudUpload: boolean;
    packageVersion: string;
    packageDesc: string;
    recordInfo: string;
    uploadAppInfo: {
        uploadBetaVersion: boolean;
        userVersion: string;
        userDesc: string;
    };
    useRemoteCloudBuild: boolean;
}
export declare function buildIpa(options: IBuildIpaOptions): Promise<IBuildIpaResult>;
export {};
