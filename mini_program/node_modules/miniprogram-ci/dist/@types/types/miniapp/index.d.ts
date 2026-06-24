export declare namespace IMiniApp {
    type IBuileType = 'LOCAL' | 'CLOUD';
    type IDeviceType = 'simulator' | 'device' | 'catalyst';
    type ISignType = 'appleId' | 'certificate';
    type ISelfCertificate = {
        certificatePath?: string;
        certificatePassword?: string;
        profilePath?: string;
        isPublish?: boolean;
        certificateName?: string;
        auto?: boolean;
    };
    interface IAndroidCertificate {
        keyStore: string;
        storePass: string;
        keyPass: string;
        keyAlias: string;
    }
    interface ISignCertficateInfo {
        signType: ISignType;
        appleIdInfo: {
            appleId?: string;
            password?: string;
        };
        selfCertificate: ISelfCertificate;
        androidCertificate: IAndroidCertificate;
    }
    interface IAndroidRunLocalSimpleArgs {
        buildType: IBuileType;
        device: string;
    }
    type IAndroidRunLocalArgs = IAndroidRunLocalSimpleArgs & {
        projectPath: string;
        variant: string;
        mainActivity: string;
    };
    interface IAndroidRunCloudSimpleArgs {
        buildType: IBuileType;
        deviceType: IDeviceType;
        device: string;
    }
    type IAndroidRunCloudArgs = IAndroidRunCloudSimpleArgs & {
        projectPath: string;
    };
    interface IAndroidBuildLocalSimpleArgs {
        buildType: IBuileType;
    }
    type IAndroidBuildLocalArgs = IAndroidBuildLocalSimpleArgs & {
        projectPath: string;
        variant: string;
    };
    interface IAndroidBuildPluginArgs {
        projectPath: string;
        pluginId: string;
        gradleArgs?: string[];
    }
    interface IAndroidBuildCloudSimpleArgs {
        buildType: IBuileType;
    }
    type IAndroidBuildCloudArgs = IAndroidBuildCloudSimpleArgs & {
        projectPath: string;
        variant: string;
    };
    interface AndroidProjectConfig {
        sourceDir: string;
        appName: string;
        packageName: string;
    }
    type AndroidProjectParams = {
        sourceDir?: string;
        appName?: string;
        manifestPath?: string;
        packageName?: string;
    };
    type IIOSPluginDir = {
        pluginId: string;
        dir: string;
    };
    type IIOSRunLocalSimpleArgs = {
        buildType: IBuileType;
        device?: string;
        udid?: string;
    };
    type IIOSRunLocalArgs = IIOSRunLocalSimpleArgs & {
        projectPath: string;
        scheme: string;
    };
    type ITheme = 'Light' | 'LightSpecial' | 'Dark' | 'DarkSpecial' | 'Default';
    interface IIOSRunCloudSimpleArgs {
        buildType: IBuileType;
        deviceType: IDeviceType;
        device?: string;
        udid?: string;
        demoIpaPath: string;
        sdkPath: string;
        miniappCacheDirPath: string;
        arch?: string;
        bindingInfo: any;
        certificateInfo: ISignCertficateInfo;
        pluginDirList: IIOSPluginDir[];
        theme: ITheme;
        i18nInfo: II18NInfo;
        debugInfo?: IDebugInfo;
        cacheAssetCarPath?: string;
    }
    type IIOSRunCloudArgs = IIOSRunCloudSimpleArgs & {
        projectPath: string;
    };
    type IIOSBuildLocalSimpleArgs = {
        buildType: IBuileType;
        output: string;
    };
    type IIOSBuildLocalArgs = IIOSBuildLocalSimpleArgs & {
        projectPath: string;
        scheme: string;
        exportOptionPlistPath?: string;
    };
    type CodesignIpaArgs = {
        projectPath: string;
        demoIpaPath: string;
        miniappCacheDir: string;
        opts: {
            output: string;
            outputAppWithName?: string;
            bundleId?: string;
            certificate?: string;
            profile?: string;
            tpnsProfile?: string;
        };
        isUsingTpush: boolean;
        _inLandun?: boolean;
    };
    type ITranslations = {
        common?: Record<string, string>;
        ios?: Record<string, string>;
        android?: Record<string, string>;
    };
    type II18NInfo = Record<string, ITranslations>;
    type IDebugInfo = {
        debugType: 'HotReload' | 'Release' | 'RemoteDebug' | 'Debug';
    };
    type IIOSBuildCloudSimpleArgs = {
        buildType: IBuileType;
        output: string;
        demoIpaPath: string;
        sdkPath: string;
        miniappCacheDirPath: string;
        arch?: string;
        bindingInfo: any;
        certificateInfo: ISignCertficateInfo;
        pluginDirList: IIOSPluginDir[];
        theme: ITheme;
        i18nInfo: II18NInfo;
        debugInfo?: IDebugInfo;
        cacheAssetCarPath?: string;
    };
    type IIOSBuildCloudArgs = IIOSBuildCloudSimpleArgs & {
        projectPath: string;
        inLandun?: boolean;
        CILocalBuild?: boolean;
    };
    type IIOSBuildCloudGenMaterialArgs = IIOSBuildCloudArgs & {
        matrialDistPath: string;
    };
    type IIOSBuildExportOptionPlist = {
        compileBitcode?: boolean;
        destination?: 'export' | 'upload';
        method?: 'app-store' | 'validation' | 'ad-hoc' | 'package' | 'enterprise' | 'development' | 'developer-id' | 'mac-application';
        distributionBundleIdentifier?: string;
        teamID: string;
        provisioningProfiles: {
            key: string;
            value: string;
        };
        signingStyle?: 'manual' | 'automatic';
        signingCertificate?: string;
        thinning?: boolean;
        stripSwiftSymbols?: boolean;
        uploadSymbols?: boolean;
        generateAppStoreInformation?: boolean;
    };
    interface IOSProjectParams {
        sourceDir?: string;
    }
    interface IOSProjectConfig {
        sourceDir: string;
        name: string;
        isWorkspace: boolean;
    }
    type IOSScriptPhase = ({
        script: string;
    } | {
        path: string;
    }) & {
        name: string;
        shell_path?: string;
        input_files?: string[];
        output_files?: string[];
        input_file_lists?: string[];
        output_file_lists?: string[];
        show_env_vars_in_log?: boolean;
        dependency_file?: string;
        execution_position?: 'before_compile' | 'after_compile' | 'any';
    };
    interface IIOSAppInfo {
        sdk: string;
        appPath: string;
    }
    type Prompt = any;
    type CommandFunction<Args = Object> = (argv: string[], ctx: IAppProjectConfig, args: Args) => Promise<void> | void;
    type OptionValue = string | boolean | number;
    type CommandOption<T = (ctx: IAppProjectConfig) => OptionValue> = {
        name: string;
        description?: string;
        parse?: (val: string) => any;
        default?: OptionValue | T;
    };
    type DetachedCommandFunction<Args = Object> = (argv: string[], args: Args) => Promise<void> | void;
    type Command<IsDetached extends boolean = false> = {
        name: string;
        description?: string;
        detached?: IsDetached;
        examples?: Array<{
            desc: string;
            cmd: string;
        }>;
        pkg?: {
            name: string;
            version: string;
        };
        func: IsDetached extends true ? DetachedCommandFunction : CommandFunction;
        options?: Array<CommandOption<IsDetached extends true ? () => OptionValue : (ctx: IAppProjectConfig) => OptionValue>>;
    };
    type DetachedCommand = Command<true>;
    interface IAppProjectConfig {
        project: ProjectConfig;
    }
    type AndroidProject = NonNullable<IAppProjectConfig['project']['android']>;
    interface PlatformConfig<ProjectConfig, ProjectParams> {
        npmPackageName?: string;
        projectConfig: (projectRoot: string, projectParams: ProjectParams | void) => ProjectConfig | void;
    }
    type AndroidPlatformConfig = PlatformConfig<AndroidProjectConfig, AndroidProjectParams>;
    type IOSPlatformConfig = PlatformConfig<IOSProjectConfig, IOSProjectParams>;
    type ProjectConfig = {
        android?: Exclude<ReturnType<AndroidPlatformConfig['projectConfig']>, void>;
        ios?: Exclude<ReturnType<IOSPlatformConfig['projectConfig']>, void>;
        [key: string]: any;
    };
    interface IOSDevice {
        availability?: string;
        state?: string;
        isAvailable?: boolean;
        name: string;
        udid: string;
        version?: string;
        availabilityError?: string;
        type?: IDeviceType;
        booted?: boolean;
    }
    interface AndroidDevice {
        name: string;
        type?: IDeviceType;
        attach?: boolean;
    }
    interface IBuildPluginIOSFrameworkArgs {
        projectPath: string;
        pluginId: string;
        buildShellPath: string;
    }
    interface IMiniAppInfo {
        cpa_id: string;
        desc: string;
        name: string;
        status: number;
        type: number;
        is_bound_idaas: boolean;
        use_cloud_sync: boolean;
        sdk_key?: string;
        sdk_key_secret?: string;
    }
    interface IMiniModuleInfo {
        module_id: string;
        name: string;
        status: number;
        type: number;
    }
    interface IOpenAppInfo {
        mobileapp_id: string;
        ios_flag: boolean;
        ios_install_url: boolean;
        bundle_id: string;
        univesal_link: string;
        test_ios_bundle_id?: string;
        test_ios_univesal_link?: string;
        debug_ios_bundle_id?: string;
        debug_ios_universal_link?: string;
        ios_ipad_flag?: boolean;
        ios_ipad_install_url?: string;
        ipad_bundle_id?: string;
        test_ios_ipad_bundle_id?: string;
        android_flag: boolean;
        android_install_url: boolean;
        android_signature: string;
        android_package_name: string;
        debug_android_signature?: string;
        debug_android_package_name?: string;
    }
    interface IMiniAppPluginInfo {
        plugin_id: string;
    }
    interface IMiniBindingInfo {
        cpa_info?: IMiniAppInfo;
        plugin_info?: IMiniAppPluginInfo;
        module_info?: IMiniModuleInfo;
        mobileapp_info?: IOpenAppInfo;
        weapp_username?: string;
        weapp_id?: string;
        weapp_has_built?: boolean;
        space_info?: {
            space_id: string;
            name: string;
            is_verified: boolean;
        };
        service_setting?: {
            MaxCodeSize: number;
            MaxSubpackageFullCodeSize: number;
            MaxSubpackageSubCodeSize: number;
        };
        isOldUser?: boolean;
        cloudBuildQuotaInfo?: {
            android: {
                os_type: number;
                total_quota: number;
                use_quota: number;
            };
            tip_list: Array<{
                wording?: string;
                url_title?: string;
                url?: string;
            }>;
        };
        cpa_package_info?: {
            enable_cloud_sync: boolean;
            enable_remove_watermark: boolean;
            is_pro: boolean;
        };
        cpfTipsInfo?: {
            tip_list: Array<{
                business_type: number;
                wording?: string;
                url_title?: string;
                url?: string;
            }>;
        };
    }
}
