import type { RolePlay } from "@/components/coach/coachScenarios";
import { SKILL_ORDER, type CurriculumLesson } from "@/lib/curriculum";
import { findLevel } from "@/lib/level";

/**
 * Business English (user decision): a Premium bonus track from B1. Six
 * units of six lessons in the same lesson format as the learning path
 * (video, flashcards, quiz), written by the AI at the student's own level and
 * shared per level like path lessons. It never counts toward the level's
 * Final Test or promotion: its keys ("biz-u1-l1") are outside the CEFR path.
 */
export const BUSINESS_MIN_LEVEL = "b1";
/** The first lesson is open to everyone from B1, as a preview of the track. */
export const BUSINESS_FREE_LESSONS = 1;
export const BUSINESS_KEY_PREFIX = "biz-";

const LEVEL_ORDER = ["a1", "a2", "b1", "b2", "c1", "c2"];

type BusinessUnit = { title: string; lessons: [string, string][] };

const UNITS: BusinessUnit[] = [
  {
    title: "Unit 1 — Meetings",
    lessons: [
      [
        "Following a Status Meeting",
        "Understand updates, deadlines and action points in a team meeting.",
      ],
      [
        "Reading a Meeting Agenda",
        "Read agendas and minutes and find decisions, owners and dates.",
      ],
      [
        "Giving an Update in a Meeting",
        "Report progress, problems and next steps clearly and briefly.",
      ],
      ["Writing Meeting Notes", "Write short notes with decisions, owners and deadlines."],
      [
        "Meeting Vocabulary",
        "Use key meeting expressions: agenda, action item, follow up, on track.",
      ],
      [
        "Polite Interruptions and Opinions",
        "Interrupt, agree and disagree politely with modal verbs and softeners.",
      ],
    ],
  },
  {
    title: "Unit 2 — E-mails and Messages",
    lessons: [
      [
        "Understanding Voice Messages",
        "Understand work voice messages: who called, why and what to do.",
      ],
      [
        "Reading Work E-mails",
        "Read work e-mails and identify the request, the tone and the deadline.",
      ],
      [
        "Calling About an E-mail",
        "Follow up on an e-mail by phone: clarify, confirm and agree next steps.",
      ],
      [
        "Writing a Clear Work E-mail",
        "Write a short e-mail with a clear subject, request and polite closing.",
      ],
      [
        "E-mail Phrases",
        "Use standard e-mail phrases for requests, reminders, apologies and attachments.",
      ],
      [
        "Formal and Informal Register",
        "Choose between formal and informal structures in work messages.",
      ],
    ],
  },
  {
    title: "Unit 3 — Presentations",
    lessons: [
      [
        "Following a Short Presentation",
        "Understand the structure, main points and figures of a short talk.",
      ],
      [
        "Reading Charts and Reports",
        "Read short reports and describe what charts and figures show.",
      ],
      ["Presenting Your Work", "Open, structure and close a short presentation about your work."],
      [
        "Writing Slides and Summaries",
        "Write short slide titles, bullet points and an executive summary.",
      ],
      [
        "Describing Trends",
        "Use vocabulary for trends: increase, drop, steady, peak, significantly.",
      ],
      [
        "Signposting and Comparisons",
        "Guide listeners with signposting language and compare results.",
      ],
    ],
  },
  {
    title: "Unit 4 — Job Interviews",
    lessons: [
      [
        "Understanding Interview Questions",
        "Recognise common interview questions and what the interviewer wants.",
      ],
      [
        "Reading a Job Description",
        "Read a job ad and match requirements to your skills and experience.",
      ],
      [
        "Talking About Your Experience",
        "Describe your experience, strengths and achievements with examples.",
      ],
      [
        "Writing a Short Cover Letter",
        "Write a brief cover letter that connects your profile to the job.",
      ],
      [
        "Skills and Achievements Vocabulary",
        "Use verbs and nouns for skills, results and responsibilities.",
      ],
      [
        "Past Simple and Present Perfect at Work",
        "Use past simple and present perfect to talk about your career.",
      ],
    ],
  },
  {
    title: "Unit 5 — Clients and Negotiation",
    lessons: [
      [
        "Understanding a Client Call",
        "Understand a client's needs, complaints and expectations on a call.",
      ],
      [
        "Reading Proposals and Contracts",
        "Read short proposals and find prices, terms, deadlines and conditions.",
      ],
      ["Negotiating a Deal", "Make offers, counter-offers and reach an agreement politely."],
      [
        "Writing a Proposal Follow-up",
        "Write a follow-up e-mail that summarises an offer and next steps.",
      ],
      [
        "Negotiation Vocabulary",
        "Use expressions for offers, conditions, compromise and agreement.",
      ],
      [
        "Conditionals for Negotiation",
        "Use first and second conditionals to make offers and set conditions.",
      ],
    ],
  },
  {
    title: "Unit 6 — Networking and Small Talk",
    lessons: [
      [
        "Following Small Talk at Events",
        "Understand introductions, small talk and follow-up offers at work events.",
      ],
      [
        "Reading Professional Profiles",
        "Read short professional profiles and find roles, experience and shared interests.",
      ],
      [
        "Introducing Yourself Professionally",
        "Introduce yourself, your role and your company, and keep a short conversation going.",
      ],
      [
        "Writing a Networking Message",
        "Write a short message to connect with someone you met and suggest a next step.",
      ],
      [
        "Networking Expressions",
        "Use expressions to start, keep and close a professional conversation.",
      ],
      [
        "Questions and Question Tags",
        "Use direct, indirect and tag questions to keep small talk polite and natural.",
      ],
    ],
  },
];

/** True when the student's level opens the Business track (B1 and above). */
export function businessLevelAllowed(level: string | null | undefined) {
  return LEVEL_ORDER.indexOf(findLevel(level).value) >= LEVEL_ORDER.indexOf(BUSINESS_MIN_LEVEL);
}

/** True for the keys of Business lessons. */
export function isBusinessKey(key: string | null | undefined) {
  return !!key && key.startsWith(BUSINESS_KEY_PREFIX);
}

/** The 36 Business lessons, written at the student's level (B1 at least). */
export function getBusinessCourse(level: string | null | undefined): CurriculumLesson[] {
  const value = findLevel(level).value;
  const cefr = businessLevelAllowed(value) ? value : BUSINESS_MIN_LEVEL;
  let index = 0;
  return UNITS.flatMap((unit, unitIndex) =>
    unit.lessons.map(([title, objective], lessonIndex) => ({
      key: `${BUSINESS_KEY_PREFIX}u${unitIndex + 1}-l${lessonIndex + 1}`,
      level: cefr,
      unit: unitIndex + 1,
      unitTitle: `Business English — ${unit.title}`,
      position: lessonIndex + 1,
      index: index++,
      title,
      objective,
      skill: SKILL_ORDER[lessonIndex]!,
      category: "business",
      reviewUnits: [],
      isReviewTest: false,
    })),
  );
}

export function findBusinessLesson(key: string, level: string | null | undefined) {
  return getBusinessCourse(level).find((lesson) => lesson.key === key) ?? null;
}

/** The Business units, ready for the track page. */
export function getBusinessUnits(level: string | null | undefined) {
  const lessons = getBusinessCourse(level);
  return UNITS.map((unit, i) => ({
    unit: i + 1,
    title: unit.title,
    lessons: lessons.filter((lesson) => lesson.unit === i + 1),
  }));
}

/** Work situations EVO plays in AI Speaking and on the video call. */
export const businessRolePlays: RolePlay[] = [
  {
    id: "biz-interview",
    label: "Job interview",
    scenario: "professional",
    goals: ["work", "interview"],
    role: "You are a hiring manager at an international company interviewing the student for a job in their field. Ask one typical interview question at a time, follow up on their answers and keep a professional tone.",
    opener:
      "Good morning, thanks for joining us. To start, could you walk me through your background?",
  },
  {
    id: "biz-status",
    label: "Status meeting",
    scenario: "professional",
    goals: ["work"],
    role: "You are the student's manager in a weekly status meeting. Ask about progress, blockers, deadlines and next steps, and ask for one concrete date.",
    opener: "Hi! Let's go through the project quickly. Where are we with your part this week?",
  },
  {
    id: "biz-client",
    label: "Client call",
    scenario: "professional",
    goals: ["work"],
    role: "You are a client calling the student's company with a problem about a delivery that is late. Be polite but firm, explain your needs and ask for a solution and a new date.",
    opener:
      "Hello, this is Alex from Northwind. I'm calling about our order — it still hasn't arrived.",
  },
  {
    id: "biz-negotiation",
    label: "Negotiation",
    scenario: "professional",
    goals: ["work"],
    role: "You are a supplier negotiating price, volume and delivery time with the student, who is the buyer. Make offers and counter-offers and only agree when there is a fair compromise.",
    opener:
      "Thanks for your time. We've reviewed your request, and our price is 20 dollars per unit. What do you think?",
  },
  {
    id: "biz-presentation",
    label: "Presentation Q&A",
    scenario: "professional",
    goals: ["work"],
    role: "You are a senior colleague in the audience after the student's short presentation about their work. Ask one clear question at a time about results, numbers and next steps.",
    opener:
      "Thanks for the presentation. Could you explain the main result in one or two sentences?",
  },
];

export function findBusinessRolePlay(id: string | null | undefined) {
  return businessRolePlays.find((play) => play.id === id) ?? null;
}
