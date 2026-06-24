import { MiniProgramSummer, MiniProgramDevtools, MiniProgramCore } from '../../../types';
import { CustomError } from '../../../utils/customError';
import { FileType } from './graph/basegraph';
declare class JsTag {
    isLargeFile: boolean;
    isBabelIgnore: boolean;
    helpers: string[];
    resultType: MiniProgramCore.IResultType;
    setBabelIgnore(): void;
    setLargeFile(): void;
    addHelpers(helpers: string[]): void;
    setResultType(resultType?: MiniProgramCore.IResultType): void;
    toJSON(): {
        isLargeFile: boolean;
        isBabelIgnore: boolean;
        helpers: string[];
    };
}
export default class Module {
    readonly path: string;
    readonly sourcePath: string;
    fileType: FileType;
    private _jsTag?;
    private _error;
    private loadResult?;
    private generateResultPromise;
    private compileResultPromise;
    depFiles: string[];
    independentRoot: string;
    isBabelIgnore: boolean;
    private generatedTS;
    constructor(path: string, sourcePath: string, fileType: FileType);
    private transResultType;
    getGeneratedTS(resultType: MiniProgramCore.IResultType): number;
    setError(resultType: MiniProgramCore.IResultType, error: CustomError | Error): void;
    getError(resultType: MiniProgramCore.IResultType): Error | CustomError | undefined;
    getJsTag(): Promise<JsTag | undefined>;
    getJsTag2(): Promise<JsTag | undefined>;
    getSource(): Promise<MiniProgramSummer.SourceDescription>;
    getMd5(): Promise<string>;
    setLoadingPromise(promise: Promise<MiniProgramSummer.ILoadResult>): void;
    clearUselessCache(): Promise<void>;
    getLoadingPromise(): Promise<MiniProgramSummer.ILoadResult> | undefined;
    setGeneratingPromise(resultType: MiniProgramCore.IResultType, promise: Promise<MiniProgramSummer.IGenerateResult>): void;
    getGeneratingPromise(resultType: MiniProgramCore.IResultType): Promise<MiniProgramSummer.IGenerateResult> | undefined;
    getCompilePromise(resultType: MiniProgramCore.IResultType): Promise<MiniProgramSummer.IGenerateResult> | undefined;
    setCompilePromise(resultType: MiniProgramCore.IResultType, promise: Promise<MiniProgramSummer.IGenerateResult>): void;
    getProcessInfo(resultType: MiniProgramCore.IResultType): Promise<MiniProgramSummer.IPluginProcessInfo[] | undefined>;
    toCodeFile(resultType: MiniProgramCore.IResultType): Promise<MiniProgramDevtools.CodeFile | MiniProgramDevtools.CodeError>;
    toCodeFile2(resultType: MiniProgramCore.IResultType): Promise<MiniProgramDevtools.CodeFile | MiniProgramDevtools.CodeError>;
    toGenerateResult(resultType: MiniProgramCore.IResultType): Promise<MiniProgramSummer.IGenerateResult | MiniProgramDevtools.CodeError>;
    toJSON(): MiniProgramSummer.ModuleJSON;
    addWatchFile(file: string): void;
}
export {};
