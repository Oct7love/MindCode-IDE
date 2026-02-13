/**
 * node-pty 最小类型声明
 * 当 @types/node-pty 不可用时提供编译支持
 */
declare module "node-pty" {
  interface IPtyForkOptions {
    name?: string;
    cols?: number;
    rows?: number;
    cwd?: string;
    env?: { [key: string]: string };
    encoding?: string | null;
    handleFlowControl?: boolean;
    flowControlPause?: string;
    flowControlResume?: string;
    useConpty?: boolean;
  }

  interface IEvent<T> {
    (listener: (e: T) => void): IDisposable;
  }

  interface IDisposable {
    dispose(): void;
  }

  interface IPty {
    readonly pid: number;
    readonly cols: number;
    readonly rows: number;
    readonly process: string;
    readonly handleFlowControl: boolean;
    onData: IEvent<string>;
    onExit: IEvent<{ exitCode: number; signal?: number }>;
    write(data: string): void;
    resize(columns: number, rows: number): void;
    kill(signal?: string): void;
    pause(): void;
    resume(): void;
    clear(): void;
  }

  function spawn(file: string, args: string[] | string, options: IPtyForkOptions): IPty;
}
