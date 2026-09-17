/**
 * Fixed CEFR curriculum: every level has 30 core lessons in 5 units, followed
 * by an optional 3-lesson review unit.
 * The lessons rotate through the four skills the student needs to master the level:
 * listening, reading, talking and writing, plus vocabulary and grammar consolidation.
 * The content of each lesson is written by the AI the first time the student opens it.
 */

export const SKILL_ORDER = ["listening", "reading", "talking", "writing", "vocabulary", "grammar"] as const;
export type Skill = (typeof SKILL_ORDER)[number];

export const LESSONS_PER_UNIT = 6;
export const CORE_UNITS_PER_LEVEL = 5;
export const CORE_LESSONS_PER_LEVEL = LESSONS_PER_UNIT * CORE_UNITS_PER_LEVEL;
export const REVIEW_LESSONS_PER_LEVEL = 3;
export const UNITS_PER_LEVEL = CORE_UNITS_PER_LEVEL + 1;
export const LESSONS_PER_LEVEL = CORE_LESSONS_PER_LEVEL + REVIEW_LESSONS_PER_LEVEL;

type UnitBlueprint = {
  title: string;
  category: string;
  /** Exactly 6 lessons: [title, objective], in the SKILL_ORDER sequence. */
  lessons: [string, string][];
};

export type CurriculumLesson = {
  key: string;
  level: string;
  unit: number;
  unitTitle: string;
  position: number;
  index: number;
  title: string;
  objective: string;
  skill: Skill;
  category: string;
  reviewUnits: number[];
  isReviewTest: boolean;
};

const CURRICULUM: Record<string, UnitBlueprint[]> = {
  a1: [
    {
      title: "Unit 1 — First Contact",
      category: "speaking",
      lessons: [
        ["Hearing Greetings and Names", "Understand simple greetings, names and countries when people speak slowly."],
        ["Reading Short Introductions", "Read very short profiles and find names, jobs and countries."],
        ["Introducing Yourself", "Say your name, age, country and job in short sentences."],
        ["Writing a Simple Profile", "Write four short sentences about yourself with correct punctuation."],
        ["Everyday Greeting Words", "Use 12 core words for greetings, farewells and polite answers."],
        ["Verb To Be in the Present", "Use am, is and are correctly in positive, negative and question forms."],
      ],
    },
    {
      title: "Unit 2 — People and Places",
      category: "vocabulary",
      lessons: [
        ["Listening to Descriptions of People", "Catch simple details about age, family and appearance."],
        ["Reading About a Family", "Understand a short text about a family and answer basic questions."],
        ["Talking About Your Family", "Describe your family with have/has and simple adjectives."],
        ["Writing About Where You Live", "Write five sentences about your home and city."],
        ["Home and Family Words", "Learn key nouns for rooms, furniture and family members."],
        ["Articles and Plurals", "Use a, an, the and regular plural forms correctly."],
      ],
    },
    {
      title: "Unit 3 — Daily Routine",
      category: "grammar",
      lessons: [
        ["Listening to Daily Routines", "Understand times and daily actions in a slow description."],
        ["Reading a Weekly Schedule", "Read a simple schedule and find days, times and activities."],
        ["Describing Your Day", "Talk about your routine using times and frequency words."],
        ["Writing Your Daily Routine", "Write a short paragraph about a typical day."],
        ["Time and Routine Words", "Use words for days, months, clock times and common actions."],
        ["Present Simple and Frequency", "Form present simple with he/she/it and always, often, never."],
      ],
    },
    {
      title: "Unit 4 — Food and Shopping",
      category: "travel",
      lessons: [
        ["Listening at a Café", "Understand simple orders, prices and short answers."],
        ["Reading a Menu and a Price List", "Find dishes, prices and quantities in a short menu."],
        ["Ordering Food and Drinks", "Order politely with I'd like and ask for the price."],
        ["Writing a Shopping List and Note", "Write a clear list and a short note with quantities."],
        ["Food, Drinks and Money Words", "Learn common food items, containers and money expressions."],
        ["Countable and Uncountable Nouns", "Use some, any, much and many correctly."],
      ],
    },
    {
      title: "Unit 5 — Simple Plans",
      category: "speaking",
      lessons: [
        ["Listening to Simple Invitations", "Understand invitations, days and short arrangements."],
        ["Reading a Short Message", "Understand a simple message with a plan and a time."],
        ["Making and Accepting Plans", "Invite, accept and refuse politely in short sentences."],
        ["Writing a Short Invitation", "Write a friendly message with day, time and place."],
        ["Places and Activity Words", "Use words for leisure places and free-time activities."],
        ["Can, Want To and Going To", "Talk about ability, wishes and simple future plans."],
      ],
    },
  ],
  a2: [
    {
      title: "Unit 1 — Past Experiences",
      category: "grammar",
      lessons: [
        ["Listening to a Short Story", "Follow a simple past story and catch the main events."],
        ["Reading a Personal Anecdote", "Understand a short past narrative and its time order."],
        ["Telling What You Did", "Talk about last weekend with past simple verbs."],
        ["Writing a Short Diary Entry", "Write a paragraph about a past day with linkers."],
        ["Past Time Expressions", "Use ago, last, yesterday and time sequencers correctly."],
        ["Past Simple: Regular and Irregular", "Form positive, negative and questions in past simple."],
      ],
    },
    {
      title: "Unit 2 — Home and City",
      category: "vocabulary",
      lessons: [
        ["Listening to Directions", "Follow simple street directions and landmarks."],
        ["Reading a City Guide", "Find practical information in a short city text."],
        ["Giving Directions", "Explain how to get somewhere with clear instructions."],
        ["Writing a Place Description", "Describe a neighbourhood in one organised paragraph."],
        ["City and Direction Words", "Learn key places, prepositions of place and movement verbs."],
        ["There Is / There Are and Prepositions", "Describe locations accurately with there is/are."],
      ],
    },
    {
      title: "Unit 3 — Work Basics",
      category: "speaking",
      lessons: [
        ["Listening to Workplace Small Talk", "Understand simple work conversations and requests."],
        ["Reading a Job Advert", "Understand duties and requirements in a short advert."],
        ["Talking About Your Job", "Describe tasks, hours and responsibilities clearly."],
        ["Writing a Simple Work Email", "Write a polite email asking for information."],
        ["Jobs and Office Words", "Learn common job titles, tools and workplace actions."],
        ["Modals for Requests and Rules", "Use can, could, have to and must appropriately."],
      ],
    },
    {
      title: "Unit 4 — Travel Basics",
      category: "travel",
      lessons: [
        ["Listening at the Airport", "Understand announcements, gates and simple instructions."],
        ["Reading Tickets and Signs", "Find times, gates and rules in travel documents."],
        ["Checking In and Asking for Help", "Handle check-in, hotels and simple problems by speaking."],
        ["Writing a Booking Message", "Write a clear booking or change request."],
        ["Travel and Transport Words", "Learn essential airport, hotel and transport vocabulary."],
        ["Comparatives and Superlatives", "Compare options with cheaper, faster and the best."],
      ],
    },
    {
      title: "Unit 5 — Future Plans",
      category: "grammar",
      lessons: [
        ["Listening to Plans and Arrangements", "Catch future arrangements, dates and intentions."],
        ["Reading an Event Programme", "Understand a schedule and pick the right session."],
        ["Talking About Your Goals", "Explain plans and intentions for the next months."],
        ["Writing About Next Year", "Write a short structured text about your plans."],
        ["Plans and Ambition Words", "Learn verbs and nouns for goals, courses and projects."],
        ["Will, Going To and Present Continuous", "Choose the right future form for each situation."],
      ],
    },
  ],
  b1: [
    {
      title: "Unit 1 — Everyday Fluency",
      category: "speaking",
      lessons: [
        ["Listening to Natural Conversations", "Follow relaxed speech with contractions and fillers."],
        ["Reading Blog Posts About Daily Life", "Understand attitude and detail in an informal text."],
        ["Keeping a Conversation Going", "Use follow-up questions and reactions to stay in the talk."],
        ["Writing an Informal Message", "Write a natural message with a clear tone and purpose."],
        ["Common Phrasal Verbs", "Use 12 high-frequency phrasal verbs in real contexts."],
        ["Present Perfect vs Past Simple", "Choose the right tense to talk about experience and news."],
      ],
    },
    {
      title: "Unit 2 — Work and Study",
      category: "grammar",
      lessons: [
        ["Listening to a Team Meeting", "Understand decisions, deadlines and action points."],
        ["Reading a Work Report", "Extract key facts and conclusions from a short report."],
        ["Giving Updates in a Meeting", "Report progress and problems clearly in full sentences."],
        ["Writing a Professional Email", "Write a structured email with request and next step."],
        ["Workplace Collocations", "Use natural word partnerships such as meet a deadline."],
        ["Reported Speech Basics", "Report what people said with correct tense changes."],
      ],
    },
    {
      title: "Unit 3 — Stories and Experiences",
      category: "vocabulary",
      lessons: [
        ["Listening to a Podcast Story", "Follow a longer narrative and catch the speaker's feelings."],
        ["Reading a Personal Story", "Understand sequence, reason and result in a narrative."],
        ["Telling Your Own Story", "Tell a past experience with clear structure and detail."],
        ["Writing a Narrative Paragraph", "Write a story with linkers and varied past tenses."],
        ["Feelings and Reaction Words", "Describe emotions and reactions with precise adjectives."],
        ["Past Continuous and Past Perfect", "Combine past tenses to show background and order."],
      ],
    },
    {
      title: "Unit 4 — Travel and Culture",
      category: "travel",
      lessons: [
        ["Listening to Travel Interviews", "Understand opinions and recommendations about places."],
        ["Reading a Travel Article", "Identify main idea, details and recommendations."],
        ["Sorting Out Travel Problems", "Explain a problem and negotiate a solution politely."],
        ["Writing a Review", "Write a balanced review with pros, cons and a verdict."],
        ["Travel and Culture Vocabulary", "Use richer vocabulary for places, customs and services."],
        ["Conditionals 0 and 1", "Talk about real possibilities and consequences."],
      ],
    },
    {
      title: "Unit 5 — Opinions and Advice",
      category: "speaking",
      lessons: [
        ["Listening to a Discussion", "Follow two speakers agreeing and disagreeing."],
        ["Reading Opinion Texts", "Separate facts from opinions in a short article."],
        ["Giving Your Opinion", "Express and support an opinion with reasons and examples."],
        ["Writing a Short Opinion Text", "Write an organised text with introduction and conclusion."],
        ["Opinion and Linking Words", "Use however, although, in my view and similar linkers."],
        ["Modals of Advice and Deduction", "Use should, might, must and can't for advice and guesses."],
      ],
    },
  ],
  b2: [
    {
      title: "Unit 1 — Discussion and Debate",
      category: "speaking",
      lessons: [
        ["Listening to a Debate", "Follow arguments, counter-arguments and speaker attitude."],
        ["Reading Argumentative Texts", "Identify claim, evidence and bias in an article."],
        ["Defending Your Position", "Argue a point and respond to objections fluently."],
        ["Writing a Balanced Essay", "Write a for-and-against text with clear paragraphs."],
        ["Argument Vocabulary", "Use precise verbs and nouns for claiming, conceding and refuting."],
        ["Complex Linking and Cohesion", "Connect ideas with advanced linkers and referencing."],
      ],
    },
    {
      title: "Unit 2 — Professional Communication",
      category: "grammar",
      lessons: [
        ["Listening to a Client Call", "Understand nuance, hedging and implied requests."],
        ["Reading Business Documents", "Scan proposals and reports for key commitments."],
        ["Presenting Your Work", "Deliver a short structured presentation with signposting."],
        ["Writing a Persuasive Proposal", "Write a proposal with benefits, risks and a call to action."],
        ["Formal Register Vocabulary", "Replace informal words with professional equivalents."],
        ["Passive Voice in Reports", "Use passive structures to describe processes and results."],
      ],
    },
    {
      title: "Unit 3 — News and Society",
      category: "vocabulary",
      lessons: [
        ["Listening to News Reports", "Understand fast news audio and identify the key facts."],
        ["Reading Long-Form Journalism", "Follow a complex article and summarise its argument."],
        ["Discussing Current Issues", "Discuss social topics with examples and nuance."],
        ["Writing a Summary and Comment", "Summarise a text and add a critical comment."],
        ["Society and Media Vocabulary", "Use topic vocabulary for politics, economy and technology."],
        ["Relative Clauses and Nominalisation", "Pack information into denser, more academic sentences."],
      ],
    },
    {
      title: "Unit 4 — Travel and Negotiation",
      category: "travel",
      lessons: [
        ["Listening to Negotiations", "Catch offers, conditions and polite refusals."],
        ["Reading Contracts and Policies", "Understand conditions, exceptions and obligations."],
        ["Negotiating and Complaining", "Negotiate terms and complain effectively but politely."],
        ["Writing a Formal Complaint", "Write a firm, polite letter with a clear request."],
        ["Negotiation Language", "Use natural expressions for bargaining and compromise."],
        ["Conditionals 2 and 3", "Talk about hypothetical situations and regrets."],
      ],
    },
    {
      title: "Unit 5 — Nuance and Style",
      category: "speaking",
      lessons: [
        ["Listening for Attitude and Tone", "Detect irony, doubt and enthusiasm in speech."],
        ["Reading Between the Lines", "Infer implied meaning and writer purpose."],
        ["Speaking with Natural Rhythm", "Improve stress, linking and fluency in longer turns."],
        ["Writing with Style", "Vary sentence length and vocabulary for impact."],
        ["Idioms and Natural Collocations", "Use common idioms accurately and appropriately."],
        ["Emphasis and Inversion", "Use cleft sentences and inversion for emphasis."],
      ],
    },
  ],
  c1: [
    {
      title: "Unit 1 — Complex Argument",
      category: "speaking",
      lessons: [
        ["Listening to Academic Talks", "Follow abstract lectures and note the line of reasoning."],
        ["Reading Dense Analysis", "Understand implicit structure in a demanding text."],
        ["Building a Sophisticated Argument", "Argue with concession, qualification and precision."],
        ["Writing an Analytical Essay", "Write a well-argued essay with sustained coherence."],
        ["Academic Vocabulary", "Use precise abstract nouns and reporting verbs."],
        ["Advanced Cohesion Devices", "Control reference, ellipsis and discourse markers."],
      ],
    },
    {
      title: "Unit 2 — Leadership Communication",
      category: "grammar",
      lessons: [
        ["Listening to Executive Briefings", "Understand strategy talk and implied priorities."],
        ["Reading Strategy Documents", "Evaluate arguments and assumptions in business writing."],
        ["Leading a Discussion", "Chair a discussion, manage turns and summarise decisions."],
        ["Writing Executive Summaries", "Condense complex information into a sharp summary."],
        ["Diplomatic Language", "Soften and strengthen messages with careful wording."],
        ["Hedging and Modality", "Express degrees of certainty and commitment precisely."],
      ],
    },
    {
      title: "Unit 3 — Media and Analysis",
      category: "vocabulary",
      lessons: [
        ["Listening to Interviews and Panels", "Follow overlapping speech and different accents."],
        ["Reading Critical Reviews", "Analyse evaluation, evidence and rhetoric."],
        ["Critiquing Ideas Aloud", "Give a structured critique with balanced judgement."],
        ["Writing a Critical Review", "Write an evaluative review with nuanced judgement."],
        ["Evaluative Vocabulary", "Use precise adjectives and adverbs of judgement."],
        ["Participle and Reduced Clauses", "Write economically with participle constructions."],
      ],
    },
    {
      title: "Unit 4 — Culture and Idiom",
      category: "travel",
      lessons: [
        ["Listening to Colloquial Speech", "Understand fast, idiomatic and regional speech."],
        ["Reading Cultural Commentary", "Grasp cultural references and humour in text."],
        ["Handling Cultural Situations", "Adapt tone and content to different audiences."],
        ["Writing for Different Audiences", "Adjust register from formal to conversational."],
        ["Idiomatic and Figurative Language", "Use metaphor and idiom naturally and accurately."],
        ["Register and Connotation", "Choose words for exact connotation and effect."],
      ],
    },
    {
      title: "Unit 5 — Precision and Fluency",
      category: "speaking",
      lessons: [
        ["Listening for Fine Detail", "Catch subtle distinctions and qualifications."],
        ["Reading with Speed and Accuracy", "Skim, scan and read closely with control."],
        ["Speaking Spontaneously", "Speak at length on unfamiliar topics with few pauses."],
        ["Writing with Precision", "Edit your own writing for accuracy and concision."],
        ["Advanced Word Formation", "Build word families with prefixes and suffixes."],
        ["Error Repair and Self-Correction", "Notice and correct persistent advanced errors."],
      ],
    },
  ],
  c2: [
    {
      title: "Unit 1 — Mastery of Argument",
      category: "speaking",
      lessons: [
        ["Listening to Dense Debate", "Follow rapid, allusive argument without support."],
        ["Reading Complex Theory", "Read specialised texts with full comprehension."],
        ["Arguing with Subtlety", "Persuade with rhetorical control and precise nuance."],
        ["Writing a Rigorous Essay", "Write a sustained, sophisticated argumentative text."],
        ["Low-Frequency Vocabulary", "Use rare and precise lexis appropriately."],
        ["Syntactic Flexibility", "Restructure sentences for rhythm and emphasis."],
      ],
    },
    {
      title: "Unit 2 — Executive Communication",
      category: "grammar",
      lessons: [
        ["Listening in High-Stakes Meetings", "Track subtext and unstated positions."],
        ["Reading Legal and Technical Texts", "Interpret dense, formulaic professional language."],
        ["Speaking Under Pressure", "Respond to challenge with poise and precision."],
        ["Writing Board-Level Documents", "Write concise, authoritative professional texts."],
        ["Formulaic Professional Language", "Deploy fixed expressions of high formality."],
        ["Complex Conditional Structures", "Use mixed and inverted conditionals naturally."],
      ],
    },
    {
      title: "Unit 3 — Critical Analysis",
      category: "vocabulary",
      lessons: [
        ["Listening to Specialist Content", "Understand technical talks outside your field."],
        ["Reading Research and Data", "Interpret evidence, method and limitation."],
        ["Presenting Complex Findings", "Explain complex material clearly to any audience."],
        ["Writing an Analytical Report", "Write with rigorous structure and evidence."],
        ["Abstract and Technical Lexis", "Handle abstract terminology with confidence."],
        ["Discourse Control", "Manage long texts with impeccable coherence."],
      ],
    },
    {
      title: "Unit 4 — Style and Humour",
      category: "travel",
      lessons: [
        ["Listening to Comedy and Satire", "Catch irony, wordplay and cultural allusion."],
        ["Reading Literary Prose", "Appreciate style, voice and implied meaning."],
        ["Using Humour Appropriately", "Use wit and understatement in conversation."],
        ["Writing with Voice", "Write with a distinctive, controlled personal style."],
        ["Wordplay and Connotation", "Exploit shades of meaning deliberately."],
        ["Stylistic Devices", "Use parallelism, ellipsis and rhetorical questions."],
      ],
    },
    {
      title: "Unit 5 — Native-like Precision",
      category: "speaking",
      lessons: [
        ["Listening Without Effort", "Understand any accent and speed with ease."],
        ["Reading Anything Fluently", "Read any genre quickly with full nuance."],
        ["Speaking Effortlessly", "Sustain flawless, natural speech in any context."],
        ["Writing Publication-Ready Text", "Produce polished text that needs no editing."],
        ["Fine-Tuning Vocabulary Choice", "Select the single most exact word every time."],
        ["Eliminating Residual Errors", "Remove the last traces of first-language influence."],
      ],
    },
  ],
};

const LEGACY: Record<string, string> = {
  basic: "a1",
  beginner: "a1",
  elementary: "a2",
  intermediate: "b1",
  "upper-intermediate": "b2",
  advanced: "c1",
  proficient: "c2",
};

export function normalizeLevel(level: string | null | undefined): string {
  const raw = String(level ?? "").toLowerCase().trim();
  const code = LEGACY[raw] ?? raw;
  return CURRICULUM[code] ? code : "b1";
}

export function curriculumKey(level: string, unit: number, position: number) {
  return `${normalizeLevel(level)}-u${unit}-l${position}`;
}

function reviewUnit(coreUnits: UnitBlueprint[]): UnitBlueprint {
  const unitName = (index: number) => coreUnits[index]?.title.replace(/^Unit \d+ — /, "") ?? `Unit ${index + 1}`;
  return {
    title: "Unit 6 — Review",
    category: "review",
    lessons: [
      ["Review I", `Review and summarize Units 1 and 2: ${unitName(0)} and ${unitName(1)}.`],
      ["Review II", `Review and summarize Units 3, 4 and 5: ${unitName(2)}, ${unitName(3)} and ${unitName(4)}.`],
      ["Test", "Answer 10 questions reviewing the content studied across Units 1 to 5."],
    ],
  };
}

/** All 30 core lessons plus the 3 optional review activities, in study order. */
export function getCurriculum(level: string | null | undefined): CurriculumLesson[] {
  const code = normalizeLevel(level);
  const coreUnits = CURRICULUM[code]!;
  const units = [...coreUnits, reviewUnit(coreUnits)];
  const out: CurriculumLesson[] = [];
  let index = 0;

  units.forEach((unit, unitIndex) => {
    unit.lessons.forEach(([title, objective], lessonIndex) => {
      const isReview = unitIndex === CORE_UNITS_PER_LEVEL;
      out.push({
        key: curriculumKey(code, unitIndex + 1, lessonIndex + 1),
        level: code,
        unit: unitIndex + 1,
        unitTitle: unit.title,
        position: lessonIndex + 1,
        index,
        title,
        objective,
        skill: isReview ? (lessonIndex === 2 ? "grammar" : "reading") : SKILL_ORDER[lessonIndex]!,
        category: unit.category,
        reviewUnits: isReview
          ? lessonIndex === 0
            ? [1, 2]
            : lessonIndex === 1
              ? [3, 4, 5]
              : [1, 2, 3, 4, 5]
          : [],
        isReviewTest: isReview && lessonIndex === 2,
      });
      index += 1;
    });
  });

  return out;
}

export function findCurriculumLesson(key: string): CurriculumLesson | null {
  const level = key.split("-")[0] ?? "";
  if (!CURRICULUM[level]) return null;
  return getCurriculum(level).find((l) => l.key === key) ?? null;
}

/** Units of a level with their lessons, ready for the learning path UI. */
export function getUnits(level: string | null | undefined) {
  const lessons = getCurriculum(level);
  return Array.from({ length: UNITS_PER_LEVEL }, (_, i) => ({
    unit: i + 1,
    title: lessons.find((l) => l.unit === i + 1)!.unitTitle,
    lessons: lessons.filter((l) => l.unit === i + 1),
  }));
}

/** The original Units 1-5, which alone determine Final Test availability. */
export function getCoreCurriculum(level: string | null | undefined) {
  return getCurriculum(level).filter((lesson) => lesson.unit <= CORE_UNITS_PER_LEVEL);
}

/** Key of the Final Test that closes a level (30 questions, 70% to move up). */
export function finalTestKey(level: string | null | undefined) {
  return `${normalizeLevel(level)}-final`;
}

/** True when the key belongs to a Final Test instead of a normal lesson. */
export function isFinalTestKey(key: string) {
  return key.endsWith("-final");
}
