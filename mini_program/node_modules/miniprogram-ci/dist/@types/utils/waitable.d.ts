import { MiniProgramCore } from '../types';
declare class WaitAble {
    protected _ready: boolean;
    protected _waitForReadyQueue: Array<{
        resolve: MiniProgramCore.FN<void>;
        reject: MiniProgramCore.FN<any>;
    }>;
    wait(fn?: MiniProgramCore.FN): Promise<any>;
    makeReady(result?: any): void;
    makeError(error: Error): void;
}
export default WaitAble;
