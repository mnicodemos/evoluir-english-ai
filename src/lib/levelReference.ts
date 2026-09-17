/**
 * Full study reference for each CEFR level: grammar with explanations and examples,
 * reading texts, phrasal verbs, linking words and irregular verbs in context.
 * Used by the course PDF and the progress PDF so the student can study offline.
 */

export type GrammarPoint = {
  title: string;
  explanation: string;
  structure: string;
  examples: string[];
};

export type ReadingText = {
  title: string;
  text: string;
  pt: string;
};

export type LexicalItem = { term: string; pt: string; example: string };

export type LevelReference = {
  overview: string;
  grammar: GrammarPoint[];
  readings: ReadingText[];
  phrasalVerbs: LexicalItem[];
  linkingWords: LexicalItem[];
  irregularVerbs: { base: string; past: string; participle: string; pt: string; example: string }[];
  writingModel: { title: string; text: string; notes: string[] };
  speakingPhrases: LexicalItem[];
};

const IRREGULAR_BANK: Record<string, LevelReference["irregularVerbs"]> = {
  core: [
    { base: "be", past: "was / were", participle: "been", pt: "ser / estar", example: "I have been busy since Monday." },
    { base: "have", past: "had", participle: "had", pt: "ter", example: "She had a meeting yesterday." },
    { base: "do", past: "did", participle: "done", pt: "fazer", example: "We have done the report already." },
    { base: "go", past: "went", participle: "gone", pt: "ir", example: "They went to the office by train." },
    { base: "make", past: "made", participle: "made", pt: "fazer / produzir", example: "He made a good decision." },
    { base: "take", past: "took", participle: "taken", pt: "pegar / levar", example: "I took the early flight." },
    { base: "get", past: "got", participle: "got / gotten", pt: "obter / ficar", example: "We got the confirmation email." },
    { base: "say", past: "said", participle: "said", pt: "dizer", example: "She said the deadline is Friday." },
    { base: "come", past: "came", participle: "come", pt: "vir", example: "The client came to our office." },
    { base: "see", past: "saw", participle: "seen", pt: "ver", example: "I have seen this problem before." },
  ],
  work: [
    { base: "send", past: "sent", participle: "sent", pt: "enviar", example: "I sent the invoice this morning." },
    { base: "write", past: "wrote", participle: "written", pt: "escrever", example: "She has written the summary." },
    { base: "speak", past: "spoke", participle: "spoken", pt: "falar", example: "We spoke with the supplier." },
    { base: "meet", past: "met", participle: "met", pt: "encontrar-se", example: "They met the new manager." },
    { base: "keep", past: "kept", participle: "kept", pt: "manter", example: "Please keep me updated." },
    { base: "understand", past: "understood", participle: "understood", pt: "entender", example: "I understood your point." },
    { base: "think", past: "thought", participle: "thought", pt: "pensar", example: "I thought the same thing." },
    { base: "bring", past: "brought", participle: "brought", pt: "trazer", example: "He brought the documents." },
    { base: "choose", past: "chose", participle: "chosen", pt: "escolher", example: "We have chosen the second option." },
    { base: "spend", past: "spent", participle: "spent", pt: "gastar / passar", example: "I spent two hours on it." },
  ],
  advanced: [
    { base: "arise", past: "arose", participle: "arisen", pt: "surgir", example: "A new issue arose during the audit." },
    { base: "undergo", past: "underwent", participle: "undergone", pt: "passar por", example: "The team underwent training." },
    { base: "withdraw", past: "withdrew", participle: "withdrawn", pt: "retirar", example: "They withdrew the proposal." },
    { base: "overcome", past: "overcame", participle: "overcome", pt: "superar", example: "We overcame the delay." },
    { base: "seek", past: "sought", participle: "sought", pt: "buscar", example: "She sought a second opinion." },
    { base: "bear", past: "bore", participle: "borne", pt: "suportar / carregar", example: "The plan bore good results." },
    { base: "strike", past: "struck", participle: "struck", pt: "atingir / impressionar", example: "The idea struck me as risky." },
    { base: "lead", past: "led", participle: "led", pt: "liderar", example: "He led the negotiation." },
  ],
};

const PHRASALS_BASIC: LexicalItem[] = [
  { term: "wake up", pt: "acordar", example: "I wake up at six every day." },
  { term: "get up", pt: "levantar-se", example: "She gets up late on Sundays." },
  { term: "turn on / turn off", pt: "ligar / desligar", example: "Please turn off the lights." },
  { term: "look for", pt: "procurar", example: "I'm looking for my keys." },
  { term: "come back", pt: "voltar", example: "He comes back at seven." },
  { term: "sit down", pt: "sentar-se", example: "Sit down, please." },
  { term: "put on", pt: "vestir", example: "Put on your jacket, it's cold." },
  { term: "go out", pt: "sair", example: "We go out on Fridays." },
];

const PHRASALS_WORK: LexicalItem[] = [
  { term: "follow up", pt: "dar seguimento", example: "I'll follow up with the client tomorrow." },
  { term: "figure out", pt: "descobrir / entender", example: "We need to figure out the root cause." },
  { term: "carry out", pt: "executar", example: "The team carried out the tests." },
  { term: "reach out", pt: "entrar em contato", example: "Feel free to reach out if you need help." },
  { term: "sort out", pt: "resolver", example: "Let's sort out the payment issue." },
  { term: "point out", pt: "destacar", example: "She pointed out a mistake in the data." },
  { term: "wrap up", pt: "concluir", example: "Let's wrap up the meeting." },
  { term: "take on", pt: "assumir", example: "He took on more responsibility." },
  { term: "put off", pt: "adiar", example: "They put off the launch to June." },
  { term: "come up with", pt: "criar / bolar", example: "We came up with a better plan." },
];

const PHRASALS_ADVANCED: LexicalItem[] = [
  { term: "scale back", pt: "reduzir escala", example: "We scaled back the project budget." },
  { term: "roll out", pt: "implantar", example: "They rolled out the new system globally." },
  { term: "iron out", pt: "resolver detalhes", example: "We ironed out the final details." },
  { term: "weigh up", pt: "ponderar", example: "Let's weigh up the pros and cons." },
  { term: "back down", pt: "recuar", example: "The supplier backed down on the price." },
  { term: "bring about", pt: "provocar", example: "The change brought about better results." },
  { term: "account for", pt: "explicar / representar", example: "Exports account for 40% of revenue." },
  { term: "phase out", pt: "descontinuar", example: "They will phase out the old plan." },
];

const LINKING_BASIC: LexicalItem[] = [
  { term: "and", pt: "e", example: "I work and I study." },
  { term: "but", pt: "mas", example: "It's cheap but useful." },
  { term: "because", pt: "porque", example: "I stayed home because I was tired." },
  { term: "so", pt: "então", example: "It rained, so we took a taxi." },
  { term: "also", pt: "também", example: "She also speaks Spanish." },
  { term: "then", pt: "então / depois", example: "First we talk, then we decide." },
  { term: "for example", pt: "por exemplo", example: "I like fruit, for example apples." },
  { term: "finally", pt: "finalmente", example: "Finally, we finished the task." },
];

const LINKING_INTERMEDIATE: LexicalItem[] = [
  { term: "however", pt: "no entanto", example: "The price is high; however, the quality is excellent." },
  { term: "although", pt: "embora", example: "Although it was late, we continued." },
  { term: "therefore", pt: "portanto", example: "Costs rose; therefore, we adjusted the plan." },
  { term: "in addition", pt: "além disso", example: "In addition, we offer free support." },
  { term: "on the other hand", pt: "por outro lado", example: "On the other hand, delivery is slower." },
  { term: "as a result", pt: "como resultado", example: "As a result, sales increased." },
  { term: "in order to", pt: "a fim de", example: "We met in order to align the schedule." },
  { term: "instead of", pt: "em vez de", example: "Instead of calling, send an email." },
  { term: "meanwhile", pt: "enquanto isso", example: "Meanwhile, the team prepared the data." },
  { term: "in short", pt: "em resumo", example: "In short, the project is on track." },
];

const LINKING_ADVANCED: LexicalItem[] = [
  { term: "nevertheless", pt: "mesmo assim", example: "The risk is real; nevertheless, we moved forward." },
  { term: "provided that", pt: "desde que", example: "We can start provided that the budget is approved." },
  { term: "whereas", pt: "ao passo que", example: "Sales grew, whereas margins fell." },
  { term: "consequently", pt: "consequentemente", example: "Demand dropped and, consequently, prices fell." },
  { term: "with regard to", pt: "com relação a", example: "With regard to timing, we need one more week." },
  { term: "to sum up", pt: "resumindo", example: "To sum up, the strategy worked." },
  { term: "in spite of", pt: "apesar de", example: "In spite of the delay, we delivered." },
  { term: "not only... but also", pt: "não apenas... mas também", example: "Not only did we save time, but we also cut costs." },
];

const SPEAKING_BASIC: LexicalItem[] = [
  { term: "Could you repeat that, please?", pt: "Você poderia repetir, por favor?", example: "Sorry, could you repeat that, please?" },
  { term: "How do you say ... in English?", pt: "Como se diz ... em inglês?", example: "How do you say 'prazo' in English?" },
  { term: "I'm not sure, but I think...", pt: "Não tenho certeza, mas acho que...", example: "I'm not sure, but I think it's on Friday." },
  { term: "Let me think for a second.", pt: "Deixe-me pensar um segundo.", example: "Let me think for a second before I answer." },
];

const SPEAKING_WORK: LexicalItem[] = [
  { term: "From my point of view,", pt: "Do meu ponto de vista,", example: "From my point of view, we should test first." },
  { term: "That's a good point, but...", pt: "É um bom ponto, mas...", example: "That's a good point, but the cost is high." },
  { term: "Just to clarify,", pt: "Só para esclarecer,", example: "Just to clarify, the deadline is next Monday." },
  { term: "Let's move on to...", pt: "Vamos passar para...", example: "Let's move on to the budget." },
  { term: "I'd like to add that...", pt: "Gostaria de acrescentar que...", example: "I'd like to add that the client agreed." },
  { term: "What I mean is...", pt: "O que quero dizer é...", example: "What I mean is that we need more data." },
];

const REFERENCES: Record<string, LevelReference> = {
  a1: {
    overview:
      "At A1 you build the base of English: present simple, the verb to be, articles, plurals, numbers, and everyday questions. Study each grammar point below, read the text aloud twice and copy the model sentences with your own information.",
    grammar: [
      {
        title: "Verb to be (am / is / are)",
        explanation: "Used for identity, jobs, feelings, nationality, age and places. It is the first verb you must automate.",
        structure: "I am · you/we/they are · he/she/it is | Negative: am not / isn't / aren't | Question: Are you...? Is he...?",
        examples: ["I am a project analyst.", "She is not at the office today.", "Are they Brazilian?"],
      },
      {
        title: "Present simple",
        explanation: "Habits, routines and facts. Remember the -s in he/she/it, and use do/does in questions and negatives.",
        structure: "I work / he works · Do you work? · He doesn't work",
        examples: ["I start work at nine.", "He works from home on Fridays.", "Do you speak English at work?"],
      },
      {
        title: "Articles a / an / the",
        explanation: "'a/an' for one non-specific thing, 'the' when both people know which thing.",
        structure: "a car · an email · the manager",
        examples: ["I have a meeting today.", "She sent an email.", "The report is on your desk."],
      },
      {
        title: "Plurals and there is / there are",
        explanation: "Most plurals add -s; use 'there is' for one and 'there are' for many.",
        structure: "one file / two files · There is a problem · There are two options",
        examples: ["There are three tasks today.", "There is a new client.", "We have two offices."],
      },
      {
        title: "Possessives and pronouns",
        explanation: "Show who owns what and replace names to avoid repetition.",
        structure: "my / your / his / her / our / their · 's for people",
        examples: ["This is my laptop.", "Her name is Ana.", "That is the manager's office."],
      },
      {
        title: "Basic questions (Wh-)",
        explanation: "Question words come first, then the auxiliary verb.",
        structure: "What / Where / When / Who / How + do/does + subject + verb",
        examples: ["Where do you live?", "What time does the meeting start?", "How do you go to work?"],
      },
    ],
    readings: [
      {
        title: "My working day",
        text:
          "My name is Bruno and I live in São Paulo. I am a junior analyst in a small company. I wake up at six thirty and I have coffee with my family. I go to the office by bus and I arrive at eight. In the morning I answer emails and I talk to my team. We have a short meeting every day at nine. At noon I have lunch with my colleagues. In the afternoon I study English for thirty minutes because I want a better job. I finish work at six and I go home. In the evening I cook, I watch a series in English and I go to bed at eleven.",
        pt:
          "Meu nome é Bruno e eu moro em São Paulo. Sou analista júnior em uma empresa pequena. Acordo às seis e meia e tomo café com a minha família. Vou para o escritório de ônibus e chego às oito. De manhã respondo e-mails e converso com a minha equipe. Temos uma reunião curta todos os dias às nove. Ao meio-dia almoço com meus colegas. À tarde estudo inglês por trinta minutos porque quero um emprego melhor. Termino o trabalho às seis e vou para casa. À noite cozinho, assisto a uma série em inglês e vou dormir às onze.",
      },
    ],
    phrasalVerbs: PHRASALS_BASIC,
    linkingWords: LINKING_BASIC,
    irregularVerbs: IRREGULAR_BANK["core"]!,
    writingModel: {
      title: "Short personal introduction (60-80 words)",
      text:
        "Hello! My name is Bruno. I am twenty-nine years old and I live in São Paulo. I work as a junior analyst in a technology company. I like sports, music and travelling. I study English every day because I want to work with international clients. My favourite day is Saturday because I play football with my friends. Nice to meet you!",
      notes: [
        "Start with a greeting and your name.",
        "Use present simple for facts and routines.",
        "Finish with one friendly sentence.",
      ],
    },
    speakingPhrases: SPEAKING_BASIC,
  },
  a2: {
    overview:
      "At A2 you talk about the past, make plans and compare things. Focus on past simple (regular and irregular), future forms, comparatives and countable/uncountable words.",
    grammar: [
      {
        title: "Past simple",
        explanation: "Finished actions with a finished time. Regular verbs take -ed; irregular verbs must be memorised.",
        structure: "I worked · I went · Did you go? · I didn't go",
        examples: ["I finished the report yesterday.", "We went to the client's office last week.", "Did you call him?"],
      },
      {
        title: "Past continuous",
        explanation: "An action in progress in the past, often interrupted by another action.",
        structure: "was / were + verb-ing",
        examples: ["I was writing an email when he called.", "They were working late.", "What were you doing at 10?"],
      },
      {
        title: "Future: will / going to / present continuous",
        explanation: "'will' for decisions now and predictions, 'going to' for plans, present continuous for fixed arrangements.",
        structure: "I'll call him · I'm going to study · I'm meeting the client at 3",
        examples: ["I'll send it today.", "We are going to hire two people.", "I'm flying to Recife on Monday."],
      },
      {
        title: "Comparatives and superlatives",
        explanation: "Compare two things with -er/more, and mark the top of a group with the -est/most.",
        structure: "cheaper than · more expensive than · the best",
        examples: ["This option is cheaper than the other.", "It's the most useful tool we have.", "He is better at Excel."],
      },
      {
        title: "Countable and uncountable",
        explanation: "Use many/few with countable nouns and much/little with uncountable ones.",
        structure: "many tasks · much time · a lot of work · some / any",
        examples: ["I don't have much time.", "There are many options.", "We need some information."],
      },
      {
        title: "Modals: can, should, have to",
        explanation: "Ability, advice and obligation.",
        structure: "can + verb · should + verb · have to + verb",
        examples: ["I can join the call.", "You should review it first.", "We have to answer today."],
      },
    ],
    readings: [
      {
        title: "A busy week at work",
        text:
          "Last week was very busy. On Monday I arrived early because we had a presentation for a new client. I was preparing the slides when my manager asked me to add the sales numbers. I finished them just in time. On Tuesday the client called and said the proposal was interesting, but the price was too high. We discussed the options and decided to offer a smaller package. On Thursday we sent the new proposal and they accepted it. Next month we are going to start the project, and I am going to travel to Curitiba to meet the team. It was hard work, but the result was better than I expected.",
        pt:
          "A semana passada foi muito corrida. Na segunda cheguei cedo porque tínhamos uma apresentação para um novo cliente. Eu estava preparando os slides quando meu gestor pediu para incluir os números de vendas. Terminei bem a tempo. Na terça o cliente ligou e disse que a proposta era interessante, mas o preço estava alto demais. Discutimos as opções e decidimos oferecer um pacote menor. Na quinta enviamos a nova proposta e eles aceitaram. No mês que vem vamos começar o projeto, e vou viajar para Curitiba para conhecer a equipe. Foi trabalhoso, mas o resultado foi melhor do que eu esperava.",
      },
    ],
    phrasalVerbs: [...PHRASALS_BASIC.slice(0, 4), ...PHRASALS_WORK.slice(0, 6)],
    linkingWords: [...LINKING_BASIC.slice(0, 4), ...LINKING_INTERMEDIATE.slice(0, 5)],
    irregularVerbs: IRREGULAR_BANK["core"]!,
    writingModel: {
      title: "Short email about last week (80-100 words)",
      text:
        "Hi Carla,\n\nI hope you are well. Last week we finished the first version of the report and sent it to the client. They asked for two small changes, so I updated the numbers on Thursday. On Friday we had a short call and they approved the document.\n\nNext week I am going to prepare the presentation. Could you send me the final data by Wednesday?\n\nThanks a lot,\nBruno",
      notes: [
        "Open with a greeting and one friendly line.",
        "Use past simple for what happened and going to for plans.",
        "Close with a clear request and a polite ending.",
      ],
    },
    speakingPhrases: [...SPEAKING_BASIC, ...SPEAKING_WORK.slice(0, 2)],
  },
  b1: {
    overview:
      "At B1 you connect ideas, talk about experience and handle work situations. Master present perfect, conditionals 0-1, modals of possibility, and reported speech, and start using linking words to sound organised.",
    grammar: [
      {
        title: "Present perfect vs past simple",
        explanation: "Present perfect links the past to now (experience, unfinished time, results). Past simple needs a finished time.",
        structure: "have / has + participle · already, yet, ever, never, since, for",
        examples: ["I have worked here for three years.", "Have you ever presented in English?", "I sent it yesterday."],
      },
      {
        title: "Conditionals 0 and 1",
        explanation: "Zero for facts, first for real future possibilities.",
        structure: "If + present, present · If + present, will + verb",
        examples: ["If you press this, the system restarts.", "If we finish today, we will deliver on time.", "I'll call you if there is a problem."],
      },
      {
        title: "Modals of possibility and deduction",
        explanation: "Show how certain you are.",
        structure: "must (sure) · might / may / could (possible) · can't (impossible)",
        examples: ["He must be in a meeting.", "It might rain later.", "That can't be the final price."],
      },
      {
        title: "Reported speech",
        explanation: "Report what someone said, usually one tense back.",
        structure: "He said (that) he was busy · She asked if we had the file",
        examples: ["He said he would send the invoice.", "She told me the meeting was cancelled.", "They asked when we could start."],
      },
      {
        title: "Relative clauses",
        explanation: "Add information about people, things and places without starting a new sentence.",
        structure: "who / which / that / where",
        examples: ["The client who called is from Chile.", "The tool that we use is free.", "This is the office where I work."],
      },
      {
        title: "Used to and past habits",
        explanation: "Talk about repeated past situations that are no longer true.",
        structure: "used to + verb",
        examples: ["I used to work in a bank.", "We didn't use to have remote meetings.", "Did you use to study English at school?"],
      },
      {
        title: "Gerunds and infinitives",
        explanation: "Some verbs are followed by -ing, others by to + verb.",
        structure: "enjoy / avoid / suggest + -ing · decide / plan / need + to + verb",
        examples: ["I enjoy working with data.", "We decided to postpone the launch.", "She suggested changing the layout."],
      },
    ],
    readings: [
      {
        title: "Working with an international team",
        text:
          "I have worked with international teams for three years, and I have learned that communication matters more than perfect grammar. In the beginning, I used to prepare every sentence before a call, which made me slow and nervous. However, I noticed that my colleagues appreciated clear and short messages more than complex vocabulary. Now, before a meeting, I write three key points and two questions. If I don't understand something, I simply ask the person to repeat it. Although my English is not perfect, my results have improved a lot. In fact, last month I led a call with a supplier in Canada, and we agreed on a new delivery schedule. If I keep practising every day, I will be ready for a bigger role next year.",
        pt:
          "Trabalho com equipes internacionais há três anos e aprendi que a comunicação importa mais do que a gramática perfeita. No começo, eu costumava preparar cada frase antes de uma ligação, o que me deixava lento e nervoso. No entanto, percebi que meus colegas valorizavam mensagens claras e curtas mais do que vocabulário complexo. Agora, antes de uma reunião, escrevo três pontos principais e duas perguntas. Se não entendo algo, simplesmente peço para a pessoa repetir. Embora meu inglês não seja perfeito, meus resultados melhoraram muito. Na verdade, no mês passado conduzi uma ligação com um fornecedor no Canadá e combinamos um novo cronograma de entrega. Se eu continuar praticando todos os dias, estarei pronto para um cargo maior no ano que vem.",
      },
    ],
    phrasalVerbs: PHRASALS_WORK,
    linkingWords: LINKING_INTERMEDIATE,
    irregularVerbs: [...IRREGULAR_BANK["core"]!, ...IRREGULAR_BANK["work"]!],
    writingModel: {
      title: "Professional email with a request (100-130 words)",
      text:
        "Dear Mr. Silva,\n\nI hope this email finds you well. I am writing regarding the delivery schedule we discussed last week. We have already reviewed the technical requirements, and the team is ready to start on the 15th.\n\nHowever, we still need the final list of items. Could you please send it by Friday? If we receive it on time, we will be able to complete the first phase before the end of the month.\n\nPlease let me know if you have any questions. I look forward to your reply.\n\nBest regards,\nBruno Alves",
      notes: [
        "Paragraph 1: reason for writing. Paragraph 2: the request. Paragraph 3: closing.",
        "Use present perfect for what is already done.",
        "Use linking words (however, if, therefore) to connect the ideas.",
      ],
    },
    speakingPhrases: SPEAKING_WORK,
  },
  b2: {
    overview:
      "At B2 you argue, negotiate and explain complex ideas. Focus on passive voice, conditionals 2-3, perfect tenses, and precise connectors so your speech and writing sound professional.",
    grammar: [
      {
        title: "Passive voice",
        explanation: "Focus on the action or the result, not on who did it. Common in reports and processes.",
        structure: "be + participle (+ by ...)",
        examples: ["The report was sent yesterday.", "The system is being updated.", "The decision has been approved by the board."],
      },
      {
        title: "Second and third conditionals",
        explanation: "Second for unreal present/future, third for regrets about the past.",
        structure: "If + past, would + verb · If + had + participle, would have + participle",
        examples: ["If I had more time, I would redo the analysis.", "If we had tested it, we wouldn't have lost the client.", "I would accept the offer if the salary were higher."],
      },
      {
        title: "Present perfect continuous",
        explanation: "Emphasises the duration of an activity that continues or has just stopped.",
        structure: "have / has been + verb-ing",
        examples: ["We have been working on this for two months.", "She has been leading the project since April.", "How long have you been studying English?"],
      },
      {
        title: "Past perfect",
        explanation: "The earlier of two past actions.",
        structure: "had + participle",
        examples: ["When I arrived, the meeting had already started.", "They had finished before the deadline.", "He said he had spoken to the client."],
      },
      {
        title: "Advanced modals",
        explanation: "Express deduction and criticism about the past.",
        structure: "must have / might have / should have / couldn't have + participle",
        examples: ["They must have misunderstood the brief.", "We should have confirmed the numbers.", "She might have sent it to the wrong address."],
      },
      {
        title: "Hedging and diplomatic language",
        explanation: "Soften opinions in negotiations to sound professional rather than aggressive.",
        structure: "It seems that... · I'm afraid... · That could be tricky · We may need to reconsider",
        examples: ["I'm afraid that timeline is a bit tight.", "It seems there is a small misunderstanding.", "We may need to reconsider the scope."],
      },
      {
        title: "Complex noun phrases and cohesion",
        explanation: "Combine information into one clear sentence instead of many short ones.",
        structure: "the recently approved budget · a solution designed to reduce costs",
        examples: ["The recently approved budget covers two new hires.", "We proposed a solution designed to cut delivery time.", "This is an issue affecting all regions."],
      },
    ],
    readings: [
      {
        title: "Negotiating a deadline",
        text:
          "Last quarter our team was asked to deliver a platform migration in six weeks. The scope had been defined before I joined the project, and several dependencies had not been mapped. Although the plan looked reasonable on paper, we realised that testing would be reduced to almost nothing. I therefore prepared a short document with three scenarios: deliver everything in six weeks with high risk, deliver the core modules in six weeks and the rest in four more, or extend the whole project by three weeks. During the call, I explained that if we rushed the tests, we would probably spend more time fixing problems later. The client agreed with the second scenario. In retrospect, we should have raised the issue earlier; nevertheless, presenting options instead of problems made the conversation constructive, and the relationship became stronger.",
        pt:
          "No trimestre passado pediram à nossa equipe a entrega de uma migração de plataforma em seis semanas. O escopo havia sido definido antes de eu entrar no projeto, e várias dependências não tinham sido mapeadas. Embora o plano parecesse razoável no papel, percebemos que os testes ficariam reduzidos a quase nada. Por isso preparei um documento curto com três cenários: entregar tudo em seis semanas com alto risco, entregar os módulos principais em seis semanas e o restante em mais quatro, ou estender o projeto inteiro em três semanas. Durante a call, expliquei que, se apressássemos os testes, provavelmente gastaríamos mais tempo corrigindo problemas depois. O cliente concordou com o segundo cenário. Em retrospecto, deveríamos ter levantado a questão antes; mesmo assim, apresentar opções em vez de problemas tornou a conversa construtiva, e a relação ficou mais forte.",
      },
    ],
    phrasalVerbs: [...PHRASALS_WORK, ...PHRASALS_ADVANCED.slice(0, 4)],
    linkingWords: [...LINKING_INTERMEDIATE, ...LINKING_ADVANCED.slice(0, 4)],
    irregularVerbs: [...IRREGULAR_BANK["work"]!, ...IRREGULAR_BANK["advanced"]!.slice(0, 5)],
    writingModel: {
      title: "Opinion / proposal message (140-180 words)",
      text:
        "Hi team,\n\nAfter reviewing the results of the pilot, I would like to propose a small change to our process.\n\nThe data shows that 30% of the tickets have been reopened because the first answer was incomplete. Although the response time is good, quality is clearly suffering. If we introduced a short checklist before closing a ticket, we would probably reduce reopenings without slowing the team down.\n\nI suggest testing the checklist with one squad for two weeks and comparing the numbers. Should the results be positive, we can roll it out to the whole department.\n\nI'm happy to prepare the checklist and share it by Friday. Let me know what you think.\n\nBest,\nBruno",
      notes: [
        "State the purpose in the first line.",
        "Support the opinion with data, then propose a concrete action.",
        "Use hedging (would, probably, I suggest) to sound professional.",
      ],
    },
    speakingPhrases: [
      ...SPEAKING_WORK,
      { term: "If I understood correctly,", pt: "Se entendi corretamente,", example: "If I understood correctly, you need it by Friday." },
      { term: "Would it be possible to...?", pt: "Seria possível...?", example: "Would it be possible to extend the deadline?" },
    ],
  },
  c1: {
    overview:
      "At C1 you express nuance, structure long arguments and adapt register. Focus on inversion, cleft sentences, advanced conditionals, nominalisation and idiomatic collocations.",
    grammar: [
      {
        title: "Inversion for emphasis",
        explanation: "Move the negative or restrictive adverb to the front and invert subject and auxiliary.",
        structure: "Not only did we... · Rarely have I... · Only after... did we...",
        examples: ["Not only did we cut costs, but we also improved quality.", "Rarely have I seen such a clear proposal.", "Only after the audit did they change the process."],
      },
      {
        title: "Cleft sentences",
        explanation: "Highlight one part of the message.",
        structure: "What we need is... · It was X that...",
        examples: ["What we need is a realistic timeline.", "It was the pricing model that convinced them.", "What surprised me was the response rate."],
      },
      {
        title: "Mixed conditionals",
        explanation: "Combine a past condition with a present result, or vice versa.",
        structure: "If + had + participle, would + verb (now)",
        examples: ["If we had hired earlier, we would be ahead of schedule now.", "If she weren't so experienced, we would have failed.", "If I had studied abroad, I would speak more fluently."],
      },
      {
        title: "Nominalisation",
        explanation: "Turn verbs into nouns for a formal, written register.",
        structure: "implement → implementation · decide → decision",
        examples: ["The implementation of the policy took six months.", "Their decision reflects market pressure.", "The reduction in costs was significant."],
      },
      {
        title: "Discourse markers in speech",
        explanation: "Signal structure and attitude in a natural way.",
        structure: "having said that · as far as I'm concerned · to be fair · in other words",
        examples: ["Having said that, the risk remains.", "As far as I'm concerned, the plan is solid.", "To be fair, they warned us."],
      },
      {
        title: "Collocations and precision",
        explanation: "Advanced fluency depends on word partnerships, not rare words.",
        structure: "make a decision · reach an agreement · raise concerns · meet a deadline",
        examples: ["We reached an agreement after two calls.", "Several stakeholders raised concerns.", "The team consistently meets deadlines."],
      },
    ],
    readings: [
      {
        title: "Leading change without authority",
        text:
          "What most professionals underestimate is how much influence depends on framing rather than hierarchy. When I was asked to coordinate a cross-functional initiative, I had no formal authority over any of the participants. Rarely have I faced a situation in which listening mattered so much. Instead of presenting a finished plan, I interviewed each team, mapped their constraints and returned with a draft that explicitly addressed their concerns. Not only did this reduce resistance, but it also produced a better solution than the one I had originally designed. Had I imposed the initial version, the project would probably still be stuck in review. The lesson, in other words, is that the implementation of any change depends less on the quality of the idea than on the perceived ownership of the people who have to execute it.",
        pt:
          "O que a maioria dos profissionais subestima é o quanto a influência depende do enquadramento e não da hierarquia. Quando me pediram para coordenar uma iniciativa multifuncional, eu não tinha autoridade formal sobre nenhum dos participantes. Raramente enfrentei uma situação em que ouvir importasse tanto. Em vez de apresentar um plano pronto, entrevistei cada equipe, mapeei suas restrições e voltei com um rascunho que tratava explicitamente das preocupações delas. Isso não só reduziu a resistência, como também gerou uma solução melhor do que a que eu havia desenhado originalmente. Se eu tivesse imposto a versão inicial, o projeto provavelmente ainda estaria travado em revisão. A lição, em outras palavras, é que a implementação de qualquer mudança depende menos da qualidade da ideia do que do senso de propriedade de quem precisa executá-la.",
      },
    ],
    phrasalVerbs: PHRASALS_ADVANCED,
    linkingWords: LINKING_ADVANCED,
    irregularVerbs: IRREGULAR_BANK["advanced"]!,
    writingModel: {
      title: "Executive summary (180-220 words)",
      text:
        "Subject: Recommendation on the vendor selection\n\nThis note summarises our assessment of the three vendors shortlisted in March and recommends option B.\n\nAll three suppliers meet the technical requirements. However, the evaluation of total cost of ownership over three years shows a difference of 18% in favour of option B, mainly due to lower integration effort. What ultimately distinguishes this vendor is the maturity of its support model: response times are contractually guaranteed, whereas the other two rely on best-effort commitments.\n\nThere are two risks worth noting. First, option B depends on a single regional data centre; should availability become critical, a secondary region would need to be contracted. Second, migration would require two additional weeks of parallel operation.\n\nWe therefore recommend proceeding with option B, subject to the inclusion of an availability clause in the contract. Had the pricing been comparable, option A would have been an acceptable alternative.\n\nI am available to discuss the details before the steering committee on Thursday.",
      notes: [
        "One-line purpose, then evidence, then risks, then recommendation.",
        "Use nominalisation and passive voice for a formal register.",
        "Close with a clear next step.",
      ],
    },
    speakingPhrases: [
      { term: "Having said that,", pt: "Dito isso,", example: "Having said that, we still need approval." },
      { term: "As far as I'm concerned,", pt: "No que me diz respeito,", example: "As far as I'm concerned, the data is reliable." },
      { term: "Let me play devil's advocate.", pt: "Deixe-me fazer o advogado do diabo.", example: "Let me play devil's advocate for a moment." },
      { term: "I'd push back on that slightly.", pt: "Eu discordaria um pouco disso.", example: "I'd push back on that slightly — the sample is small." },
    ],
  },
  c2: {
    overview:
      "At C2 the goal is precision, register control and idiomatic ease. Work on subtle modality, ellipsis, formal and informal registers, idioms, and rhetorical structure in long turns.",
    grammar: [
      {
        title: "Subtle modality and hedging",
        explanation: "Fine degrees of certainty, obligation and diplomacy.",
        structure: "may well · is unlikely to · would appear to · there is a case for",
        examples: ["The delay may well be structural.", "This is unlikely to affect revenue.", "There is a case for revisiting the strategy."],
      },
      {
        title: "Ellipsis and substitution",
        explanation: "Omit repeated elements as native speakers do.",
        structure: "so / do / one / neither",
        examples: ["I thought so.", "She works harder than I do.", "Neither did we."],
      },
      {
        title: "Register shifting",
        explanation: "Move between formal, neutral and colloquial versions of the same idea.",
        structure: "We are unable to proceed / We can't go ahead / We're stuck",
        examples: ["We are unable to proceed at this stage.", "We can't go ahead right now.", "Honestly, we're stuck."],
      },
      {
        title: "Idioms and fixed expressions",
        explanation: "Use them sparingly but accurately.",
        structure: "cut corners · move the needle · a ballpark figure · get the ball rolling",
        examples: ["We can't afford to cut corners.", "That change didn't move the needle.", "Give me a ballpark figure."],
      },
      {
        title: "Rhetorical structure",
        explanation: "Organise a long spoken turn like a written argument: claim, evidence, concession, conclusion.",
        structure: "Broadly speaking... · Admittedly... · That said... · On balance...",
        examples: ["Broadly speaking, adoption is healthy.", "Admittedly, churn rose in Q2.", "On balance, the strategy is working."],
      },
    ],
    readings: [
      {
        title: "The limits of measurement",
        text:
          "Broadly speaking, organisations measure what is easy to count rather than what genuinely matters, and the consequences are rarely visible until it is too late. Admittedly, metrics create alignment: teams that share numbers argue less about priorities. That said, once a measure becomes a target, people optimise for the indicator instead of the outcome it was supposed to represent. Support teams close tickets faster; customers are no happier. Engineering ships more releases; reliability erodes. What is needed is not fewer metrics but a deliberate pairing of each efficiency measure with a quality counterweight, along with the intellectual honesty to retire indicators that no longer inform decisions. On balance, the organisations that thrive are not those with the most sophisticated dashboards, but those willing to ask, periodically and uncomfortably, whether the numbers still describe reality.",
        pt:
          "De modo geral, as organizações medem o que é fácil de contar em vez do que realmente importa, e as consequências raramente aparecem antes que seja tarde demais. É verdade que métricas criam alinhamento: equipes que compartilham números discutem menos sobre prioridades. Dito isso, quando uma medida vira meta, as pessoas otimizam o indicador em vez do resultado que ele deveria representar. Equipes de suporte fecham chamados mais rápido; os clientes não ficam mais satisfeitos. Engenharia entrega mais versões; a confiabilidade se deteriora. O necessário não são menos métricas, mas o emparelhamento deliberado de cada medida de eficiência com um contrapeso de qualidade, além da honestidade intelectual de aposentar indicadores que já não informam decisões. No conjunto, as organizações que prosperam não são as que têm os painéis mais sofisticados, mas as dispostas a perguntar, periódica e desconfortavelmente, se os números ainda descrevem a realidade.",
      },
    ],
    phrasalVerbs: [...PHRASALS_ADVANCED, ...PHRASALS_WORK.slice(0, 4)],
    linkingWords: [...LINKING_ADVANCED, ...LINKING_INTERMEDIATE.slice(0, 4)],
    irregularVerbs: [...IRREGULAR_BANK["advanced"]!, ...IRREGULAR_BANK["work"]!.slice(0, 4)],
    writingModel: {
      title: "Persuasive position paper (200-240 words)",
      text:
        "Subject: Why we should decouple release cadence from feature scope\n\nOur current model ties every release to a fixed feature set, and it is increasingly clear that this arrangement serves the calendar rather than the customer.\n\nThe evidence is consistent. Over the last four quarters, 62% of releases slipped, and in each case the delay was caused by a single component rather than by the package as a whole. Admittedly, bundled releases simplify communication and reduce the coordination burden on marketing. That said, the cost of that simplicity is now measurable: features that are ready wait an average of nineteen days before reaching users.\n\nI propose that we decouple cadence from scope. Releases would ship on a fixed fortnightly schedule with whatever is complete and validated; anything unfinished simply moves to the next window. Marketing would communicate quarterly themes rather than individual dates, which is arguably a more compelling narrative anyway.\n\nThis is unlikely to be disruptive: three teams already operate this way informally, and their defect rate is no higher than the average.\n\nOn balance, decoupling reduces idle value, removes the incentive to rush unfinished work, and gives us a more honest conversation with customers. I would welcome the chance to pilot it with two teams next quarter.",
      notes: [
        "Claim, evidence, concession, proposal, rebuttal of the main objection, conclusion.",
        "Control register: formal but not stiff; avoid idioms in the evidence section.",
        "Use hedging (arguably, is unlikely to, on balance) to sound authoritative rather than dogmatic.",
      ],
    },
    speakingPhrases: [
      { term: "Broadly speaking,", pt: "De modo geral,", example: "Broadly speaking, the trend is positive." },
      { term: "On balance,", pt: "No conjunto,", example: "On balance, I'd recommend waiting." },
      { term: "That's a fair point, although...", pt: "É um ponto justo, embora...", example: "That's a fair point, although the sample is limited." },
      { term: "Let me qualify that.", pt: "Deixe-me matizar isso.", example: "Let me qualify that: it applies only to new users." },
    ],
  },
};

/** Returns the full study reference for a CEFR level (falls back to B1). */
export function getLevelReference(level: string): LevelReference {
  return REFERENCES[String(level).toLowerCase()] ?? REFERENCES["b1"]!;
}
