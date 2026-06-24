import { CIProject } from '../../project/ciProject';
export declare function generateMiniappIOSResources(project: CIProject, sdkVersion: string, arch: 'arm64' | 'x86', isIPad?: boolean): Promise<{
    demoIpaPath: string;
    sdkPath: string;
}>;
