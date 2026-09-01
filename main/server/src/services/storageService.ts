import { LocalAdapter } from "./adapters/localAdapter";
import { R2Adapter } from "./adapters/r2Adapter";
import { StorageAdapter } from "./storageAdapter";

function createAdapter(): StorageAdapter {
  const adapter = process.env.STORAGE_ADAPTER ?? "local";
  switch (adapter) {
    case "r2":
      return new R2Adapter();
    case "local":
      return new LocalAdapter();
    default:
      throw new Error(`Unknown STORAGE_ADAPTER: "${adapter}"`);
  }
}

export const storageService: StorageAdapter = createAdapter();

