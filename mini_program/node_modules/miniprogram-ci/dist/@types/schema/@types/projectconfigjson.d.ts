export interface ISkeletonConfig {
    loading?: 'spin' | 'chiaroscuro' | 'shine' | '';
    outline?: {
        remain: boolean;
        replace: string;
    };
    text?: {
        color: string;
    };
    image?: {
        color: string;
        shape: 'circle' | 'rect' | '';
        shapeOpposite: string[];
    };
    button?: {
        color: string;
        excludes: string[];
    };
    pseudo?: {
        color: string;
        shape: 'circle' | 'rect';
    };
    excludes?: string[];
    remove?: string[];
    grayBlock?: string[];
    showNative?: boolean;
    backgroundColor?: string;
    mode?: 'fullscreen' | 'auto';
    templateName?: string;
    cssUnit?: 'rpx' | 'rem' | 'vw' | 'vh' | 'vmin' | 'vmax';
    decimal?: number;
}
export interface IProjectconfigJSON {
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
    qcloudRoot?: string;
    pluginRoot?: string;
    cloudbaseRoot?: string;
    compileType?: string;
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
        es6?: boolean;
        enhance?: boolean;
        postcss?: boolean;
        minified?: boolean;
        minifyWXSS?: boolean;
        minifyWXML?: boolean;
        uglifyFileName?: boolean;
        ignoreUploadUnusedFiles?: boolean;
        ignoreCodeQuality?: boolean;
        autoAudits?: boolean;
        urlCheck?: boolean;
        compileHotReLoad?: boolean;
        preloadBackgroundData?: boolean;
        lazyloadPlaceholderEnable?: boolean;
        useStaticServer?: boolean;
        babelSetting?: {
            outputPath?: string;
            ignore?: string[];
            disablePlugins?: any[];
        };
        useCompilerPlugins?: Array<'typescript' | 'less' | 'sass'> | false;
        disableUseStrict?: boolean;
        uploadWithSourceMap?: boolean;
        localPlugins?: boolean;
        packNpmManually?: boolean;
        packNpmRelationList?: Array<{
            packageJsonPath: string;
            miniprogramNpmDistDir: string;
        }>;
        coverView?: boolean;
        ignoreDevUnusedFiles?: boolean;
        checkInvalidKey?: boolean;
        showShadowRootInWxmlPanel?: boolean;
        useIsolateContext?: boolean;
        useMultiFrameRuntime?: boolean;
        useApiHook?: boolean;
        useApiHostProcess?: boolean;
        useLanDebug?: boolean;
        enableEngineNative?: boolean;
        showES6CompileOption?: boolean;
        minifyWXMLSetting?: {
            global: {
                collapseWhitespace?: boolean;
                conservativeCollapse?: boolean;
                preserveLineBreaks?: boolean;
            };
            [filePath: string]: {
                collapseWhitespace?: boolean;
                conservativeCollapse?: boolean;
                preserveLineBreaks?: boolean;
            };
        };
    };
    staticServerOptions?: {
        servePath?: string;
    };
    scripts?: {
        beforeCompile?: string;
        beforePreview?: string;
        beforeUpload?: string;
    };
    debugOptions?: {
        hideInDevtools?: string[];
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
    skeletonConfig?: {
        [pageName: string]: ISkeletonConfig;
        global: ISkeletonConfig;
    };
}
