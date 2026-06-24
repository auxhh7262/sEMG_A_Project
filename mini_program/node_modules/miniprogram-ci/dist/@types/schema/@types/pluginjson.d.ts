export interface IPluginJSON {
    publicComponents?: {
        [key: string]: string;
    };
    usingComponents?: {
        [key: string]: string;
    };
    pages?: {
        [key: string]: string;
    };
    main?: string;
    themeLocation?: string;
    lazyCodeLoading?: 'requiredComponents';
    workers?: string;
    renderer?: "skyline" | "webview";
    componentFramework?: 'glass-easel' | 'exparser';
}
