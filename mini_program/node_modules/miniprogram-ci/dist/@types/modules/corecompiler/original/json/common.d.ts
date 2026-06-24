import { AppJSON, IGameJSON, MiniProgramCore, PageJSON } from '../../../../types';
import { ReactiveProject } from './reactiveCache';
export declare function checkJSONFormat(code: string, filePath: string): MiniProgramCore.IAnyObject;
export declare function checkPagePathIsInSubPackage(appJSON: AppJSON.IAppJSON, pathName: string): undefined | AppJSON.ISubpackageItem;
export declare function checkPagePathIsInIndependentSubpackage(appJSON: AppJSON.IAppJSON, pathName: string): undefined | AppJSON.ISubpackageItem;
export declare function checkFilePathIsInIndependentSubpackage(appOrGameJSON: AppJSON.IAppJSON | IGameJSON, pathName: string): string | undefined;
export declare const getUseExtendLib: (project: MiniProgramCore.IPreCompileProject, pagePath: string) => string[];
export declare const checkComponentPath: (options: {
    project: MiniProgramCore.IPreCompileProject | ReactiveProject;
    root: string;
    relativePath: string;
    inputJSON: MiniProgramCore.IAnyObject;
}) => void;
interface IVariableDeclareProperty {
    property: string;
    value: string;
}
export declare function getPageJSONVariableDecalearProperty(pageJSON: PageJSON.IPageJSON): IVariableDeclareProperty[];
export {};
