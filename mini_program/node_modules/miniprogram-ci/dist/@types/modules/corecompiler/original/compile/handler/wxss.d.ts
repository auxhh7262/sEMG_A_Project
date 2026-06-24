import { MiniProgramCore, MiniProgramDevtools } from '../../../../../types';
export declare function compileWXSS(project: MiniProgramCore.IPreCompileProject, filePath: string, options: {
    root?: string;
    setting?: MiniProgramDevtools.IProjectSetting;
    onProgressUpdate?: (status: MiniProgramCore.ITaskStatus) => void;
    devToolsCompileCache?: MiniProgramCore.IDevToolsCompileCache;
}): Promise<{
    filePath: string;
    code: string;
}>;
