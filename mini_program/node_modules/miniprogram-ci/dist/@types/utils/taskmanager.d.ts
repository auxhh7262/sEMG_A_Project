interface ITaskProps {
    poolLimit?: number;
    breakWhenError?: boolean;
}
declare class TaskManager<R = any> {
    private static _instance;
    private _tasks;
    private poolLimit;
    private taskPool;
    private breakWhenError;
    constructor(props?: ITaskProps);
    static get shared(): TaskManager<any>;
    addTask(task: () => R | Promise<R>): void;
    addTask<A0, A extends any[]>(task: (arg0: A0, ...args: A) => R | Promise<R>, arg0: A0): void;
    addTask<A0, A1, A extends any[]>(task: (arg0: A0, arg1: A1, ...args: A) => R | Promise<R>, arg0: A0, arg1: A1): void;
    addTask<A0, A1, A2, A extends any[]>(task: (arg0: A0, arg1: A1, arg2: A2, ...args: A) => R | Promise<R>, arg0: A0, arg1: A1, arg2: A2): void;
    addTask<A0, A1, A2, A3, A extends any[]>(task: (arg0: A0, arg1: A1, arg2: A2, arg3: A3, ...args: A) => R | Promise<R>, arg0: A0, arg1: A1, arg2: A2, arg3: A3): void;
    runAllAsync(poolLimit?: number): Promise<R[]>;
    abortAsyncTask(): Promise<void>;
    runAllSerial(): Promise<R[]>;
}
export default TaskManager;
