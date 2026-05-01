export type WallCardRpcIntent = {
  method: string;
  params?: unknown[] | Record<string, unknown>;
  chainIdHex: string;
  evmAddress: string;
  solAddress: string;
};
