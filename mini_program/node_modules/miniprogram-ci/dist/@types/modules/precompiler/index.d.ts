import { MiniProgramCI, MiniProgramCore } from '../../types';
import { PreCompileProject } from '../../project/advance/precompileProject';
import { IConsoleDisplay, IMessageHub } from '../../utils/messageHub';
export declare class PreCompiler {
    project: MiniProgramCI.IProject;
    devtoolMessagehub?: IMessageHub;
    consoleDisplay?: IConsoleDisplay;
    constructor(project: MiniProgramCI.IProject, devtoolMessagehub: IMessageHub | undefined, consoleDisplay: IConsoleDisplay | undefined);
    getPreCompileProject(opts?: MiniProgramCore.IConditionCompileInfo): Promise<PreCompileProject>;
}
export { ConditionCompiler } from './conditioncompile';
