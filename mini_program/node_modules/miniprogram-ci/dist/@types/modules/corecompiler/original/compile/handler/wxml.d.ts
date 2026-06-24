import { MiniProgramCore, MiniProgramDevtools } from '../../../../../types';
export declare function compileWXML(project: MiniProgramCore.IPreCompileProject, filePath: string, options: {
    root?: string;
    setting?: MiniProgramDevtools.IProjectSetting;
    onProgressUpdate?: (status: MiniProgramCore.ITaskStatus) => void;
}): Promise<{
    filePath: string;
    code: string;
}>;
