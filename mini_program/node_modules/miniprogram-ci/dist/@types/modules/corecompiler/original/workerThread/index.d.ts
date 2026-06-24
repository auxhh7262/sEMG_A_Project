import { MiniProgramCore } from '../../../../types';
export * from './config';
export declare function runTask(taskName: string, data: any, onUpdate?: MiniProgramCore.FN<void>): Promise<any>;
export declare function abortTask(taskName: string): void;
