import { Recorder } from './progressRecorder';
export declare function spawnSync(cmd: string, args: string[], opts: any, recorder?: Recorder): Promise<unknown>;
export declare function spawnSyncExecShell(cmd: string, args: string[], opts: any, recorder?: Recorder): Promise<unknown>;
