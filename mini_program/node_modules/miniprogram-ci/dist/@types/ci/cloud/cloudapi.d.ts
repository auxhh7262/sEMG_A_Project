import * as cloudAPI from '../../common/cloud-api/index';
import { MiniProgramCI } from '../../types';
export declare function initCloudAPI(appid: string): void;
export declare function get3rdCloudCodeSecret(project: MiniProgramCI.IProject): Promise<any>;
export declare function boundTransactRequest(project: MiniProgramCI.IProject): (options: cloudAPI.IRequestOptions & {
    project?: MiniProgramCI.IProject;
}) => Promise<any>;
