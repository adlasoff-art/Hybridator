export interface AudioMeter {
  /** Niveau 0..1 (RMS approximatif). */
  getLevel: () => number;
  /** Gain linéaire 0..2. */
  setGain: (gain: number) => void;
  getGain: () => number;
  /** Flux éventuellement routé via GainNode (pour enregistrement). */
  outputStream: MediaStream;
  dispose: () => void;
}

/**
 * Vu-mètre + gain sur la piste audio du flux.
 * Si pas d'audio, getLevel() = 0 et outputStream = stream d'origine.
 */
export function createAudioMeter(stream: MediaStream): AudioMeter {
  const audioTracks = stream.getAudioTracks();
  if (!audioTracks.length || typeof AudioContext === "undefined") {
    return {
      getLevel: () => 0,
      setGain: () => undefined,
      getGain: () => 1,
      outputStream: stream,
      dispose: () => undefined,
    };
  }

  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const gainNode = ctx.createGain();
  gainNode.gain.value = 1;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  const dest = ctx.createMediaStreamDestination();

  source.connect(gainNode);
  gainNode.connect(analyser);
  gainNode.connect(dest);

  // Mix video tracks from original + processed audio
  const out = new MediaStream([...stream.getVideoTracks(), ...dest.stream.getAudioTracks()]);

  const data = new Uint8Array(analyser.fftSize);
  let gain = 1;

  return {
    getLevel: () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i]! - 128) / 128;
        sum += v * v;
      }
      return Math.min(1, Math.sqrt(sum / data.length) * 2.2);
    },
    setGain: (g: number) => {
      gain = Math.min(2, Math.max(0, g));
      gainNode.gain.value = gain;
    },
    getGain: () => gain,
    outputStream: out,
    dispose: () => {
      try {
        source.disconnect();
        gainNode.disconnect();
        analyser.disconnect();
      } catch {
        /* ignore */
      }
      void ctx.close();
    },
  };
}
