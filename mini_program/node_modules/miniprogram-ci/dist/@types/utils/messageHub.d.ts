import { MiniProgramCore, MiniProgramDevtools } from '../types';
export type IBuildLogType = MiniProgramDevtools.IBuildLogType;
export interface IMessageHub {
    showStatus?: (id: number, message: string, type?: 'info' | 'success' | 'fail') => void;
    hideStatus?: (id: number) => void;
    showBuildLog: (msgId: string, type: IBuildLogType, text: string) => void;
}
export declare class MessageHub {
    private devtoolMessagehub;
    constructor(devtoolMessagehub: IMessageHub);
    showStatus(id: number, message: string, type?: string): void;
    hideStatus(id: number): void;
    showBuildLog(id: string, type: IBuildLogType, message: string): void;
}
export interface IConsoleDisplay {
    display: MiniProgramCore.FN<void>;
}
