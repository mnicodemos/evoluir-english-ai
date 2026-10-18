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
  | "settings";

export type GuideSection = {
  id: string;
  icon: GuideIcon;
  title: string;
  /** One sentence: what it is for. */
  what: string;
  /** How to use it, in order. */
  steps: string[];
  /** The steps are alternatives (any one is enough), shown as a list, not in order. */
  anyOf?: boolean;
  tip?: string;
  /** Where the "Open" button goes; none for settings spread across the app. */
  to?: string;
  premium?: boolean;
};

export const APP_GUIDE: GuideSection[] = [
  {
    id: "dashboard",
    icon: "home",
    title: "Your Dashboard",
    what: "Your starting point every day: EVO shows today's priority and how your day is going.",
    steps: [
      "Read Today's priority: the skill EVO chose for you and why it matters now.",
      "Tap Practice now to go straight to the right activity.",
      "Extra practice offers two short options; each shows the XP it earns.",
      "Today's Progress fills the ring with today's minutes and lists what you did.",
    ],
    tip: "Take the challenge has a goal for the day and leaves once you reach it.",
    to: "/dashboard",
  },
  {
    id: "learning",
    icon: "path",
    title: "Learning path",
    what: "The lessons of your level, in order, from the first unit to the Final Test.",
    steps: [
      "Open the next lesson: watch the video, read the summary and review the cards.",
      "Answer the quiz: 70% or more completes the lesson.",
      "After 21 of the 30 lessons, the Final Test opens; 70% moves you up a level.",
    ],
    tip: "Time on a lesson page counts toward your daily minutes, even before the quiz.",
    to: "/learning",
  },
  {
    id: "vocabulary",
    icon: "vocabulary",
    title: "Vocabulary",
    what: "New words for each lesson, reviewed at the right moment so they stay.",
    steps: [
      "Listen to each word and say it out loud to practise pronunciation.",
      "Tap I know it when you are sure: the word comes back later for review.",
      "Review the words that are due; ten reviewed words complete a study day.",
    ],
    to: "/vocabulary",
  },
  {
    id: "listening",
    icon: "listening",
    title: "Listening",
    what: "Short sentences at your level to train your ear.",
    steps: [
      "Play the sentence; you can listen again as many times as you need.",
      "Repeat it out loud and see how close you were.",
      "Three Listening sessions complete a study day.",
    ],
    to: "/listening",
  },
  {
    id: "reading",
    icon: "reading",
    title: "Daily reading",
    what: "A short text at your level every day: a motivational text one day, an everyday story the next.",
    steps: [
      "Read the text; it gets longer and richer as your level goes up.",
      "Tap Listen to EVO to hear it read aloud.",
      "Tap any word you don't understand to see its translation; the words you tap stay marked for the day.",
      "Answer the questions to check what you understood.",
      "Your answers are your Reading score and close your study day.",
    ],
    tip: "When EVO's priority is Reading, Practice now opens the daily reading.",
    to: "/reading",
  },
  {
    id: "writing",
    icon: "writing",
    title: "Writing",
    what: "Write short texts and get them corrected with clear explanations.",
    steps: [
      "Answer today's writing task in English, close to the target length.",
      "Send it: EVO corrects it, shows a natural version and explains what to fix.",
      "There are three tasks a day; your mistakes go to My mistakes, and three texts complete a study day.",
    ],
    to: "/writing",
  },
  {
    id: "mistakes",
    icon: "mistakes",
    title: "My mistakes",
    what: "The mistakes you made in Writing and with the AI Teacher, for spaced review.",
    steps: [
      "Correct the marked part of each sentence and check your answer.",
      "Use Practise the rule for one more question on the same point.",
      "A mistake answered right five times in a row is mastered.",
    ],
    to: "/mistakes",
  },
  {
    id: "speaking",
    icon: "speaking",
    title: "AI Speaking",
    what: "Talk to EVO by voice, with short teacher turns and a report at the end.",
    steps: [
      "Tap the microphone and speak; EVO answers out loud.",
      "Choose a free chat or a real situation, like a job interview or a restaurant.",
      "Finish the conversation to get your report; one finished conversation completes a study day.",
    ],
    tip: "Use Around you in English, in the Weather talk button, to act out situations at places near you.",
    to: "/coach",
  },
  {
    id: "call",
    icon: "call",
    title: "Video call",
    what: "An informal chat with EVO as a friend, like a real video call.",
    steps: [
      "Start the call and talk naturally; EVO reacts and keeps the chat going.",
      "Small mistakes are fixed by EVO repeating your sentence the right way.",
      "End the call to see your report.",
    ],
    to: "/call",
  },
  {
    id: "teacher",
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
    icon: "life",
    title: "Life+ AI",
    what: "Your goals, routine, habits and focus in one place, with EVO as your Life Coach.",
    steps: [
      "Add 1 to 3 goals: EVO gives you one small step for each goal every day.",
      "Give a goal a deadline and milestones to see how far you are.",
      "Plan the day's tasks, check in your habits and set the priority of the day.",
      "Change a goal, task, habit or the priority with its pencil (Edit).",
      "Tick a habit like Study English automatically on your English study days, so it keeps the same run as your streak.",
      "Ask the Life Coach for a plan; add its suggestions with one tap, or copy an answer and send it on WhatsApp.",
      "Try a meditation in English to relax and train your listening.",
      "Use Focus for blocks of 15, 25 or 50 minutes, with two minutes of English in each break.",
      "Open the floating timer from the Dashboard header, beside Weather talk, or from Focus to keep it at hand on any page; minimize, move or close it. Left on Ready, it shrinks to a small pill when you change page.",
    ],
    tip: "Finishing every goal step of the day also counts for your streak.",
    to: "/life",
  },
  {
    id: "plan",
    icon: "plan",
    title: "Study plan",
    what: "Your plan for the week: how many days you will study and what to do each day.",
    steps: [
      "Choose 2, 3, 5 or 7 days a week and your daily minutes.",
      "Follow the activity of each day; done days are ticked.",
      "Reaching your weekly plan lights the three gold stars.",
    ],
    to: "/study-plan",
  },
  {
    id: "study-day",
    icon: "streak",
    title: "What counts as a study day",
    what: "Any one of these on the same day (Brasília time) closes your study day and keeps your streak.",
    anyOf: true,
    steps: [
      "Finish 1 lesson (the quiz at the end).",
      "Send 3 texts in Writing.",
      "Do 3 Listening sessions.",
      "Review 10 words in Vocabulary.",
      "Finish 1 conversation with EVO in AI Speaking.",
      "Answer every question of the Daily reading.",
      "Do every goal step of the day in Life+ AI.",
    ],
    tip: "Opening a screen or only spending minutes does not close the day; the minutes still count toward your daily goal.",
    to: "/dashboard",
  },
  {
    id: "streak",
    icon: "streak",
    title: "Streak, jewels and stars",
    what: "How your consistency is counted.",
    steps: [
      "Close your study day with any one of the activities in What counts as a study day.",
      "Days in a row raise your streak and change its jewel; one missed day a week is protected.",
      "The stars in Your learning rhythm light up when you reach your own weekly plan.",
    ],
    to: "/dashboard",
  },
  {
    id: "league",
    icon: "league",
    title: "Weekly league",
    what: "A friendly ranking with students of your level, reset every Monday.",
    steps: [
      "Join the league; other students only see your first name and initial.",
      "Earn XP with lessons, texts, Listening, conversations, words and mistakes.",
      "Your medal shows your place: gold, silver or bronze for the top three.",
    ],
    to: "/league",
  },
  {
    id: "business",
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
    icon: "settings",
    title: "Language and notifications",
    what: "Adjust the app to you.",
    steps: [
      "Switch the interface between Portuguese and English in the menu; lessons stay in English.",
      "Turn on notifications for the word of the day and your study reminder.",
      "Ask about the weather with Weather talk to practise small talk.",
    ],
  },
];

/** Every English line of the guide, for the translation check. */
export function appGuideStrings(): string[] {
  return APP_GUIDE.flatMap((section) => [
    section.title,
    section.what,
    ...section.steps,
    ...(section.tip ? [section.tip] : []),
  ]);
}
