import type { RawSourceMap } from 'source-map';
import { MinifyOutput } from 'uglify-js';
import type { MinifyOutput as TerserMinifyOutput } from 'terser';
interface IOptions {
    code: string;
    useTerser: boolean;
    filePath: string;
    inputSourceMap?: RawSourceMap;
}
declare const minify: (options: IOptions) => TerserMinifyOutput | MinifyOutput | {
    error: {
        message: string;
        code: number;
    };
};
export = minify;
