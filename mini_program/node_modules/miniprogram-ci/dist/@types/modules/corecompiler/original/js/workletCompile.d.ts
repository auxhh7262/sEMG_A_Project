interface IOptions {
    babelRoot: string;
    code: string;
    filePath: string;
    disableUseStrict?: boolean;
    inputSourceMap?: import('source-map').RawSourceMap;
}
declare const workletCompile: (options: IOptions) => {
    error: {
        message: string;
        code: number;
    };
    code?: undefined;
    map?: undefined;
    helpers?: undefined;
} | {
    code: string;
    map: import("source-map").RawSourceMap;
    helpers: never[];
    error?: undefined;
};
export = workletCompile;
