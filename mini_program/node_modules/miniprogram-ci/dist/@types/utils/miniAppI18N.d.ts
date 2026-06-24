type ITranslations = {
    common?: Record<string, string>;
    ios?: Record<string, string>;
    android?: Record<string, string>;
};
type II18NInfo = Record<string, ITranslations>;
declare class MiniAppI18N {
    i18nInfo: II18NInfo;
    private ensureObject;
    createI18NInfo: (projectPath: string) => void;
    private writeI18NInfoToAndroidFileSystem;
    private writeI18NInfoToiOSFileSystem;
}
declare const _default: MiniAppI18N;
export default _default;
