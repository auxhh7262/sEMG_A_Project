import { MiniProgramCore } from '../types';
import { BaseProject } from './baseProject';
export interface IStat {
    isFile: boolean;
    isDirectory: boolean;
    size?: number;
}
export type FileChange = (type: 'unlink' | 'unlinkDir' | 'add' | 'addDir' | 'change', targetPath: string) => void;
export declare class SummerCPProject extends BaseProject implements MiniProgramCore.IProject {
    constructor(projectInfo: MiniProgramCore.IProjectSerializeInfo);
    init(files: string[], dirs: string[]): Promise<void>;
    updateFileAndDirs(files: string[], dirs: string[]): void;
    private isIgnore;
}
