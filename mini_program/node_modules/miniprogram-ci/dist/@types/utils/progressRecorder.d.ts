import { MiniProgramDevtools } from '../types';
export declare function getPrintTime(): string;
export declare class Recorder {
    private sendProgress;
    progress: (message: string) => void;
    message(type: MiniProgramDevtools.IBuildLogType, message: string): void;
    constructor(sendProgress: MiniProgramDevtools.ProgressUpdate);
    start(message: string): {
        (err?: any, res?: any): void;
        id: number;
    };
    run<T>(message: string, runner: () => Promise<T> | T): Promise<T>;
}
export declare const silentRecorder: Recorder;
export declare const TransformTipsURL = "https://web-v2-1g8g0y2x3197301a-1304825656.tcloudbaseapp.com/important_miniapp/MiniAppBuildTips.json?sign=0f07b014a760d699cf2c8a9bb84845bf&t=1724920547";
export declare const IOSBuildMessageCache: Record<string, string[]>;
