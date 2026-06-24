interface IOptions {
    code: string;
    inputSourceMap?: import('source-map').RawSourceMap;
    filePath: string;
}
declare const minifyAfterWrap: (options: IOptions) => import("terser").MinifyOutput | import("uglify-js").MinifyOutput | {
    error: {
        message: string;
        code: number;
    };
};
export = minifyAfterWrap;
