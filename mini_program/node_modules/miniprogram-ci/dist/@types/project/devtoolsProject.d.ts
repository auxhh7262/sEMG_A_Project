import { BaseProject } from './baseProject';
interface IOriginDevtoolsProject {
    [key: string]: string;
}
export interface ICreateProjectOptions {
    project: IOriginDevtoolsProject;
}
export declare abstract class DevtoolsProject extends BaseProject {
    fileUtils: any;
}
export {};
