import { IUploadInfo } from '../cosUpload';
export declare const SIGNATURE_FILE_NAME = "ci.signature";
export interface IUploadInfoForAsyncTask {
    expired_time: string;
    start_time: string;
    task_id: string;
    checksum: string;
    upload_info: {
        object: string;
        bucket: string;
        crypt_key: string;
    };
}
export declare function encryptLocalFile(inputFile: string, uploadToken: IUploadInfo): Promise<string>;
