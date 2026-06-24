import { IBuildIpaOptions } from '../build-ipa';
export declare enum OS_TYPE_ENUM {
    IOS = "1",
    ANDROID = "2"
}
declare class MiniappPluginManager {
    private WeappMiniApp;
    private project;
    private ciOpts;
    constructor(ciOpts: IBuildIpaOptions);
    getUsedPluginVersionInfo(data: {
        osType: OS_TYPE_ENUM;
        pluginList: Array<{
            plugin_id: string;
            version: string;
        }>;
    }): Promise<any>;
    downloadMiniAppPlugin(data: {
        osType: OS_TYPE_ENUM;
        pluginList: Array<{
            plugin_id: string;
            version: string;
        }>;
    }): Promise<unknown>;
    removePluginDir(type: OS_TYPE_ENUM, pluginId: string): Promise<void>;
    downloadPlugin(type: OS_TYPE_ENUM): Promise<void>;
    getPluginDirList(type: OS_TYPE_ENUM): Promise<{
        dir: string;
        pluginId: any;
    }[]>;
}
export declare const getMiniappPluginManager: (ciOpts: IBuildIpaOptions) => MiniappPluginManager;
export {};
