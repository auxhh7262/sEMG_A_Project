import { ISkylineFeatures, IWindow } from './appjson';
interface IOriginalPageJSON extends IWindow {
    disableScroll?: boolean;
    disableSwipeBack?: boolean;
    usingComponents?: {
        [key: string]: string;
    };
    renderer?: "skyline" | "webview" | "xr-frame" | "cover-view";
    rendererOptions?: {
        skyline?: {
            disableABTest?: boolean;
            sdkVersionBegin?: string;
            sdkVersionEnd?: string;
            iosVersionBegin?: string;
            iosVersionEnd?: string;
            androidVersionBegin?: string;
            androidVersionEnd?: string;
        } & ISkylineFeatures;
    };
    component?: boolean;
    componentGenerics?: {
        [key: string]: {
            default: string;
        } | true | null;
    };
    singlePage?: {
        navigationBarFit?: 'float' | 'squeezed';
    };
    componentFramework?: 'glass-easel' | 'exparser';
    styleIsolation?: 'isolated' | 'apply-shared' | 'page-shared' | 'shared' | 'page-isolated' | 'page-apply-shared';
    pureDataPattern?: string;
}
export interface IPageJSON extends IOriginalPageJSON {
    pageJSONLight?: IOriginalPageJSON;
    pageJSONDark?: IOriginalPageJSON;
    enablePassiveEvent?: boolean | {
        [key: string]: boolean;
    };
    style?: "v2";
    componentPlaceholder?: {
        [key: string]: string;
    };
    "mini-ios"?: IOriginalPageJSON;
    "mini-android"?: IOriginalPageJSON;
    "mini-ohos"?: IOriginalPageJSON;
    "mini-weixin"?: IOriginalPageJSON;
}
export {};
