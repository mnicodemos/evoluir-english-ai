type ActiveRecording = {
  context: AudioContext;
  input: MediaStreamAudioSourceNode;
  gain: GainNode;
  compressor: DynamicsCompressorNode;
  processor: ScriptProcessorNode;
  stream: MediaStream;
  chunks: Float32Array[];
  sampleRate: number;
};

let activeRecording: ActiveRecording | null = null;

function encodeWav(chunks: Float32Array[], sourceRate: number): Blob {
  const sourceLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const source = new Float32Array(sourceLength);
  let sourceOffset = 0;
  for (const chunk of chunks) {
    source.set(chunk, sourceOffset);
    sourceOffset += chunk.length;
  }

  const targetRate = 16000;
  const ratio = sourceRate / targetRate;
  const sampleLength = Math.max(1, Math.floor(source.length / ratio));
  const wav = new ArrayBuffer(44 + sampleLength * 2);
  const view = new DataView(wav);
  const write = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
  };

  write(0, "RIFF");
  view.setUint32(4, 36 + sampleLength * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, sampleLength * 2, true);

  for (let index = 0; index < sampleLength; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(source.length, Math.floor((index + 1) * ratio));
    let total = 0;
    for (let sample = start; sample < end; sample += 1) total += source[sample] ?? 0;
    const value = Math.max(-1, Math.min(1, total / Math.max(1, end - start)));
    view.setInt16(44 + index * 2, value < 0 ? value * 32768 : value * 32767, true);
  }

  return new Blob([wav], { type: "audio/wav" });
}

export async function startVoiceRecording(): Promise<void> {
  // Drop any recording left over from an interrupted session so the mic never stays locked.
  if (activeRecording) cancelVoiceRecording();
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone recording is not supported by this browser.");

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    throw new Error("Microphone access is needed to talk with AI Talking.");
  }

  const context = new AudioContext();
  const input = context.createMediaStreamSource(stream);

  // Boost microphone sensitivity so quieter speech is still captured clearly.
  const gain = context.createGain();
  gain.gain.value = 2.0;

  // Light compression keeps louder peaks from distorting after the gain boost.
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value = 12;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.1;

  const processor = context.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  processor.onaudioprocess = (event) => {
    chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
  };
  input.connect(gain);
  gain.connect(compressor);
  compressor.connect(processor);
  processor.connect(context.destination);
  activeRecording = { context, input, gain, compressor, processor, stream, chunks, sampleRate: context.sampleRate };
}

export async function stopVoiceRecording(): Promise<Blob> {
  const recording = activeRecording;
  if (!recording) throw new Error("No recording is active.");
  activeRecording = null;
  recording.stream.getTracks().forEach((track) => track.stop());
  recording.processor.disconnect();
  recording.compressor.disconnect();
  recording.gain.disconnect();
  recording.input.disconnect();
  recording.processor.onaudioprocess = null;
  await recording.context.close();

  const blob = encodeWav(recording.chunks, recording.sampleRate);
  if (blob.size < 2048) throw new Error("That recording was empty. Please try again.");
  return blob;
}

export function cancelVoiceRecording() {
  const recording = activeRecording;
  if (!recording) return;
  activeRecording = null;
  recording.stream.getTracks().forEach((track) => track.stop());
  recording.processor.disconnect();
  recording.compressor.disconnect();
  recording.gain.disconnect();
  recording.input.disconnect();
  void recording.context.close();
}