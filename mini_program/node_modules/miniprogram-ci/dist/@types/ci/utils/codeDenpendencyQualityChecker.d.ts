import { Analyzer } from '../../common/code-analyse';
import { IProject } from '../../types';
export declare class CodeDenpendencyQualityChecker {
    private analyzer;
    private subpackageRoots?;
    private babelRoot;
    constructor(project: IProject, analyzer: Analyzer);
    checkUnusedCodeFiles(): string[];
    checkUnusedMiniProgramCodeFiles(): string[];
    checkOnlyUsedByOtherPackagesJs(): {
        size: number;
        files: string[];
    };
    checkMainPackageUnusedComponents(): {
        size: number;
        files: string[];
        comps: string[];
    };
    checkUnusedPlugins(): Promise<string[]>;
    checkUnusedComponents(): Promise<string[]>;
    private get graph();
    private getSubpackageRoots;
    private isLocateInMainPackage;
    caculateFilesSize(files: string[]): number;
    caculateResourceFileSize(extList: string[]): number;
    caculatePackageSize(): {
        [key: string]: number;
    };
    private collectCompsFiles;
    private reservedFile;
}
