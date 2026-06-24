interface IPluginConfig {
    provider: string;
    version: string;
    path?: string;
    contexts?: Array<{
        type: 'gameContext' | 'isolatedContext' | 'openDataContext';
    }>;
}
interface ISubPackageItem {
    independent?: boolean;
    name?: string;
    root: string;
    plugins?: {
        [alias: string]: IPluginConfig;
    };
}
export interface IGameJSON {
    deviceOrientation?: 'portrait' | 'landscape' | 'landscapeLeft' | 'landscapeRight';
    networkTimeout?: {
        request?: number;
        connectSocket?: number;
        uploadFile?: number;
        downloadFile?: number;
    };
    openDataContext?: string;
    showStatusBar?: boolean;
    workers?: string | {
        path: string;
        isSubpackage: boolean;
    };
    disableSetUserStorageFromMiniProgram?: boolean;
    permission?: {
        'scope.userLocation'?: {
            desc: string;
        };
    };
    subPackages?: Array<ISubPackageItem>;
    subpackages?: Array<ISubPackageItem>;
    loadingImageInfo?: {
        path: string;
        progressBarColor?: string;
    };
    plugins?: {
        [key: string]: IPluginConfig;
    };
    resizable?: boolean;
    lockStepOptions?: {
        gameTick?: number;
        heartBeatTick?: number;
        offlineTimeLength?: number;
        UDPReliabilityStrategy?: number;
        dataType?: "String" | "ArrayBuffer";
    };
}
export {};
