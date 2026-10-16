/**
 * Meditations in English (Life+ AI, user request): short guided sessions read
 * slowly by EVO's voice. They are listening practice in calm, clear English,
 * a daily habit and a light reason to open the app. Relaxation only, never
 * health or therapy claims. Scripts are fixed (not written by the AI each
 * time), so every line's audio is generated once and cached for everyone
 * (speakEnglish, cache "persistent"). Each session has a simpler version for
 * A1-B1 and a richer one for B2-C2; the Portuguese is shown on request.
 */

export type MeditationTier = "simple" | "rich";

export type MeditationLine = {
  /** Spoken by EVO (learning content: stays in English). */
  en: string;
  /** Shown under the line when the student asks for the translation. */
  pt: string;
  /** Silence after the line, in seconds. */
  pause: number;
};

export type MeditationSession = {
  id: string;
  /** English title, translated on screen through uiPt. */
  title: string;
  /** When it fits, translated on screen through uiPt. */
  when: string;
  /** Free for every student (the others are Premium). */
  free?: boolean;
  lines: Record<MeditationTier, MeditationLine[]>;
  /** Key words of the session with their Portuguese. */
  words: [string, string][];
  /** A question to answer afterwards, in English. */
  reflection: string;
};

/** A1 to B1 hear the simpler script, a little slower; B2 to C2 the richer one. */
export function meditationTier(level: string | null | undefined): MeditationTier {
  const code = (level ?? "").trim().toUpperCase().slice(0, 2);
  return code === "B2" || code === "C1" || code === "C2" ? "rich" : "simple";
}

export const MEDITATION_RATE: Record<MeditationTier, number> = { simple: 0.85, rich: 0.92 };

export const MEDITATIONS: MeditationSession[] = [
  {
    id: "breathing",
    title: "Calm breathing",
    when: "Any time you need a pause",
    free: true,
    words: [
      ["breathe in", "inspirar"],
      ["breathe out", "expirar"],
      ["slowly", "devagar"],
      ["shoulders", "ombros"],
      ["calm", "calmo"],
    ],
    reflection: "How do you feel now, compared with the start?",
    lines: {
      simple: [
        {
          en: "Welcome. Sit comfortably and close your eyes, if you want.",
          pt: "Bem-vindo. Sente-se confortavelmente e feche os olhos, se quiser.",
          pause: 4,
        },
        {
          en: "Relax your shoulders. Let them go down.",
          pt: "Relaxe os ombros. Deixe-os descer.",
          pause: 4,
        },
        {
          en: "Now, breathe in slowly through your nose.",
          pt: "Agora, inspire devagar pelo nariz.",
          pause: 4,
        },
        {
          en: "And breathe out slowly through your mouth.",
          pt: "E expire devagar pela boca.",
          pause: 5,
        },
        {
          en: "Again. Breathe in. One, two, three, four.",
          pt: "De novo. Inspire. Um, dois, três, quatro.",
          pause: 3,
        },
        {
          en: "Breathe out. One, two, three, four, five, six.",
          pt: "Expire. Um, dois, três, quatro, cinco, seis.",
          pause: 4,
        },
        {
          en: "Feel the air in your body. You are here, now.",
          pt: "Sinta o ar no seu corpo. Você está aqui, agora.",
          pause: 6,
        },
        { en: "One more time. Breathe in slowly.", pt: "Mais uma vez. Inspire devagar.", pause: 4 },
        { en: "And breathe out. Let everything go.", pt: "E expire. Solte tudo.", pause: 6 },
        {
          en: "Very good. When you are ready, open your eyes. You are calm.",
          pt: "Muito bem. Quando estiver pronto, abra os olhos. Você está calmo.",
          pause: 2,
        },
      ],
      rich: [
        {
          en: "Welcome. Find a comfortable position and, if it feels right, gently close your eyes.",
          pt: "Bem-vindo. Encontre uma posição confortável e, se fizer sentido, feche os olhos com suavidade.",
          pause: 4,
        },
        {
          en: "Let your shoulders drop and release any tension in your jaw.",
          pt: "Deixe os ombros caírem e solte qualquer tensão da mandíbula.",
          pause: 4,
        },
        {
          en: "Take a slow, deep breath in through your nose, filling your chest and belly.",
          pt: "Inspire lenta e profundamente pelo nariz, enchendo o peito e a barriga.",
          pause: 4,
        },
        {
          en: "Now exhale gently through your mouth, a little longer than you inhaled.",
          pt: "Agora expire suavemente pela boca, um pouco mais longo do que inspirou.",
          pause: 5,
        },
        {
          en: "Breathe in for four counts. One, two, three, four.",
          pt: "Inspire contando até quatro. Um, dois, três, quatro.",
          pause: 3,
        },
        {
          en: "And breathe out for six. One, two, three, four, five, six.",
          pt: "E expire contando até seis. Um, dois, três, quatro, cinco, seis.",
          pause: 4,
        },
        {
          en: "Notice how each breath settles your body a little more.",
          pt: "Perceba como cada respiração acalma seu corpo um pouco mais.",
          pause: 6,
        },
        {
          en: "If your mind wanders, that's fine. Simply bring your attention back to the breath.",
          pt: "Se sua mente se distrair, tudo bem. Apenas traga a atenção de volta para a respiração.",
          pause: 6,
        },
        {
          en: "Take one last deep breath, and let it go completely.",
          pt: "Faça uma última respiração profunda e solte por completo.",
          pause: 6,
        },
        {
          en: "Well done. Whenever you're ready, open your eyes and carry this calm with you.",
          pt: "Muito bem. Quando estiver pronto, abra os olhos e leve essa calma com você.",
          pause: 2,
        },
      ],
    },
  },
  {
    id: "focus",
    title: "Focus before studying",
    when: "Before a lesson or a task",
    words: [
      ["focus", "foco"],
      ["attention", "atenção"],
      ["mind", "mente"],
      ["ready", "pronto"],
      ["step by step", "passo a passo"],
    ],
    reflection: "What is the one thing you want to learn today?",
    lines: {
      simple: [
        {
          en: "Let's prepare your mind to study. Sit up straight.",
          pt: "Vamos preparar sua mente para estudar. Sente-se com a coluna reta.",
          pause: 4,
        },
        {
          en: "Put your phone away. Look at one point in front of you.",
          pt: "Deixe o celular de lado. Olhe para um ponto à sua frente.",
          pause: 4,
        },
        {
          en: "Breathe in slowly. Breathe out slowly.",
          pt: "Inspire devagar. Expire devagar.",
          pause: 5,
        },
        {
          en: "Your mind is busy. That is normal.",
          pt: "Sua mente está agitada. Isso é normal.",
          pause: 4,
        },
        {
          en: "Now, think of one small goal for today.",
          pt: "Agora, pense em uma pequena meta para hoje.",
          pause: 6,
        },
        {
          en: "Only one. For example: one lesson, or ten new words.",
          pt: "Só uma. Por exemplo: uma lição, ou dez palavras novas.",
          pause: 5,
        },
        {
          en: "Imagine you finish it. You feel good.",
          pt: "Imagine que você termina. Você se sente bem.",
          pause: 6,
        },
        { en: "Breathe in. You are ready.", pt: "Inspire. Você está pronto.", pause: 4 },
        {
          en: "Breathe out. Let's start, step by step.",
          pt: "Expire. Vamos começar, passo a passo.",
          pause: 2,
        },
      ],
      rich: [
        {
          en: "Let's take a minute to prepare your mind for focused work. Sit upright, with both feet on the floor.",
          pt: "Vamos tirar um minuto para preparar a mente para um trabalho focado. Sente-se ereto, com os dois pés no chão.",
          pause: 4,
        },
        {
          en: "Put away any distractions, and rest your gaze on a single point in front of you.",
          pt: "Afaste as distrações e descanse o olhar em um único ponto à sua frente.",
          pause: 4,
        },
        {
          en: "Breathe in deeply, and as you breathe out, let the noise of the day fade a little.",
          pt: "Inspire profundamente e, ao expirar, deixe o barulho do dia diminuir um pouco.",
          pause: 5,
        },
        {
          en: "Notice any thoughts competing for your attention, and let them pass without following them.",
          pt: "Perceba os pensamentos que disputam sua atenção e deixe-os passar sem segui-los.",
          pause: 6,
        },
        {
          en: "Now set a clear intention: one thing you want to achieve in this session.",
          pt: "Agora defina uma intenção clara: uma coisa que você quer alcançar nesta sessão.",
          pause: 6,
        },
        {
          en: "Make it small and specific, so that it's easy to begin.",
          pt: "Faça-a pequena e específica, para que seja fácil começar.",
          pause: 5,
        },
        {
          en: "Picture yourself completing it, and notice how satisfying that feels.",
          pt: "Imagine-se concluindo e perceba como isso é satisfatório.",
          pause: 6,
        },
        {
          en: "One more deep breath. Your attention is here, and you're ready to begin.",
          pt: "Mais uma respiração profunda. Sua atenção está aqui, e você está pronto para começar.",
          pause: 2,
        },
      ],
    },
  },
  {
    id: "gratitude",
    title: "Gratitude",
    when: "In the morning or at night",
    words: [
      ["grateful", "grato"],
      ["thankful", "agradecido"],
      ["smile", "sorriso"],
      ["warm", "acolhedor, quente"],
      ["today", "hoje"],
    ],
    reflection: "What are you grateful for today? Say it in English.",
    lines: {
      simple: [
        {
          en: "Sit comfortably. Breathe in and breathe out.",
          pt: "Sente-se confortavelmente. Inspire e expire.",
          pause: 5,
        },
        {
          en: "Today, we think about good things.",
          pt: "Hoje, vamos pensar em coisas boas.",
          pause: 4,
        },
        {
          en: "Think of a person you love. See their face.",
          pt: "Pense em uma pessoa que você ama. Veja o rosto dela.",
          pause: 6,
        },
        {
          en: "Say in your mind: I am grateful for you.",
          pt: "Diga na sua mente: sou grato por você.",
          pause: 5,
        },
        {
          en: "Now think of a good moment from this week.",
          pt: "Agora pense em um bom momento desta semana.",
          pause: 6,
        },
        {
          en: "Maybe a meal, a talk, or a walk. Remember it.",
          pt: "Talvez uma refeição, uma conversa ou uma caminhada. Lembre-se dele.",
          pause: 6,
        },
        {
          en: "Now think of something about you. Something you like.",
          pt: "Agora pense em algo sobre você. Algo de que você gosta.",
          pause: 6,
        },
        {
          en: "Smile a little. Feel warm inside.",
          pt: "Sorria um pouco. Sinta um calor por dentro.",
          pause: 5,
        },
        {
          en: "Breathe in. I am thankful. Breathe out. I am here.",
          pt: "Inspire. Sou agradecido. Expire. Estou aqui.",
          pause: 2,
        },
      ],
      rich: [
        {
          en: "Settle into a comfortable position and take a few unhurried breaths.",
          pt: "Acomode-se em uma posição confortável e faça algumas respirações sem pressa.",
          pause: 5,
        },
        {
          en: "In this practice, we'll turn our attention to what is already good in our lives.",
          pt: "Nesta prática, vamos voltar a atenção para o que já é bom na nossa vida.",
          pause: 4,
        },
        {
          en: "Bring to mind someone who cares about you. Picture them as clearly as you can.",
          pt: "Traga à mente alguém que se importa com você. Imagine essa pessoa com o máximo de nitidez.",
          pause: 6,
        },
        {
          en: "Silently tell them: thank you for being part of my life.",
          pt: "Diga a ela em silêncio: obrigado por fazer parte da minha vida.",
          pause: 5,
        },
        {
          en: "Now recall a small moment from this week that made you feel at ease.",
          pt: "Agora lembre-se de um pequeno momento desta semana que fez você se sentir tranquilo.",
          pause: 6,
        },
        {
          en: "Notice the details: where you were, what you heard, how it felt.",
          pt: "Perceba os detalhes: onde você estava, o que ouviu, como se sentiu.",
          pause: 6,
        },
        {
          en: "Finally, acknowledge one quality in yourself that you appreciate.",
          pt: "Por fim, reconheça uma qualidade sua que você valoriza.",
          pause: 6,
        },
        {
          en: "Let that warmth spread through your body as you breathe.",
          pt: "Deixe esse calor se espalhar pelo seu corpo enquanto respira.",
          pause: 5,
        },
        {
          en: "Take this feeling of gratitude with you into the rest of your day.",
          pt: "Leve esse sentimento de gratidão para o resto do seu dia.",
          pause: 2,
        },
      ],
    },
  },
  {
    id: "evening",
    title: "Relax before sleep",
    when: "At night, in bed",
    words: [
      ["lie down", "deitar-se"],
      ["heavy", "pesado"],
      ["rest", "descansar"],
      ["tired", "cansado"],
      ["peaceful", "tranquilo"],
    ],
    reflection: "What was the best part of your day?",
    lines: {
      simple: [
        {
          en: "Lie down and close your eyes. The day is over.",
          pt: "Deite-se e feche os olhos. O dia terminou.",
          pause: 5,
        },
        {
          en: "Breathe in slowly. Breathe out slowly.",
          pt: "Inspire devagar. Expire devagar.",
          pause: 5,
        },
        {
          en: "Feel your feet. They are heavy and relaxed.",
          pt: "Sinta seus pés. Eles estão pesados e relaxados.",
          pause: 5,
        },
        {
          en: "Feel your legs. They are heavy and relaxed.",
          pt: "Sinta suas pernas. Elas estão pesadas e relaxadas.",
          pause: 5,
        },
        {
          en: "Feel your arms and your hands. Let them rest.",
          pt: "Sinta seus braços e suas mãos. Deixe-os descansar.",
          pause: 5,
        },
        {
          en: "Relax your face. Your eyes. Your mouth.",
          pt: "Relaxe o rosto. Os olhos. A boca.",
          pause: 6,
        },
        {
          en: "You did enough today. Now it is time to rest.",
          pt: "Você fez o suficiente hoje. Agora é hora de descansar.",
          pause: 6,
        },
        {
          en: "Breathe in. Breathe out. Peaceful and calm.",
          pt: "Inspire. Expire. Tranquilo e calmo.",
          pause: 6,
        },
        { en: "Good night.", pt: "Boa noite.", pause: 2 },
      ],
      rich: [
        {
          en: "Lie down comfortably and allow your eyes to close. The day is behind you now.",
          pt: "Deite-se confortavelmente e deixe os olhos se fecharem. O dia ficou para trás.",
          pause: 5,
        },
        {
          en: "Let your breathing slow down naturally, without forcing anything.",
          pt: "Deixe a respiração desacelerar naturalmente, sem forçar nada.",
          pause: 5,
        },
        {
          en: "Bring your attention to your feet, and imagine them becoming warm and heavy.",
          pt: "Leve a atenção aos pés e imagine-os ficando quentes e pesados.",
          pause: 5,
        },
        {
          en: "Let that heaviness move slowly up through your legs and into your hips.",
          pt: "Deixe esse peso subir devagar pelas pernas até os quadris.",
          pause: 5,
        },
        {
          en: "Your back sinks into the bed, and your shoulders soften.",
          pt: "Suas costas afundam na cama, e seus ombros se soltam.",
          pause: 5,
        },
        {
          en: "Release the small muscles around your eyes, your forehead and your jaw.",
          pt: "Solte os pequenos músculos ao redor dos olhos, da testa e da mandíbula.",
          pause: 6,
        },
        {
          en: "Whatever happened today, you can set it down for now. Tomorrow is a new start.",
          pt: "O que quer que tenha acontecido hoje, você pode deixar de lado por agora. Amanhã é um novo começo.",
          pause: 6,
        },
        {
          en: "Rest in the quiet rhythm of your breath.",
          pt: "Descanse no ritmo tranquilo da sua respiração.",
          pause: 6,
        },
        { en: "Sleep well.", pt: "Durma bem.", pause: 2 },
      ],
    },
  },
  {
    id: "work-break",
    title: "Two-minute break",
    when: "In the middle of work or study",
    words: [
      ["break", "pausa"],
      ["stretch", "alongar"],
      ["neck", "pescoço"],
      ["energy", "energia"],
      ["back to", "de volta a"],
    ],
    reflection: "What will you do next, after this break?",
    lines: {
      simple: [
        {
          en: "Time for a short break. Stop what you are doing.",
          pt: "Hora de uma pausa curta. Pare o que está fazendo.",
          pause: 3,
        },
        {
          en: "Look away from the screen. Look far away.",
          pt: "Olhe para longe da tela. Olhe bem longe.",
          pause: 5,
        },
        {
          en: "Move your neck slowly, to the left, and to the right.",
          pt: "Mova o pescoço devagar, para a esquerda e para a direita.",
          pause: 6,
        },
        {
          en: "Lift your shoulders up, and let them drop.",
          pt: "Levante os ombros e deixe-os cair.",
          pause: 4,
        },
        { en: "Stretch your arms up high.", pt: "Alongue os braços bem para cima.", pause: 5 },
        { en: "Breathe in deeply. Breathe out.", pt: "Inspire profundamente. Expire.", pause: 5 },
        { en: "Drink some water if you can.", pt: "Beba um pouco de água, se puder.", pause: 4 },
        {
          en: "Good. You have new energy. Back to work.",
          pt: "Ótimo. Você tem energia nova. De volta ao trabalho.",
          pause: 2,
        },
      ],
      rich: [
        {
          en: "Let's take a quick reset. Pause whatever you're working on.",
          pt: "Vamos fazer uma pausa rápida. Pare o que está fazendo.",
          pause: 3,
        },
        {
          en: "Look away from the screen and let your eyes rest on something in the distance.",
          pt: "Desvie o olhar da tela e descanse os olhos em algo distante.",
          pause: 5,
        },
        {
          en: "Slowly tilt your head towards one shoulder, then the other, feeling the stretch in your neck.",
          pt: "Incline a cabeça devagar em direção a um ombro, depois ao outro, sentindo o alongamento no pescoço.",
          pause: 6,
        },
        {
          en: "Roll your shoulders back a few times and let them settle.",
          pt: "Gire os ombros para trás algumas vezes e deixe-os se acomodar.",
          pause: 5,
        },
        {
          en: "Reach your arms overhead and stretch, as if you've just woken up.",
          pt: "Estique os braços acima da cabeça e alongue-se, como se tivesse acabado de acordar.",
          pause: 5,
        },
        {
          en: "Take a full breath in, hold it for a moment, and let it out slowly.",
          pt: "Inspire profundamente, segure por um momento e solte devagar.",
          pause: 5,
        },
        {
          en: "Have a sip of water, and notice how much clearer you feel.",
          pt: "Tome um gole de água e perceba como se sente mais desperto.",
          pause: 4,
        },
        {
          en: "Great. Return to your task with fresh energy and a clearer mind.",
          pt: "Ótimo. Volte à sua tarefa com energia renovada e a mente mais clara.",
          pause: 2,
        },
      ],
    },
  },
];

/** Rough length of a session in minutes: speech at about 2.3 words a second plus the pauses. */
export function meditationMinutes(lines: MeditationLine[], rate: number) {
  const seconds = lines.reduce(
    (sum, line) => sum + line.en.split(/\s+/).length / (2.3 * rate) + line.pause,
    0,
  );
  return Math.max(1, Math.round(seconds / 60));
}

/** The English labels shown through uiPt, for the translation check. */
export const MEDITATION_LABELS = MEDITATIONS.flatMap((session) => [session.title, session.when]);
