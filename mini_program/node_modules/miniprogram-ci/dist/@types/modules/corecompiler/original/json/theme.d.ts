import { MiniProgramCore, AppJSON, PageJSON, ThemeJSON } from '../../../../types';
import { ReactiveProject } from './reactiveCache';
export declare const getThemeLocation: (project: ReactiveProject) => string | null;
export declare function getPluginThemeLocation(project: MiniProgramCore.IPreCompileProject): Promise<string | null>;
interface ITheme {
    themeLocation: string;
    isPlugin?: boolean;
}
export declare function checkThemeJSON(project: MiniProgramCore.IPreCompileProject, options: ITheme): ThemeJSON.IThemeJSON;
export declare function mergeThemeJSONToAppJSON(themeJson: Readonly<ThemeJSON.IThemeJSON>, appJson: Readonly<AppJSON.IAppJSON>): {
    appJSONLight: AppJSON.IAppJSON;
    appJSONDark: AppJSON.IAppJSON;
};
export declare function mergeThemeJSONToPageJSON(themeJson: ThemeJSON.IThemeJSON, pageJSON: PageJSON.IPageJSON, pageJSONFilePath: string): {
    pageJSONLight: PageJSON.IPageJSON;
    pageJSONDark: PageJSON.IPageJSON;
};
export {};
