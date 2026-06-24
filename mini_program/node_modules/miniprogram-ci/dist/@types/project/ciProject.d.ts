import { MiniProgramCore, MiniProgramDevtools } from '../types';
import { BaseProject } from './baseProject';
type ProjectType = MiniProgramCore.ProjectType;
export interface ICreateProjectOptions {
    projectPath: string;
    type: ProjectType;
    appid: string;
    privateKey?: string;
    privateKeyPath?: string;
    ignores?: string[];
    targetPlatform?: MiniProgramCore.ITargetPlatform;
    compileDefines?: {
        [key: string]: string;
    };
    packOptions?: {
        ignore: MiniProgramDevtools.IProjectConfigPackOption[];
        include: MiniProgramDevtools.IProjectConfigPackOption[];
    };
}
export { getProjectAttr, } from '../ci/projectattr';
export declare class CIProject extends BaseProject {
    private _project;
    private _miniappAttr?;
    targetPlatform?: MiniProgramCore.ITargetPlatform;
    constructor(options: ICreateProjectOptions);
    get project(): BaseProject;
    init(): Promise<void>;
    updateFileAndDirs(): void;
    attr(): Promise<any>;
    getExtAppid(): Promise<string | void>;
    isMiniappProject(): boolean;
    miniappAttr(): Promise<any>;
    serialize(): Promise<MiniProgramCore.IPrecompileProjectSerializeInfo>;
}
