import { loadAuthToken } from "@/lib/account-session";
import { createDefaultClip, type EditOperation } from "@hybridator/core-model";
import { opfsMediaBlobStore } from "./opfs-media";

/** Demande TTS serveur → asset OPFS + clip A2. */
export async function requestTtsClip(input: {
  projectId: string;
  text: string;
  language?: string;
  startSec?: number;
}): Promise<{ ok: true; ops: EditOperation[] } | { ok: false; error: string }> {
  const text = input.text.trim();
  if (!text) return { ok: false, error: "Texte vide." };
  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    const token = loadAuthToken();
    if (token) headers["authorization"] = `Bearer ${token}`;
    const res = await fetch("/api/ai/tts", {
      method: "POST",
      headers,
      body: JSON.stringify({
        text,
        language: input.language ?? "fr",
        projectId: input.projectId,
      }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText);
      return { ok: false, error: msg || "TTS indisponible." };
    }
    const blob = await res.blob();
    const assetId = `tts_${Date.now().toString(36)}`;
    const uri = await opfsMediaBlobStore.put(input.projectId, assetId, blob);
    const durationSec = Number(res.headers.get("x-audio-duration") ?? "3") || 3;
    const clip = createDefaultClip({
      id: `aclip_${assetId}`,
      assetId,
      trackId: "a2",
      start: input.startSec ?? 0,
      duration: durationSec,
      label: `TTS · ${text.slice(0, 28)}`,
    });
    clip.mediaRole = "audio";
    return {
      ok: true,
      ops: [
        {
          type: "ADD_ASSET",
          asset: {
            id: assetId,
            name: `TTS ${text.slice(0, 24)}`,
            kind: "audio",
            uri,
            durationSec,
          },
        },
        { type: "ADD_CLIP", clip },
      ],
    };
  } catch {
    return { ok: false, error: "Serveur TTS indisponible." };
  }
}
