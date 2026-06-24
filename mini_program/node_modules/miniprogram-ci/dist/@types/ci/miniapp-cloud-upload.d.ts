import type { CIProject } from '../project/ciProject';
import { IUploadOptions } from './upload';
export interface IMiniappCloudUploadOptions extends IUploadOptions {
    project: CIProject;
    version: string;
    desc?: string;
    iOSPlatform?: boolean;
    androidPlatform?: boolean;
}
interface IMiniappCloudUploadResult {
    errmsg: string;
    success: boolean;
}
export declare function miniappCloudUpload(options: IMiniappCloudUploadOptions): Promise<IMiniappCloudUploadResult>;
export {};
