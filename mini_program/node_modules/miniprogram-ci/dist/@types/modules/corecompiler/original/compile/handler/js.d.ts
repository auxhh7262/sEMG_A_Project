import { RawSourceMap } from 'source-map';
import { MiniProgramCore, MiniProgramDevtools } from '../../../../../types';
export declare function compileJS(project: MiniProgramCore.IPreCompileProject, filePath: string, options: {
    root?: string;
    sourceCode?: string;
    setting?: MiniProgramDevtools.IProjectSetting;
    babelRoot?: string;
    onProgressUpdate?: (status: MiniProgramCore.ITaskStatus) => void;
    devToolsCompileCache?: MiniProgramCore.IDevToolsCompileCache;
}): Promise<{
    filePath: string;
    code: string;
    helpers: string[];
    map: string | RawSourceMap;
}>;
