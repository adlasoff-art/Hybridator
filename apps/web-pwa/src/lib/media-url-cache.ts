import { opfsMediaBlobStore } from "@/engine";

const cache = new Map<string, string>();

function cacheKey(projectId: string, assetId: string) {
  return `${projectId}::${assetId}`;
}

/** Résout opfs:// / memory:// / blob: / http(s) en URL affichable. */
export async function resolveAssetObjectUrl(
  projectId: string,
  assetId: string,
  uri: string,
): Promise<string | null> {
  if (uri.startsWith("blob:") || uri.startsWith("http://") || uri.startsWith("https://")) {
    return uri;
  }
  if (uri.startsWith("demo://")) return null;

  const key = cacheKey(projectId, assetId);
  const hit = cache.get(key);
  if (hit) return hit;

  const blob = await opfsMediaBlobStore.get(projectId, assetId);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  cache.set(key, url);
  return url;
}

export function revokeAssetObjectUrl(projectId: string, assetId: string) {
  const key = cacheKey(projectId, assetId);
  const url = cache.get(key);
  if (url) {
    URL.revokeObjectURL(url);
    cache.delete(key);
  }
}

export const HYBRIDATOR_ASSET_MIME = "application/x-hybridator-asset";

export interface DraggedAssetPayload {
  assetId: string;
}
