import { IProject } from '../../types';
export declare function innerRequest<T>(url: string, body: any): Promise<T>;
export interface IGetGamePkgListOptions {
    project: IProject;
}
export declare function getGamePkgList(project: IProject): Promise<{
    success: boolean;
    errmsg: any;
    list: any;
}>;
export declare function getGamePkgUrl(project: IProject, userVersion: string): Promise<{
    success: boolean;
    errmsg: any;
    url: any;
}>;
export declare function checkGamePkgUserVersion(project: IProject, userVersion: string): Promise<{
    success: boolean;
    errmsg: any;
}>;
