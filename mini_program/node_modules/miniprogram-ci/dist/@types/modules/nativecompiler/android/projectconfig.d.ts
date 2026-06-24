import { Recorder } from '../../../utils/progressRecorder';
import { IMiniApp } from '../../../types';
declare class ProjectConfigUtils {
    getProjectConfig(root: string, userConfig: IMiniApp.AndroidProjectParams | undefined, recorder: Recorder): IMiniApp.AndroidProjectConfig | null;
    findManifest(sourceDir: string): string | null;
    getPackageName(manifestPath: string, recorder: Recorder): string;
    validatePackageName(packageName: string): boolean;
    getAppName(sourceDir: string, userConfigAppName: string | undefined): string;
}
declare const _default: ProjectConfigUtils;
export = _default;
