import { ISchema, IValidateResult } from '../../../../schema/dist';
export declare const config: {
    [key: string]: ISchema;
};
export type FILE = 'app' | 'ext' | 'game' | 'page' | 'plugin' | 'pluginpage' | 'projectconfig' | 'sitemap' | 'theme';
export declare function schemaValidate(file: FILE, instance: any): IValidateResult;
export declare function transValidateResult(filePath: string, validateResult: IValidateResult, dontThrow?: boolean): string;
export declare const NEW_CHECK_JSON_WAY = true;
