import { MiniProgramCI, MiniProgramCore } from '../../types';
export declare const transProgressUpdate: (progressUpdate: (taskStatus: MiniProgramCI.ITaskStatus | string) => void) => (coreTaskStatus: MiniProgramCore.ITaskStatus) => void;
