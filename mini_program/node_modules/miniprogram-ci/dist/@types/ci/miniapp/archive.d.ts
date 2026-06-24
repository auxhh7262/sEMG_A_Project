import { IBuildApkOptions } from '../build-apk';
import { MiniProgramCI } from '../../types';
import { IBuildIpaOptions } from '../build-ipa';
interface IMiniappOptions {
    miniappPkgType: MiniProgramCI.IMiniappPkgType;
    lanIpPort?: string;
    useCloudSync?: boolean;
    remoteDebugEnable: boolean;
    archVersion?: 0 | 1;
    needClientJsExtInfo?: 0 | 1;
    uploadId?: string;
}
interface IUploadArchiveInfo {
    useSubPkg: boolean;
    devtoolsUrl?: string;
    remoteDebugConfig?: any;
    body?: any;
}
export interface IBuildArchiveOptions {
    version: string;
    desc: string;
    targetPlatform: 'mini-android' | 'mini-ios';
    outputDir: string;
    miniappOptions: IMiniappOptions;
    uploadArchiveInfo?: IUploadArchiveInfo;
}
export declare function getUploadOptions(): {
    appLaunchInfo: {};
    uploadType: string;
    autoTestMock: boolean;
    onProgressUpdate: (...args: any) => void;
    onFilesIgnored: () => void;
    onFilesMissing: () => void;
    remoteDebug: boolean;
    remoteProxyPort: undefined;
    disableUrlCheck: boolean;
    autoPreview: boolean;
    cdpEnabled: boolean;
    remoteAppservice: boolean;
    remoteAppserviceType: string;
    noMaps: boolean;
    showProgress: boolean;
};
export declare function buildProjectArchive(ciOpts: IBuildApkOptions | IBuildIpaOptions, opts: IBuildArchiveOptions): Promise<void>;
export {};
