import { MiniProgramCore } from '../types';
export type InterruptiblePromise<T> = Promise<T> & {
    abort: MiniProgramCore.FN<void>;
};
export declare const AbortEvent = "abort";
export declare abstract class InterruptibleTask {
    protected _aborted: boolean;
    protected _args: any[];
    protected _promise: Promise<any>;
    constructor(...args: any[]);
    then(onResolve: MiniProgramCore.FN<void>, onReject?: MiniProgramCore.FN<void>): Promise<void>;
    catch(onReject: MiniProgramCore.FN<void>): Promise<any>;
    abort(): void;
    abstract run(...args: any[]): Promise<any>;
}
