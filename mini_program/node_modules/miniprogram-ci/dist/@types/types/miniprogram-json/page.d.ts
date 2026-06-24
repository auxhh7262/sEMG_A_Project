import { AppJSON } from '../core';
import { BaseInfo } from './base';
export declare namespace PageJSON {
    interface IPageJSON {
        navigationBarBackgroundColor?: string;
        navigationBarTextStyle?: 'black' | 'white';
        navigationBarTitleText?: string;
        navigationStyle?: 'default' | 'custom';
        backgroundColor?: string;
        backgroundTextStyle?: 'dark' | 'light';
        enablePullDownRefresh?: boolean;
        onReachBottomDistance?: number;
        disableScroll?: boolean;
        disableSwipeBack?: boolean;
        backgroundColorTop?: string;
        backgroundColorBottom?: string;
        usingComponents?: {
            [key: string]: string;
        };
        componentPlaceholder?: {
            [key: string]: string;
        };
        componentGenerics?: any;
        pageOrientation?: BaseInfo.PageOrientation;
        renderer?: AppJSON.Renderer | 'xr-frame';
        __warning__?: string;
        component: boolean;
        singlePage: AppJSON.ISinglePage;
        componentFramework?: 'glass-easel' | 'exparser';
    }
}
