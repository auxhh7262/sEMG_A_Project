export interface ILogger {
    success: (...args: any[]) => void;
    info: (...args: any[]) => void;
    log: (...args: any[]) => void;
    debug: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
}
export declare const success: (...args: any[]) => void;
export declare const info: (...args: any[]) => void;
export declare const log: (...args: any[]) => void;
export declare const debug: (...args: any[]) => void;
export declare const warn: (...args: any[]) => void;
export declare const error: (...args: any[]) => void;
