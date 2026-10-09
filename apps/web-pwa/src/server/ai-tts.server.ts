/**
 * TTS serveur — OpenAI si clé, sinon WAV silence/ton démo déterministe (pas de fake aléatoire).
 */

function env(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  const v = process.env[name];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export function isTtsProviderConfigured(): boolean {
  return Boolean(env("OPENAI_API_KEY") ?? env("TTS_API_KEY"));
}

export const MAX_TTS_CHARS = 2000;

/** Durée réelle d'un WAV PCM (en-tête standard 44 octets). */
export function wavDurationSec(bytes: Uint8Array): number | null {
  if (bytes.length < 44) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const byteRate = view.getUint32(28, true);
  const dataSize = view.getUint32(40, true);
  if (byteRate <= 0 || dataSize <= 0) return null;
  return dataSize / byteRate;
}

/** Génère un WAV PCM 16-bit mono avec une enveloppe sinusoïdale (placeholder offline). */
export function buildToneWav(
  durationSec: number,
  freqHz = 220,
): {
  bytes: Uint8Array;
  durationSec: number;
} {
  const sampleRate = 22050;
  const n = Math.max(1, Math.floor(durationSec * sampleRate));
  const data = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const envAmp = Math.min(1, t * 8) * Math.min(1, (durationSec - t) * 8);
    data[i] = Math.floor(Math.sin(2 * Math.PI * freqHz * t) * envAmp * 0.25 * 32767);
  }
  const dataBytes = new Uint8Array(data.buffer);
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataBytes.length, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataBytes.length, true);
  const out = new Uint8Array(44 + dataBytes.length);
  out.set(new Uint8Array(header), 0);
  out.set(dataBytes, 44);
  return { bytes: out, durationSec: n / sampleRate };
}

export async function handleTts(body: {
  text: string;
  language?: string;
}): Promise<{ bytes: Uint8Array; contentType: string; durationSec: number }> {
  const text = body.text.trim().slice(0, MAX_TTS_CHARS);
  const estimateSec = Math.min(30, Math.max(1.2, text.length * 0.06));
  const key = env("OPENAI_API_KEY") ?? env("TTS_API_KEY");
  if (key) {
    try {
      const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: env("TTS_OPENAI_MODEL") ?? "gpt-4o-mini-tts",
          voice: env("TTS_VOICE") ?? "alloy",
          input: text,
          response_format: "wav",
        }),
      });
      if (res.ok) {
        const buf = new Uint8Array(await res.arrayBuffer());
        const parsed = wavDurationSec(buf);
        return {
          bytes: buf,
          contentType: "audio/wav",
          durationSec: parsed && parsed > 0 ? parsed : estimateSec,
        };
      }
    } catch {
      /* fallback */
    }
  }
  const tone = buildToneWav(estimateSec, body.language === "en" ? 196 : 220);
  return { bytes: tone.bytes, contentType: "audio/wav", durationSec: tone.durationSec };
}
