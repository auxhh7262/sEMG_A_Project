import { Recorder } from '../../../utils/progressRecorder';
export declare function getAdbPath(): string;
export declare function tryRunAdbReverse(data: {
    packagerPort: number | string;
    device?: string | void;
    recorder: Recorder;
}): void;
