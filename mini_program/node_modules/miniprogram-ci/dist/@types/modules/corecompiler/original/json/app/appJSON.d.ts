import { AppJSON } from '../../../../../types';
import { ReactiveProject } from '../reactiveCache';
import { IInnerAppJSONCheckOptions } from './checkAppFields';
export declare function checkAppJSON(options: IInnerAppJSONCheckOptions): AppJSON.IAppJSON;
export declare const getRawAppJSON: (project: ReactiveProject) => AppJSON.IAppJSON;
export declare const getAppJSON: (project: ReactiveProject) => AppJSON.IAppJSON;
