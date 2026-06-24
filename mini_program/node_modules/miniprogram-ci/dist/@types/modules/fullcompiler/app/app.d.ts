import { AppJSON, BaseInfo } from '../../../types';
interface IStandaloneAppJson {
    miniModuleId: string;
    nickname: string;
    device_orientation: string;
    appVersion: string | number;
    pkgInfos: Array<{
        miniModuleId: string;
        pkgType: number;
        appVersion: number;
        versionType: number;
        moduleName?: string;
        pkgMd5: string;
        assetPath: string;
        signVersion: number;
        signFilePath: string;
    }>;
    contactBase64: string;
    launchBase64: string;
    cpfWxaAttrSyncResponse: string;
    version: number;
    devtoolsLocalServerUrl?: string;
    remoteDebugWsEndpoint?: string;
    miniappPkgType: IMiniappPkgType;
    devtoolsPlatform: 'Windows' | 'Mac';
    appClientPortForRemoteDebugServer?: string;
    appClientPortForotReloadServer?: string;
}
export interface IPkgModule {
    name: string;
    filePath: string;
    pkgType: number;
    md5: string;
    size: number;
    independent: boolean;
    page_count: number;
    alias: string[];
    wxacode_lib_info_list: string[];
    without_lib_md5: string;
    separated_plugin_list: string[];
    md5_list: string[];
    widget_list: [];
    buildVersion?: number;
    signVersion?: number;
    signFilePath?: string;
}
export declare enum IMiniappPkgType {
    'Release' = "Release",
    'Debug' = "Debug",
    'HotReload' = "HotReload"
}
export declare enum IMiniappConnectType {
    'USB' = "USB",
    'LAN' = "LAN"
}
export interface ISubPkg {
    file: string;
    type: number;
    name: string;
    signVersion: number;
    signFile: string;
    md5: string;
    versionType?: IMiniappPkgType;
}
export declare function packAllPackagesToWxapkg(distPath: string, appJson: AppJSON.IAppJSON, appid: string): Promise<{
    wholePkgMd5: string;
    moduleListConfig: IPkgModule[];
}>;
interface ISubPackageAppInfo {
    miniModuleId: string;
    nickName: string;
    brandIconURL: string;
    pageOrientation: BaseInfo.PageOrientation;
    buildVersion: number;
    subpkgs: ISubPkg[];
    contact: string;
    cpfWxaAttrSyncResponse: string;
    miniappPkgType: IMiniappPkgType;
    miniappConnectType?: IMiniappConnectType;
}
export declare function generateSubPkgAppInfoJson(data: ISubPackageAppInfo): Promise<IStandaloneAppJson>;
export {};
