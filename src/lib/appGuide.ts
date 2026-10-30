/**
 * The app guide ("Diário de bordo", user request): how to use each main part
 * of Evoluir+, shown at /guide. Written in English and translated through
 * uiPt like every student screen (appGuide.test.ts checks every line has its
 * Portuguese). Keep it in step with the rules in AGENTS.md when a feature
 * changes.
 */

export type GuideIcon =
  | "home"
  | "path"
  | "vocabulary"
  | "listening"
  | "reading"
  | "writing"
  | "mistakes"
  | "speaking"
  | "call"
  | "teacher"
  | "life"
  | "plan"
  | "streak"
  | "league"
  | "business"
  | "progress"
  | "settings"
  | "method";

/** The guide's three parts (product review, 2026-10-31): by what the student needs, not by screen. */
export type GuideGroup = "start" | "practice" | "organize";

export const GUIDE_GROUPS: { id: GuideGroup; title: string }[] = [
  { id: "start", title: "Start here" },
  { id: "practice", title: "Practise" },
  { id: "organize", title: "Organize" },
];

/** At most this many steps show at once; the rest wait behind More details. */
export const GUIDE_MAX_STEPS = 4;

export type GuideSection = {
  id: string;
  group: GuideGroup;
  icon: GuideIcon;
  title: string;
  /** One sentence: what it is for. */
  what: string;
  /** How to use it, in order. */
  steps: string[];
  /** Details behind "More details", so a section never opens as a wall of text. */
  more?: string[];
  /** The steps are alternatives (any one is enough), shown as a list, not in order. */
  anyOf?: boolean;
  tip?: string;
  /** Shows the ten jewels card (JewelsCard) under the steps. */
  jewels?: boolean;
  /** Where the "Open" button goes; none for settings spread across the app. */
  to?: string;
  premium?: boolean;
};

export const APP_GUIDE: GuideSection[] = [
  {
    // How to learn with the app, not only where things are (product review, 2026-10-31).
    id: "how-to-study",
    group: "start",
    icon: "method",
    title: "How to study with Evoluir+",
    what: "A 15-minute routine that works at any level. Do it on most days of the week.",
    steps: [
      "Open the Home and tap Practice now: it is EVO's priority, the most useful thing for you today (about 5 minutes).",
      "Do one review: the words, cards or mistakes due today (about 5 minutes). Reviewing on the right day is what makes them stay.",
      "Produce something: talk to EVO or write a short text (about 5 minutes). You learn to speak by speaking, not only by understanding.",
      "Close your study day (see What counts as a study day) and, if you have time, go on with the next lesson or the daily reading.",
    ],
    more: [
      "Say everything out loud: the lesson audio, the cards and the Listening sentences. Your mouth needs practice as much as your ears.",
      "Don't be afraid of mistakes: each one goes to My mistakes and comes back until you master it.",
      "A little every day beats a lot once a week: 15 minutes on 5 days teaches more than 75 minutes on Sunday.",
      "Every week, follow your study plan; when the Final Test of your level opens, take it.",
    ],
    tip: "Short on time? Tap Practice now and finish that one activity: it is the best use of 5 minutes.",
    to: "/dashboard",
  },
  {
    id: "dashboard",
    group: "start",
    icon: "home",
    title: "Your Dashboard",
    what: "Your starting point every day: EVO shows today's priority and how your day is going.",
    steps: [
      "Read Today's priority: the skill EVO chose for you and why it matters now.",
      "Tap Practice now to go straight to the right activity.",
      "Extra practice offers two short options; each shows the XP it earns.",
      "Today's Progress fills the ring with today's minutes and lists what you did.",
    ],
    more: [
      "Keep improving shows your reviews first (words and lesson cards in one word review, mistakes, skills), then today's new activities (New today); until your daily goal is met, free rows suggest more practice (Keep going).",
    ],
    tip: "Take the challenge has a goal for the day and leaves once you reach it. Every other day it invites you to the AI Teacher or the video call.",
    to: "/dashboard",
  },
  {
    id: "learning",
    group: "practice",
    icon: "path",
    title: "Learning path",
    what: "The lessons of your level, in order, from the first unit to the Final Test.",
    steps: [
      "Open the next lesson: listen to the lesson audio, read the summary and review the cards, rating each one Again, Hard or Easy (a missed card comes back in the same round).",
      "Every lesson has its Lesson audio: EVO and Leo talk about the topic, and you can follow every line with its translation. At the challenge, answer out loud before hearing EVO's model answer, and use ↻ or Repeat after to practise each line.",
      "Answer the quiz: 70% or more completes the lesson. After checking it, each answer explains why; at A1-A2 the explanation also shows in Portuguese.",
      "After 21 of the 30 lessons, the Final Test opens; 70% moves you up a level.",
    ],
    more: [
      "Start here, on top of the path, has the presentation video of your level (Business English has its own).",
      "A retake brings the questions in a new order, the ones you missed first, and a wrong fill-in answer goes to My mistakes.",
      "Unit 6 has two review lessons: Review I opens after Units 1 and 2, and Review II after Units 3 to 5.",
    ],
    tip: "Time on a lesson page counts toward your daily minutes, even before the quiz.",
    to: "/learning",
  },
  {
    id: "vocabulary",
    group: "practice",
    icon: "vocabulary",
    title: "Vocabulary",
    what: "New words for each lesson, reviewed at the right moment so they stay.",
    steps: [
      "Listen to each word and say it out loud to practise pronunciation.",
      "Look up any English word or phrase in the built-in translator at the top.",
      "Tap I know it when you are sure: the word comes back later for review.",
      "Review the words that are due; ten reviewed words complete a study day. Your lesson cards due show right under them, in the same word review.",
    ],
    to: "/vocabulary",
  },
  {
    id: "listening",
    group: "practice",
    icon: "listening",
    title: "Listening",
    what: "Short sentences at your level to train your ear.",
    steps: [
      "Play the sentence; you can listen again as many times as you need.",
      "Repeat it out loud and see how close you were.",
      "One session has 9 sentences and is saved every 3; finishing it completes a study day.",
      "Premium: in Music Lab, create one song a day in English at your level.",
    ],
    to: "/listening",
  },
  {
    id: "reading",
    group: "practice",
    icon: "reading",
    title: "Daily reading",
    what: "A short text at your level every day, on a different subject each day: daily life, travel, technology, work, culture, wellbeing and, once a week, a motivational text.",
    steps: [
      "Keep Today's pick or choose what to read: a category (daily life, work, travel, technology, health, culture) and a style (story, article, dialogue).",
      "Tap any word you don't understand to see its translation; the words you tap stay marked, and Save to my Vocabulary sends them to your word reviews.",
      "Answer the questions to check what you understood; after checking, See in the text shows the paragraph with each answer.",
      "Your answers are your Reading score and close your study day.",
    ],
    more: [
      "Read the text; it gets longer and richer as your level goes up.",
      "Tap Listen to EVO to hear it read aloud; the paragraph being read is highlighted, and 0.8× slows the voice.",
      "Your reading week, above the text, opens the texts of the last seven days again.",
      "The first text you finish each day counts; other texts that day are extra practice.",
    ],
    tip: "When EVO's priority is Reading, Practice now opens the daily reading.",
    to: "/reading",
  },
  {
    id: "writing",
    group: "practice",
    icon: "writing",
    title: "Writing",
    what: "Write short texts and get them corrected with clear explanations.",
    steps: [
      "Answer today's writing task in English, close to the target length.",
      "Stuck? Open Ask EVO for help under the box: a way to start, useful words or a check of your last sentence.",
      "Send it: EVO corrects it, shows a natural version and explains what to fix.",
      "There are three tasks a day; your mistakes go to My mistakes, and three texts complete a study day.",
    ],
    to: "/writing",
  },
  {
    id: "mistakes",
    group: "practice",
    icon: "mistakes",
    title: "My mistakes",
    what: "The mistakes you made in Writing, with the AI Teacher and in lesson quizzes, for spaced review.",
    steps: [
      "Correct the marked part of each sentence and check your answer.",
      "Use Practise the rule for one more question on the same point.",
      "A mistake answered right five times in a row is mastered.",
      "Filter the list by type of mistake, and tap Select to delete to remove several at once.",
    ],
    to: "/mistakes",
  },
  {
    id: "speaking",
    group: "practice",
    icon: "speaking",
    title: "AI Speaking",
    what: "Talk to EVO by voice, with short teacher turns and a report at the end.",
    steps: [
      "Tap the microphone and speak; EVO answers out loud.",
      "Choose a free chat or a real situation, like a job interview or a restaurant.",
      "Finish the conversation to get your report; one finished conversation completes a study day.",
    ],
    more: ["Ask about the weather with Weather talk to practise small talk."],
    tip: "Use Around you in English, in the Weather talk button, to act out situations at places near you.",
    to: "/coach",
  },
  {
    id: "call",
    group: "practice",
    icon: "call",
    title: "Video call",
    what: "An informal chat with EVO as a friend, like a real video call.",
    steps: [
      "Start the call and talk naturally; EVO reacts and keeps the chat going.",
      "Small mistakes are fixed by EVO repeating your sentence the right way.",
      "End the call to see your report; a call that reaches its report (3 answers) completes a study day.",
    ],
    to: "/call",
  },
  {
    id: "teacher",
    group: "practice",
    icon: "teacher",
    title: "AI Teacher",
    what: "A written tutor at your level: explanations, examples, practice and corrections.",
    steps: [
      "Ask about any point, or tap Start coach session for a guided class.",
      "Write your answers: the teacher corrects your main mistake and saves it in My mistakes.",
      "Every few messages you get a summary of what you practised.",
    ],
    to: "/teacher",
  },
  {
    id: "life",
    group: "organize",
    icon: "life",
    title: "Life+ AI",
    what: "Your goals, routine, habits and focus in one place, with EVO as your Life Coach.",
    steps: [
      "Add 1 to 3 goals: EVO gives you one small step for each goal every day.",
      "Open Today to tick the day's goal steps, tasks and habits in one list; set them up in Planning.",
      "Ask the Life Coach for a plan; add its suggestions with one tap, or copy an answer and send it on WhatsApp.",
      "Use Focus for blocks of 15, 25 or 50 minutes, with two minutes of English in each break.",
    ],
    more: [
      "Give a goal a deadline and milestones to see how far you are.",
      "Change a goal, task or habit with its pencil (Edit).",
      "Tick a habit like Study English automatically on your English study days, so it keeps the same run as your streak.",
      "Stuck between options? Open Decisions: list the options and the criteria that matter, give each a weight and a score, and see the best option, test other weights in What if?, ask EVO for an analysis and turn your choice into a goal.",
      "Try a meditation in English to relax and train your listening.",
      "Open the floating timer from the Dashboard header, beside Weather talk, or from Focus to keep it at hand on any page; minimize, move or close it. Left on Ready, it shrinks to a small pill when you change page.",
    ],
    tip: "Finishing every goal step of the day also counts for your streak.",
    to: "/life",
  },
  {
    id: "plan",
    group: "organize",
    icon: "plan",
    title: "Study plan",
    what: "Your plan for the week: how many days you will study and what to do each day.",
    steps: [
      "Choose 2, 3, 5 or 7 days a week and your daily minutes.",
      "Follow the activity of each day; done days are ticked.",
      "A new plan starts every Monday, and its order stays the same all week.",
      "Your learning rhythm on the Dashboard shows how many days of your plan you studied this week.",
    ],
    to: "/study-plan",
  },
  {
    id: "study-day",
    group: "start",
    icon: "streak",
    title: "What counts as a study day",
    what: "Any one of these on the same day (Brasília time) closes your study day and keeps your streak.",
    anyOf: true,
    steps: [
      "Finish 1 lesson (the quiz at the end).",
      "Send 3 texts in Writing.",
      "Finish 1 Listening session (9 sentences).",
      "Review 10 words in Vocabulary.",
      "Finish 1 conversation with EVO, in AI Speaking or the video call, up to its report.",
      "Answer every question of the Daily reading.",
      "Do every goal step of the day in Life+ AI.",
    ],
    tip: "Opening a screen or only spending minutes does not close the day; the minutes still count toward your daily goal.",
    to: "/dashboard",
  },
  {
    id: "jewels",
    group: "start",
    icon: "streak",
    title: "Your jewels",
    what: "Jewels reward studying on days in a row, and once earned they are yours for good.",
    steps: [
      "Close your study day with any one of the activities in What counts as a study day.",
      "Your first study day earns Bronze; then each 7 days in a row earn the next jewel, up to Diamond at 63.",
      "A jewel you earn stays with you, even if your run of days breaks; one missed day a week is protected.",
      "The Dashboard shows your highest jewel and how many days are left for the next one.",
    ],
    jewels: true,
  },
  {
    id: "league",
    group: "organize",
    icon: "league",
    title: "Weekly league",
    what: "A friendly ranking with students of your level, reset every Monday.",
    steps: [
      "Weekly XP shows your XP this week against last week and your best week, so you always have someone to beat: yourself.",
      "Join the league; other students only see your first name and initial.",
      "Earn XP with lessons, texts, Listening, conversations, the daily reading, words and mistakes, plus a bonus for each study day.",
      "The ranking opens once your level's league has 5 students taking part; then your medal shows your place: gold, silver or bronze for the top three.",
    ],
    to: "/league",
  },
  {
    id: "business",
    group: "practice",
    icon: "business",
    title: "Business English",
    what: "Premium, from level B1: 6 units of English for work.",
    steps: [
      "Start with the first lesson, which is free to try.",
      "Lessons open in order and count as study like any lesson.",
      "Practise work situations in AI Speaking and download each unit as a PDF.",
    ],
    to: "/business",
    premium: true,
  },
  {
    id: "progress",
    group: "organize",
    icon: "progress",
    title: "My progress",
    what: "Your skills, your history and your study calendar.",
    steps: [
      "See your scores in listening, speaking, reading, writing, grammar and vocabulary.",
      "Choose a level to see what you practised there.",
      "Check the calendar: every marked day is a study day.",
    ],
    to: "/progress",
  },
  {
    id: "settings",
    group: "organize",
    icon: "settings",
    title: "Language and notifications",
    what: "Adjust the app to you.",
    steps: [
      "Switch the interface between Portuguese and English in the menu; lessons stay in English.",
      "My Subscription, in the menu, shows your plan; the first Premium subscription starts with 7 free days, and you can cancel there.",
      "Turn on notifications for the word of the day and your study reminder.",
      "The bell on the Home lists what is still open today: your plan, reviews, the daily reading, goal steps, habits and, when it opens, the Final Test.",
    ],
  },
];

/** Every English line of the guide, for the translation check. */
export function appGuideStrings(): string[] {
  return APP_GUIDE.flatMap((section) => [
    section.title,
    section.what,
    ...section.steps,
    ...(section.more ?? []),
    ...(section.tip ? [section.tip] : []),
  ]);
}
