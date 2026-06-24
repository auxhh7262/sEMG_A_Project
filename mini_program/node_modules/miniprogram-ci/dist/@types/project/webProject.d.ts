import { CIProject } from './ciProject';
export interface ICreateProjectOptions {
    projectPath: string;
    ignores?: any[];
}
export declare class WebProject extends CIProject {
    constructor(options: ICreateProjectOptions);
    get srcPath(): string;
    attr(): Promise<any>;
}
