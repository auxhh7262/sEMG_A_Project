/**
 * Checks whether the given request is meant to be intercepted by the sync-message serviceWorkerFetchListener.
 */
export declare function isServiceWorkerRequest(request: FetchEvent | string): boolean;
/**
 * Returns a function that can respond to fetch events in a service worker event listener.
 * The function returns true if the request came from this library and it responded.
 * Call `serviceWorkerFetchListener` and reuse the returned function as it manages internal state.
 */
export declare function serviceWorkerFetchListener(): (e: FetchEvent) => boolean;
/**
 * Convenience function that allows writing `await asyncSleep(1000)`
 * to wait one second before continuing in an async function.
 */
export declare function asyncSleep(ms: number): Promise<unknown>;
/**
 * Options for making an atomics type channel.
 */
export interface AtomicsChannelOptions {
    bufferSize?: number;
}
/**
 * Options for making a serviceWorker type channel.
 */
export interface ServiceWorkerChannelOptions {
    scope?: string;
    timeout?: number;
}
interface AtomicsChannel {
    type: "atomics";
    data: Uint8Array;
    meta: Int32Array;
}
interface ServiceWorkerChannel {
    type: "serviceWorker";
    baseUrl: string;
    timeout: number;
}
export declare class ServiceWorkerError extends Error {
    url: string;
    status: number;
    readonly type = "ServiceWorkerError";
    constructor(url: string, status: number);
}
export declare type Channel = AtomicsChannel | ServiceWorkerChannel;
export declare function writeMessageAtomics(channel: AtomicsChannel, message: any): void;
export declare function writeMessageServiceWorker(channel: ServiceWorkerChannel, message: any, messageId: string): Promise<void>;
/**
 * Call this in the browser's main UI thread
 * to send a message to the worker reading from the channel with `readMessage`.
 *
 * @param channel a non-null object returned by `makeChannel`, `makeAtomicsChannel`, or `makeServiceWorkerChannel`.
 * @param message any object that can be safely passed to `JSON.stringify` and then decoded with `JSON.parse`.
 * @param messageId a unique string identifying the message that the worker is waiting for.
 *                  Currently only used by service worker channels.
 */
export declare function writeMessage(channel: Channel, message: any, messageId: string): Promise<void>;
/**
 * Accepts one optional argument `options` with optional keys for configuring the different types of channel.
 * See the types `AtomicsChannelOptions` and `ServiceWorkerChannelOptions` for more info.
 *
 * If `SharedArrayBuffer` is available, `makeChannel` will use it to create an `atomics` type channel.
 * Otherwise, if `navigator.serviceWorker` is available, it will create a `serviceWorker` type channel,
 * but registering the service worker is up to you.
 * If that's not available either, it'll return `null`.
 *
 * Channel objects have a `type` property which is either `"atomics"` or `"serviceWorker"`.
 * The other properties are for internal use.
 *
 * If you want to control the type of channel,
 * you can call `makeAtomicsChannel` or `makeServiceWorkerChannel` directly.
 *
 * A single channel object shouldn't be used by multiple workers simultaneously,
 * i.e. you should only read/write one message at a time.
 */
export declare function makeChannel(options?: {
    atomics?: AtomicsChannelOptions;
    serviceWorker?: ServiceWorkerChannelOptions;
}): Channel | null;
export declare function makeAtomicsChannel({ bufferSize, }?: AtomicsChannelOptions): AtomicsChannel;
export declare function makeServiceWorkerChannel(options?: ServiceWorkerChannelOptions): ServiceWorkerChannel;
/**
 * Call this in a web worker to synchronously receive a message sent by the main thread with `writeMessage`.
 *
 * @param channel a non-null object returned by `makeChannel`, `makeAtomicsChannel`, or `makeServiceWorkerChannel`.
 *                Should be created once in the main thread and then sent to the worker.
 * @param messageId a unique string identifying the message that the worker is waiting for.
 *                  Currently only used by service worker channels.
 *                  Typically created in the worker using the `uuidv4` function and then sent to the main thread
 *                  *before* calling `readMessage`.
 * @param checkInterrupt a function which may be called regularly while `readMessage`
 *                       is checking for messages on the channel.
 *                       If it returns `true`, then `readMessage` will return `null`.
 * @param timeout a number of milliseconds.
 *                If this much time elapses without receiving a message, `readMessage` will return `null`.
 */
export declare function readMessage(channel: Channel, messageId: string, { checkInterrupt, checkTimeout, timeout, }?: {
    checkInterrupt?: () => boolean;
    checkTimeout?: number;
    timeout?: number;
}): any;
/**
 * Synchronously waits until the given time has elapsed without wasting CPU in a busy loop,
 * but not very accurate.
 */
export declare function syncSleep(ms: number, channel: Channel): void;
/**
 * Returns a unique random string in UUID v4 format.
 * Uses `crypto.randomUUID` directly if possible.
 * Otherwise uses a custom implementation which uses `crypto.getRandomValues`.
 */
export declare let uuidv4: () => string;
export {};
