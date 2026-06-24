import { IProject } from '../types';
interface IUploadOptions {
    project: IProject;
    env: 'test' | 'release';
    robot?: number;
}
export declare function uploadJsServer(options: IUploadOptions): Promise<true>;
export {};
