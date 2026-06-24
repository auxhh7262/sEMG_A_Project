import { IProject, MiniProgramCI } from '../../types';
interface IUploadResult {
    success: boolean;
}
export interface IUploadOptions {
    project: IProject;
    pkgPath: string;
    version: string;
    desc?: string;
    robot?: number;
    onProgressUpdate?: (task: MiniProgramCI.ITaskStatus | string) => void;
}
export declare function uploadGamePkg(options: IUploadOptions): Promise<IUploadResult>;
export {};
