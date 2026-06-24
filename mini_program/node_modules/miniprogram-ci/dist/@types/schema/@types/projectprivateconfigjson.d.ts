export interface IProjectprivateconfigJSON {
    projectArchitecture?: 'miniProgram' | 'mulitPlatform';
    libVersion?: 'latest' | 'trial' | 'widelyUsed' | 'development' | '' | `${number}.${number}.${number}`;
    editorSetting?: {
        tabIndent?: 'tab' | 'auto' | 'insertSpaces';
        tabSize?: '\t' | number;
    };
    cloudfunctionRoot?: string;
    cloudfunctionTemplateRoot?: string;
    cloudcontainerRoot?: string;
    srcMiniprogramRoot?: string;
    description?: string;
    simulatorType?: string;
    simulatorPluginLibVersion?: any;
    miniprogramRoot?: string;
    pluginRoot?: string;
    pluginAppid?: string;
    jsserverRoot?: string;
    projectname?: string;
    appid?: string;
    packOptions?: {
        ignore?: Array<{
            type: string;
            value: string;
        }>;
        include?: Array<{
            type: string;
            value: string;
        }>;
    };
    watchOptions?: {
        ignore?: Array<string>;
    };
    setting?: {
        autoAudits?: boolean;
        urlCheck?: boolean;
        compileHotReLoad?: boolean;
        preloadBackgroundData?: boolean;
        lazyloadPlaceholderEnable?: boolean;
        useStaticServer?: boolean;
        coverView?: boolean;
        ignoreDevUnusedFiles?: boolean;
        ignoreCodeQuality?: boolean;
        checkInvalidKey?: boolean;
        showShadowRootInWxmlPanel?: boolean;
        useIsolateContext?: boolean;
        useMultiFrameRuntime?: boolean;
        useApiHook?: boolean;
        useApiHostProcess?: boolean;
        useLanDebug?: boolean;
        enableEngineNative?: boolean;
        showES6CompileOption?: boolean;
    };
    staticServerOptions?: {
        servePath?: string;
    };
    condition?: {
        game?: {
            current?: number;
            list?: Array<{
                name?: string;
                pathName?: string;
                query?: string;
                scene?: string | number | null;
                shareInfo?: any;
                referrerInfo?: any;
                chatroomUsernameInfo?: any;
                groupInfo?: any;
            }>;
        };
        gamePlugin?: {
            current?: number;
            list?: Array<{
                name?: string;
                query?: string;
                scene?: string | number | null;
                shareInfo?: any;
                referrerInfo?: any;
                groupInfo?: any;
            }>;
        };
        plugin?: {
            current?: number;
            list?: Array<{
                name?: string;
                pathName?: string;
                query?: string;
                launchMode?: string;
                scene?: string | number | null;
                shareInfo?: any;
                referrerInfo?: any;
                groupInfo?: any;
            }>;
        };
        miniprogram?: {
            current?: number;
            list?: Array<{
                name?: string;
                pathName?: string;
                query?: string;
                launchMode?: string;
                scene?: string | number | null;
                partialCompile?: {
                    enabled?: boolean;
                    pages?: any[];
                };
                shareInfo?: any;
                referrerInfo?: any;
                chatroomUsernameInfo?: any;
                groupInfo?: any;
            }>;
        };
    };
}
