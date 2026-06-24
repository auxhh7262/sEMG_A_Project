type ProcessEnv = 'main' | 'childprocess' | 'workerthread' | 'workerprocess';
type HostEnv = 'devtools' | 'webide' | 'ci';
export declare const processEnv: ProcessEnv;
export declare const hostEnv: HostEnv;
export declare const summerProcess: boolean;
export declare const nativeProcess: boolean;
export {};
