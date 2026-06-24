declare class Expression {
    constructor(content: any);
    lex(): ({
        index: number;
        constant: boolean;
        text: string;
        value: string;
        identifier?: undefined;
        operator?: undefined;
    } | {
        index: number;
        constant: boolean;
        text: string;
        value: number;
        identifier?: undefined;
        operator?: undefined;
    } | {
        index: number;
        text: any;
        identifier: boolean;
        constant?: undefined;
        value?: undefined;
        operator?: undefined;
    } | {
        index: number;
        text: any;
        constant?: undefined;
        value?: undefined;
        identifier?: undefined;
        operator?: undefined;
    } | {
        index: number;
        text: any;
        operator: boolean;
        constant?: undefined;
        value?: undefined;
        identifier?: undefined;
    })[];
    parse(): (data: any) => any;
    expect(text: any): any;
    consume(text: any): any;
    expression(): any;
    ternary(): any;
    binary(left: any, op: any, right: any): (data: any) => any;
    unary(): any;
    logicalOR(): any;
    logicalAND(): any;
    equality(): any;
    relational(): any;
    additive(): any;
    multiplicative(): any;
    primary(): any;
    fieldAccess(object: any): (data: any) => any;
    objectIndex(object: any): (data: any) => any;
    functionCall(func: any, context: any): (data: any) => any;
    array(): (data: any) => any[];
    object(): (data: any) => {};
    identifier(): (data: any) => any;
    constant(): (data: any) => any;
}
export default Expression;
