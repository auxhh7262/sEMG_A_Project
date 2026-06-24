export declare function ciSimpleRequest({ privateKey, appid, cgi, robot }: {
    privateKey: string;
    appid: string;
    cgi: string;
    robot: number;
}, data?: any): Promise<any>;
export declare function ciCustomRequest(url: string, body: any, headers?: any): Promise<any>;
