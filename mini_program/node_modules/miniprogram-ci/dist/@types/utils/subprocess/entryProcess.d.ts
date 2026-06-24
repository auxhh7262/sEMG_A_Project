interface IOptions {
    initHandler: any;
    messageHandler: any;
    timeout?: number;
}
export declare function runSubProcess(options: IOptions): void;
export {};
