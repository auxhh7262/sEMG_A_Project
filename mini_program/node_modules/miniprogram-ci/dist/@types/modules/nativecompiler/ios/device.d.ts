import { Recorder } from '../../../utils/progressRecorder';
import { IMiniApp } from '../../../types';
export declare function parseXctraceIOSDevicesList(text: string): IMiniApp.IOSDevice[];
export declare function getDevices(opts?: {
    miniappDirPath?: string;
    devtoolsVersion?: string;
    recorder?: Recorder;
}): Promise<IMiniApp.IOSDevice[]>;
export declare function findMatchingSimulator(simulators: {
    devices: {
        [index: string]: IMiniApp.IOSDevice[];
    };
}, findOptions?: null | {
    device?: string;
    udid?: string;
}): {
    udid: string;
    name: string;
    booted: boolean;
    version: string;
} | null | undefined;
export declare function matchingDevice(devices: IMiniApp.IOSDevice[], deviceName: string | true | undefined, recorder: Recorder): IMiniApp.IOSDevice | undefined;
export declare function formattedDeviceName(simulator: IMiniApp.IOSDevice): string;
export declare function printFoundDevices(devices: IMiniApp.IOSDevice[]): string;
