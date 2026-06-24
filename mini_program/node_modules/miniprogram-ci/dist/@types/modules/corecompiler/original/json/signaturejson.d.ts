import { MiniProgramCore } from '../../../../types';
export interface IPluginWithPathInfo {
    alias: string;
    path: string;
    friendlyPath: string;
    provider: string;
    version: string;
}
export declare const trailing: (str: string, tr: string) => string;
export declare const friendlyPathMake: (rPath: string, pth: string) => string;
export declare function getAllPluginsWithPath(project: MiniProgramCore.IPreCompileProject): Promise<IPluginWithPathInfo[]>;
export declare function isPathValid(srcPath: string, str: string): boolean;
export interface IPluginWithPathSignature {
    provider: string;
    signature: Array<{
        fullPath: string;
        md5: string;
    }>;
    fullPath: string;
}
export declare function getAllPluginSignatures(project: MiniProgramCore.IPreCompileProject): Promise<IPluginWithPathSignature[]>;
