
import { Blob } from '@google/genai';

export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Creates a PCM blob for the Gemini API.
 * Resamples input data to 16000Hz using linear interpolation.
 */
export function createBlob(data: Float32Array, sourceSampleRate: number): Blob {
  const targetSampleRate = 16000;
  let resampledData: Float32Array;

  if (sourceSampleRate === targetSampleRate) {
    resampledData = data;
  } else {
    // Linear Interpolation Resampling
    const ratio = sourceSampleRate / targetSampleRate;
    const newLength = Math.floor(data.length / ratio);
    resampledData = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const pos = i * ratio;
      const index = Math.floor(pos);
      const fraction = pos - index;
      
      const val1 = data[index];
      const val2 = (index + 1 < data.length) ? data[index + 1] : val1;
      
      // Linear interpolation between the two nearest samples
      resampledData[i] = val1 + (val2 - val1) * fraction;
    }
  }

  const l = resampledData.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Clamp values to avoid distortion and convert to 16-bit PCM
    const s = Math.max(-1, Math.min(1, resampledData[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

export const blobToBase64 = (blob: globalThis.Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = (reader.result as string).split(',')[1];
        resolve(base64data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
};
