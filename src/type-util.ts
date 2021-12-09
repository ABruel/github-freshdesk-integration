export type ConvertToCliArgs<T> = {
  [P in keyof T]: T[P] extends boolean | number ? T[P] : string;
};

export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

export type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;
export type Arg1<T> = T extends (a: infer U, ...args: unknown[]) => unknown
  ? U
  : never;
export type Arg2<T> = T extends (
  a: unknown,
  b: infer U,
  ...args: unknown[]
) => unknown
  ? U
  : never;
