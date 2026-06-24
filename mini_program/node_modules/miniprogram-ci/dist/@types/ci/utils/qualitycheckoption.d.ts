declare const _default: {
    version: number;
    checkList: ({
        name: string;
        enabled: boolean;
        desc: string;
        descEn: string;
        limit: number;
        docURL: string;
        level: number;
        title: string;
        titleEn: string;
        typeName: string;
        typeNameEn: string;
        handlerText?: undefined;
        handlerTextEn?: undefined;
    } | {
        name: string;
        enabled: boolean;
        desc: string;
        descEn: string;
        docURL: string;
        level: number;
        title: string;
        titleEn: string;
        typeName: string;
        typeNameEn: string;
        limit?: undefined;
        handlerText?: undefined;
        handlerTextEn?: undefined;
    } | {
        name: string;
        enabled: boolean;
        desc: string;
        descEn: string;
        level: number;
        handlerText: string;
        handlerTextEn: string;
        title: string;
        titleEn: string;
        docURL: string;
        typeName: string;
        typeNameEn: string;
        limit?: undefined;
    })[];
    regList: {
        IMAGE_AND_AUDIO_LIMIT: string[];
    };
};
export default _default;
