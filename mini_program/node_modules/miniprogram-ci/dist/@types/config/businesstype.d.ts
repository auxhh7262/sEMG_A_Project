export declare const BUSINESS_TYPE: {
    BusiType_UploadApkPlugin: number;
    BusiType_UploadCpfPlugin: number;
    BusiType_TestSource: number;
    BusiType_CommitSource: number;
    BusiType_BuildSource: number;
    BusiType_CompileSource: number;
    BusiType_AiCommitSource: number;
};
export type TBusinessType = typeof BUSINESS_TYPE[keyof typeof BUSINESS_TYPE];
