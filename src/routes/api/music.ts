import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { authenticateApiRequest } from "@/lib/api-auth.server";

const requestSchema = z.object({
  topic: z.string().trim().min(2).max(80),
  genre: z.enum(["pop", "acoustic", "indie", "R&B", "rock", "reggae", "lofi"]),
  goal: z.enum([
    "everyday vocabulary",
    "pronunciation and rhythm",
    "phrasal verbs and expressions",
    "grammar in context",
  ]),
});

const CEFR_LEVELS = new Set(["a1", "a2", "b1", "b2", "c1", "c2"]);

export const Route = createFileRoute("/api/music")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        let userId: string;
        try {
          userId = await authenticateApiRequest(request);
        } catch (error) {
          return Response.json(
            { message: "Please sign in to create a song." },
            { status: error instanceof Response ? error.status : 401 },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: savedSongs, error: historyReadError } = await supabaseAdmin
          .from("music_lab_songs")
          .select("id, topic, genre, goal, lyrics, audio_path, mime_type, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (historyReadError) {
          console.error("[music-lab] saved history unavailable", { code: historyReadError.code });
          return Response.json(
            { message: "Could not load your saved songs. Please try again." },
            { status: 503 },
          );
        }

        try {
          const songs = await Promise.all(
            (savedSongs ?? []).map(async (song) => {
              const { data: signedAudio, error: signedAudioError } = await supabaseAdmin.storage
                .from("music-lab-audio")
                .createSignedUrl(song.audio_path, 60 * 60);
              if (signedAudioError || !signedAudio?.signedUrl) {
                throw new Error("Saved audio URL could not be created.");
              }
              return {
                id: song.id,
                topic: song.topic,
                genre: song.genre,
                goal: song.goal,
                lyrics: song.lyrics,
                audioUrl: signedAudio.signedUrl,
                mimeType: song.mime_type,
                createdAt: song.created_at,
              };
            }),
          );
          return Response.json({ songs });
        } catch {
          console.error("[music-lab] saved audio signing unavailable");
          return Response.json(
            { message: "Could not load your saved songs. Please try again." },
            { status: 503 },
          );
        }
      },
      POST: async ({ request }) => {
        let userId: string;
        try {
          userId = await authenticateApiRequest(request);
        } catch (error) {
          return Response.json(
            { message: "Please sign in to create a song." },
            { status: error instanceof Response ? error.status : 401 },
          );
        }

        const parsed = requestSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json(
            { message: "Choose a topic, style and learning focus." },
            { status: 400 },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: profile, error: profileError } = await supabaseAdmin
          .from("profiles")
          .select("level")
          .eq("id", userId)
          .maybeSingle();
        if (profileError || !profile?.level) {
          return Response.json(
            { message: "We couldn't load your learning level. Please try again." },
            { status: 503 },
          );
        }

        const level = String(profile.level).toLowerCase();
        if (!CEFR_LEVELS.has(level)) {
          return Response.json(
            { message: "Your profile level is not configured for Music Lab yet." },
            { status: 409 },
          );
        }

        // Initial cost safeguard: allow one successful song per account in a rolling 24-hour window.
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count: recentSongs, error: usageReadError } = await supabaseAdmin
          .from("ai_usage_events")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("operation", "music_generation")
          .eq("success", true)
          .gte("created_at", since24h);
        if (usageReadError) {
          console.error("[music-lab] usage safeguard unavailable");
          return Response.json(
            { message: "Music generation is temporarily unavailable." },
            { status: 503 },
          );
        }
        if ((recentSongs ?? 0) >= 1) {
          return Response.json(
            {
              message:
                "You can create one song every 24 hours for now. Please come back later for another track.",
            },
            { status: 429 },
          );
        }
        const lovableKey = process.env["LOVABLE_API_KEY"];
        const connectionKey = process.env["UDC_MARCELO_S_GOOGLE_GEMINI_KEY_API_KEY"];
        if (!lovableKey || !connectionKey) {
          return Response.json(
            {
              message:
                "Music generation is not configured yet. Please contact support if this continues.",
            },
            { status: 503 },
          );
        }

        const levelGuidance: Record<string, string> = {
          a1: "Use very common concrete words, short present-tense sentences, repetition, and a clear chorus. Avoid idioms and complex clauses.",
          a2: "Use familiar everyday vocabulary, short connected sentences, simple past and future where useful, and a repetitive chorus.",
          b1: "Use familiar and moderately varied vocabulary, connected ideas, common phrasal verbs, and clear verse/chorus structure.",
          b2: "Use varied vocabulary, natural collocations, some idiomatic expressions, and more developed ideas without making the lyrics needlessly obscure.",
          c1: "Use nuanced vocabulary, natural idioms, varied syntax, imagery, and sophisticated but understandable lyrical phrasing.",
          c2: "Use highly nuanced, precise and idiomatic English, complex syntax where natural, and rich imagery while keeping the lyrics coherent.",
        };

        const prompt = [
          "Create one original English-language song for an English-learning app. Generate the actual song with a clearly female lead singing voice and full instrumental arrangement, not just a description. Use a natural, expressive female vocal tone; do not use a male lead voice.",
          `Student's CEFR level: ${level.toUpperCase()}.`,
          `Language guidance for this level: ${levelGuidance[level]}.`,
          `Topic: ${parsed.data.topic}.`,
          `Genre: ${parsed.data.genre}.`,
          `Learning focus: ${parsed.data.goal}.`,
          "Use clear, natural English and a memorable chorus. Keep the complete song exactly 30 seconds long. Make the lyrics original; do not imitate any named artist or existing song, and do not quote copyrighted lyrics.",
          "Return the lyrics as readable text with section labels such as [Verse 1], [Chorus], and [Verse 2], together with the generated audio.",
        ].join("\n");

        try {
          const upstream = await fetch(
            "https://connector-gateway.lovable.dev/udc_marcelo_s_google_gemini_key/v1beta/models/lyria-3-clip-preview:generateContent",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${lovableKey}`,
                "X-Connection-Api-Key": connectionKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseModalities: ["AUDIO", "TEXT"] },
              }),
              signal: AbortSignal.timeout(120_000),
            },
          );

          if (!upstream.ok) {
            const details = await upstream.text().catch(() => "");
            console.error(
              `[music-lab] provider error ${upstream.status}: ${details.slice(0, 300)}`,
            );
            return Response.json(
              {
                message:
                  upstream.status === 429
                    ? "The music service is busy right now. Please try again later."
                    : "We couldn't generate the song right now. Please try again later.",
              },
              { status: upstream.status === 429 ? 429 : 502 },
            );
          }

          const result = (await upstream.json()) as {
            candidates?: Array<{
              content?: {
                parts?: Array<{
                  text?: string;
                  inlineData?: { data?: string; mimeType?: string };
                  inline_data?: { data?: string; mime_type?: string };
                }>;
              };
            }>;
          };
          const parts = result.candidates?.[0]?.content?.parts ?? [];
          const lyrics = parts
            .map((part) => part.text?.trim())
            .filter(Boolean)
            .join("\n\n");
          const audioPart = parts.find((part) => part.inlineData?.data || part.inline_data?.data);
          const audioBase64 = audioPart?.inlineData?.data ?? audioPart?.inline_data?.data;
          const mimeType =
            audioPart?.inlineData?.mimeType ?? audioPart?.inline_data?.mime_type ?? "audio/mpeg";

          if (!audioBase64 || !lyrics) {
            console.error("[music-lab] provider response missing audio or lyrics");
            return Response.json(
              { message: "The music service returned an incomplete song. Please try again." },
              { status: 502 },
            );
          }

          const normalizedMimeType = mimeType.split(";")[0]?.trim().toLowerCase();
          const extension =
            normalizedMimeType === "audio/wav" || normalizedMimeType === "audio/x-wav"
              ? "wav"
              : normalizedMimeType === "audio/ogg"
                ? "ogg"
                : normalizedMimeType === "audio/mp4"
                  ? "m4a"
                  : "mp3";
          const songId = crypto.randomUUID();
          const audioPath = `${userId}/${songId}.${extension}`;
          const audioStorage = supabaseAdmin.storage.from("music-lab-audio");
          const { error: audioUploadError } = await audioStorage.upload(
            audioPath,
            Buffer.from(audioBase64, "base64"),
            { contentType: mimeType, upsert: false },
          );

          if (audioUploadError) {
            console.error("[music-lab] audio persistence failed", {
              code: audioUploadError.name,
            });
            return Response.json(
              {
                message:
                  "Your song was generated, but we couldn't save it safely. Please try again later.",
              },
              { status: 503 },
            );
          }

          const removeUploadedAudio = async () => {
            const { error } = await audioStorage.remove([audioPath]);
            if (error) console.error("[music-lab] temporary audio cleanup failed");
          };

          const { data: signedAudio, error: signedAudioError } = await audioStorage.createSignedUrl(
            audioPath,
            60 * 60,
          );
          if (signedAudioError || !signedAudio?.signedUrl) {
            await removeUploadedAudio();
            console.error("[music-lab] could not sign newly saved audio");
            return Response.json(
              {
                message:
                  "Your song was generated, but we couldn't save it safely. Please try again later.",
              },
              { status: 503 },
            );
          }

          const { data: savedSong, error: songWriteError } = await supabaseAdmin
            .from("music_lab_songs")
            .insert({
              id: songId,
              user_id: userId,
              topic: parsed.data.topic,
              genre: parsed.data.genre,
              goal: parsed.data.goal,
              lyrics,
              audio_path: audioPath,
              mime_type: mimeType,
              level,
            })
            .select("created_at")
            .single();

          if (songWriteError || !savedSong) {
            await removeUploadedAudio();
            console.error("[music-lab] song metadata persistence failed", {
              code: songWriteError?.code,
            });
            return Response.json(
              {
                message:
                  "Your song was generated, but we couldn't save it safely. Please try again later.",
              },
              { status: 503 },
            );
          }

          const { error: usageWriteError } = await supabaseAdmin.from("ai_usage_events").insert({
            user_id: userId,
            operation: "music_generation",
            model: "lyria-3-clip-preview",
            status: "completed",
            success: true,
            completed_at: new Date().toISOString(),
          });
          if (usageWriteError) {
            await supabaseAdmin
              .from("music_lab_songs")
              .delete()
              .eq("id", songId)
              .eq("user_id", userId);
            await removeUploadedAudio();
            console.error("[music-lab] could not record successful generation", {
              code: usageWriteError.code,
              message: usageWriteError.message,
            });
            return Response.json(
              {
                message:
                  "Your song was generated, but we couldn't safely record its usage. Please contact support before trying again.",
              },
              { status: 503 },
            );
          }

          return Response.json({
            song: {
              id: songId,
              topic: parsed.data.topic,
              genre: parsed.data.genre,
              goal: parsed.data.goal,
              lyrics,
              audioUrl: signedAudio.signedUrl,
              mimeType,
              createdAt: savedSong.created_at,
            },
          });
        } catch (error) {
          console.error(
            "[music-lab] generation failed",
            error instanceof Error ? error.message : "unknown",
          );
          return Response.json(
            {
              message:
                "Music generation timed out or is temporarily unavailable. Please try again.",
            },
            { status: 503 },
          );
        }
      },
    },
  },
});
