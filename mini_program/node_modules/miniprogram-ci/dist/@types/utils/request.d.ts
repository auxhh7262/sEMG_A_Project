import { MiniProgramCore } from '../types';
import { InterruptiblePromise } from './interruptibletask';
import type { OptionsWithUrl, RequestCallback } from 'request';
import req = require('request');
interface IRequestOptions {
    url: string;
    method: 'post' | 'get';
    formData?: MiniProgramCore.IAnyObject;
    body?: any;
    gzip?: boolean;
    project?: MiniProgramCore.IProject;
    needRandom?: number;
    needAppID?: number;
    needToken?: number;
    headers?: MiniProgramCore.IAnyObject;
}
export declare function request<T>(opt: IRequestOptions): InterruptiblePromise<T>;
export declare function setCiProxy(proxy: string): void;
export declare function getCiProxy(): string;
export declare function initGlobalProxy(): void;
export declare function simpleRequest(options: OptionsWithUrl, callback: RequestCallback): req.Request | Promise<never>;
export {};
