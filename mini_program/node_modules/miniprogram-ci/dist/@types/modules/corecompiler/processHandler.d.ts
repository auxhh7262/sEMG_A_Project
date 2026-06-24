import { MiniProgramDevtools } from '../../types';
export declare function initHandler(message: MiniProgramDevtools.InitMsg): Promise<void>;
export declare function destroy(): Promise<void>;
export declare const onMessage: (fn: (...args: any[]) => any) => void;
export declare function messageHandler(message: MiniProgramDevtools.SummerProcessMessage): Promise<void>;
