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
          return Response.json({ message: "Choose a topic, style and learning focus." }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: profile, error: profileError } = await supabaseAdmin
          .from("profiles")
          .select("level")
          .eq("id", userId)
          .maybeSingle();
        if (profileError || !profile?.level) {
          return Response.json({ message: "We couldn't load your learning level. Please try again." }, { status: 503 });
        }

        const level = String(profile.level).toLowerCase();
        if (!CEFR_LEVELS.has(level)) {
          return Response.json({ message: "Your profile level is not configured for Music Lab yet." }, { status: 409 });
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
          return Response.json({ message: "Music generation is temporarily unavailable." }, { status: 503 });
        }
        if ((recentSongs ?? 0) >= 1) {
          return Response.json(
            { message: "You can create one song every 24 hours for now. Please come back later for another track." },
            { status: 429 },
          );
        }
        const apiKey = process.env["GOOGLE_GEMINI_API_KEY"];
        if (!apiKey) {
          return Response.json(
            { message: "Music generation is not configured yet. Please try again later." },
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
          "Create one original English-language song for an English-learning app. Generate the actual song with lead vocals and full instrumental arrangement, not just a description.",
          `Student's CEFR level: ${level.toUpperCase()}.`,
          `Language guidance for this level: ${levelGuidance[level]}.`,
          `Topic: ${parsed.data.topic}.`,
          `Genre: ${parsed.data.genre}.`,
          `Learning focus: ${parsed.data.goal}.`,
          "Use clear, natural English and a memorable chorus. Keep the song around 60–90 seconds. Make the lyrics original; do not imitate any named artist or existing song, and do not quote copyrighted lyrics.",
          "Return the lyrics as readable text with section labels such as [Verse 1], [Chorus], and [Verse 2], together with the generated audio.",
        ].join("\n");

        try {
          const upstream = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/lyria-3.5:generateContent",
            {
              method: "POST",
              headers: {
                "x-goog-api-key": apiKey,
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
            console.error(`[music-lab] provider error ${upstream.status}: ${details.slice(0, 300)}`);
            return Response.json(
              { message: upstream.status === 429
                  ? "The music service is busy right now. Please try again later."
                  : "We couldn't generate the song right now. Please try again later." },
              { status: upstream.status === 429 ? 429 : 502 },
            );
          }

          const result = await upstream.json() as {
            candidates?: Array<{
              content?: { parts?: Array<{
                text?: string;
                inlineData?: { data?: string; mimeType?: string };
                inline_data?: { data?: string; mime_type?: string };
              }> };
            }>;
          };
          const parts = result.candidates?.[0]?.content?.parts ?? [];
          const lyrics = parts.map((part) => part.text?.trim()).filter(Boolean).join("\n\n");
          const audioPart = parts.find((part) => part.inlineData?.data || part.inline_data?.data);
          const audioBase64 = audioPart?.inlineData?.data ?? audioPart?.inline_data?.data;
          const mimeType = audioPart?.inlineData?.mimeType ?? audioPart?.inline_data?.mime_type ?? "audio/mpeg";

          if (!audioBase64 || !lyrics) {
            console.error("[music-lab] provider response missing audio or lyrics");
            return Response.json(
              { message: "The music service returned an incomplete song. Please try again." },
              { status: 502 },
            );
          }

          const { error: usageWriteError } = await supabaseAdmin.from("ai_usage_events").insert({
            user_id: userId,
            operation: "music_generation",
            model: "lyria-3.5",
            status: "success",
            success: true,
            completed_at: new Date().toISOString(),
          });
          if (usageWriteError) console.error("[music-lab] could not record successful generation");
          return Response.json({ lyrics, audioBase64, mimeType });
        } catch (error) {
          console.error("[music-lab] generation failed", error instanceof Error ? error.message : "unknown");
          return Response.json(
            { message: "Music generation timed out or is temporarily unavailable. Please try again." },
            { status: 503 },
          );
        }
      },
    },
  },
});
