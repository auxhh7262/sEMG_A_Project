import { IMiniApp } from '../../types';
import { IBuildIpaOptions } from '../build-ipa';
import { IBuildArchiveOpts } from '../build-apk';
declare class IOSLocalBuild {
    private iosDir;
    private project;
    private ciOpts;
    constructor(ciOpts: IBuildIpaOptions);
    buildArchive(demoIpaPath: string, opts: IBuildArchiveOpts): Promise<void>;
    build(archiveOpts: IBuildArchiveOpts, buildArgs: IMiniApp.IIOSBuildCloudArgs, demoIpaPath: string): Promise<void>;
}
export declare const getIOSLocalBuild: (ciOpts: IBuildIpaOptions) => IOSLocalBuild;
export {};
