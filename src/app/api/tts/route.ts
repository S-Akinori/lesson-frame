import {createHash} from "node:crypto";
import {GoogleGenAI} from "@google/genai";
import {NextResponse} from "next/server";
import {z} from "zod";
import {buildTtsInput} from "@/lib/gemini-tts";
import {createReadUrl, isR2Configured, uploadObject} from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 120;

const requestSchema = z.object({
  projectId: z.string().min(1).max(100),
  chunkId: z.string().min(1).max(100),
  text: z.string().min(1).max(500),
  voice: z.string().min(1).max(80).default("Kore"),
  style: z.string().max(300).default(""),
});

const pcmToWav = (pcm: Uint8Array, sampleRate = 24000) => {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, Buffer.from(pcm)]);
};

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json());
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({
        ok: false,
        error: "GEMINI_API_KEY が未設定です。.env.local に追加すると実音声を生成できます。",
      }, {status: 503});
    }

    const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});
    const model = process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-lite-tts";
    const interaction = await ai.interactions.create({
      model,
      input: buildTtsInput(model, input.text, input.style),
      response_format: {type: "audio"},
      generation_config: {
        speech_config: [{voice: input.voice}],
      },
    });

    const encoded = interaction.output_audio?.data;
    if (!encoded) throw new Error("Geminiから音声データが返されませんでした。");

    const raw = Buffer.from(encoded, "base64");
    const sourceMime = interaction.output_audio?.mime_type ?? "audio/wav";
    const wav = sourceMime.includes("wav") ? raw : pcmToWav(raw);
    const durationInSeconds = Math.max(0.2, (wav.length - 44) / (24000 * 2));
    const hash = createHash("sha256").update(`${model}:${input.voice}:${input.style}:${input.text}`).digest("hex").slice(0, 20);
    const key = `projects/${input.projectId}/audio/${input.chunkId}-${hash}.wav`;

    if (isR2Configured()) {
      await uploadObject(key, wav, "audio/wav");
      return NextResponse.json({ok: true, url: await createReadUrl(key, 60 * 60 * 12), storageKey: key, durationInSeconds, mimeType: "audio/wav"});
    }

    return NextResponse.json({
      ok: true,
      url: `data:audio/wav;base64,${wav.toString("base64")}`,
      durationInSeconds,
      mimeType: "audio/wav",
      warning: "R2未設定のため音声はブラウザ内だけで保持されます。",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "音声生成に失敗しました。";
    return NextResponse.json({ok: false, error: message}, {status: 400});
  }
}
