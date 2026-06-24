import type { IBuildApkOptions, IAndroidCloudBuildInfo, IBuildArchiveOpts } from '../build-apk';
import type { IIOSCloudBuildInfo, IBuildIpaOptions } from '../build-ipa';
export declare const defaulPasswordPlaceHolderForCache = "*******";
export declare const publicKeyForP12password = "-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDRsmgcQqaCjlFVITfAzIWsjpxj\nynoXetXQhmIspi86V6rtq2BENl9HrrX18XsQ8Qn6jsNJ6mtvSUUflvpLnEQMM1M7\nwagNazL0A2KFw97Br9sE+CVJdctC/dmportNjrbekNYHacT1bL+GDpatAaD4Pnwy\nx3yJsmqx3tJun1G++wIDAQAB\n-----END PUBLIC KEY-----\n";
export interface IIOSRemoteCloudBuildInfo {
    useRemote?: boolean;
    p12?: string;
    p12password?: string;
    p12passwordEncrypted?: string;
    certificate?: string;
    profile?: string;
    tpnsProfile?: string;
}
export declare enum IMiniappPkgType {
    'Release' = "Release",
    'Debug' = "Debug",
    'HotReload' = "HotReload"
}
export declare const transformAndroidBuildArgument: (opts: IBuildApkOptions) => {
    buildArchiveOpts: IBuildArchiveOpts;
    cloudBuildInfo: IAndroidCloudBuildInfo;
};
export declare const transformIOSBuildArgument: (opts: IBuildIpaOptions) => {
    buildArchiveOpts: IBuildArchiveOpts;
    cloudBuildInfo: IIOSCloudBuildInfo;
};
