import { MiniProgramDevtools } from '../devtools';
export declare namespace ProjectConfigJSON {
    type IProjectArchitecture = 'miniProgram' | 'multiPlatform';
    interface IProjectConfigPackOption {
        type: string;
        value: string;
    }
    interface IProjectConfigJSON {
        appid?: string;
        miniprogramRoot?: string;
        pluginRoot?: string;
        pluginAppid?: string;
        jsserverRoot?: string;
        compileType?: string;
        packOptions?: {
            ignore: IProjectConfigPackOption[];
            include: IProjectConfigPackOption[];
        };
        setting?: MiniProgramDevtools.IProjectSetting;
        projectArchitecture?: IProjectArchitecture;
    }
}
