import { MiniProgramCore } from '../../../../types';
export declare function packNpm(project: MiniProgramCore.IPreCompileProject, opts?: MiniProgramCore.IPackNpmOptions): Promise<MiniProgramCore.IWarnItem[]>;
interface IPackNpmManuallyResult {
    miniProgramPackNum: number;
    otherNpmPackNum: number;
    warnList: MiniProgramCore.IWarnItem[];
}
export declare function packNpmManually(options: {
    packageJsonPath: string;
    miniprogramNpmDistDir: string;
    ignores?: string[];
}): Promise<IPackNpmManuallyResult>;
export {};
