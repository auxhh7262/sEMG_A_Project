import { MiniProgramCI } from '../types';
type ReportAction = 'preview' | 'upload' | 'npm' | 'cloud' | 'getDevSourceMap' | 'buildApk' | 'buildIpa' | 'miniappCloudUpload';
export declare function reportAction(action: ReportAction, retcode: number, retmsg: string, spendtime: number, project: MiniProgramCI.IProject, setting?: MiniProgramCI.ICompileSettings): void;
export declare function wrapReport<T extends Function>(action: ReportAction, method: T): T;
export {};
