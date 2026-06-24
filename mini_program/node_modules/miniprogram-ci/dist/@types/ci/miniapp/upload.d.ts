import { IBuildArchiveOptions } from './archive';
import { IBuildApkOptions } from '../build-apk';
import { IBuildIpaOptions } from '../build-ipa';
import { IMiniappCloudUploadOptions } from '../miniapp-cloud-upload';
type IMiniAppUploadArchiveOptions = (IBuildApkOptions | IBuildIpaOptions | IMiniappCloudUploadOptions) & IBuildArchiveOptions;
type TSubPackageInfo = Array<{
    name: string;
    size: number;
}>;
type TPluginInfo = Array<{
    pluginProviderAppid: string;
    version: string;
    size: number;
}>;
interface IUploadResult {
    subPackageInfo?: TSubPackageInfo;
    pluginInfo?: TPluginInfo;
    devPluginId?: string;
    useSubPkg?: boolean;
}
interface IInnerUploadResult extends IUploadResult {
    respBody?: any;
}
export declare function upload(options: IMiniAppUploadArchiveOptions): Promise<IInnerUploadResult>;
export {};
