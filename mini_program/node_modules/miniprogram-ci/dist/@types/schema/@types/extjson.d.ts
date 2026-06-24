import { IPluginConfig, ISubPackageItem, IWindow, ITabBar, IRequirePrivateInfos } from './appjson';
import { IPageJSON } from './pagejson';
export interface IExtJSON {
    extAppid: string;
    extEnable?: boolean;
    directCommit?: boolean;
    ext?: {
        [key: string]: any;
    };
    extPages?: {
        [key: string]: IPageJSON;
    };
    __warning__?: string;
    pages?: Array<string>;
    window?: IWindow;
    plugins?: {
        [key: string]: IPluginConfig;
    };
    entryPagePath?: string;
    permission?: {
        'scope.userLocation'?: {
            desc: string;
        };
    };
    workers?: string | {
        path: string;
        isSubpackage: boolean;
    };
    subPackages?: Array<ISubPackageItem>;
    subpackages?: Array<ISubPackageItem>;
    preloadRule?: {
        [key: string]: {
            network?: 'all' | 'wifi';
            packages: Array<string>;
        };
    };
    usingComponents?: {
        [key: string]: string;
    };
    componentPlaceholder?: {
        [key: string]: string;
    };
    tabBar?: ITabBar;
    requiredBackgroundModes?: Array<string>;
    mimeTypeDeclarations?: {
        [key: string]: Array<string>;
    };
    networkTimeout?: {
        request?: number;
        connectSocket?: number;
        uploadFile?: number;
        downloadFile?: number;
    };
    debug?: boolean;
    resizable?: boolean;
    functionalPages?: boolean | {
        independent: boolean;
    };
    cloud?: boolean;
    openLocationPagePath?: string;
    sitemapLocation?: string;
    serviceProviderTicket?: string;
    style?: 'v2';
    useExtendedLib?: {
        [key: string]: boolean;
    };
    entranceDeclare?: {
        locationMessage?: {
            path?: string;
            query?: string;
        };
    };
    darkmode?: boolean;
    themeLocation?: string;
    theme?: string;
    enablePassiveEvent?: boolean | {
        [key: string]: boolean;
    };
    lazyCodeLoading?: 'requiredComponents';
    requiredPrivateInfos?: IRequirePrivateInfos;
}
