export interface ISitemapJSON {
    desc?: string;
    rules: Array<{
        action: 'allow' | 'disallow';
        page: string;
        params?: Array<any>;
        matching?: 'inclusive' | 'exact' | 'exclusive' | 'partial';
        priority?: number;
    }>;
}
