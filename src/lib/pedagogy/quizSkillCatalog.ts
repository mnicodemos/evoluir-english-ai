/**
 * Explicitly audited classifications for existing quiz questions.
 *
 * This is deliberately keyed by immutable question IDs. Lesson labels and question text are not
 * used to infer a skill. New questions remain unclassified until their `pedagogical_skill` is set
 * in the database or their ID is reviewed and added here.
 */
export const AUDITED_QUIZ_SKILLS: Readonly<Record<string, "grammar" | "vocabulary">> = {
  "ceafbabb-b317-47e4-b7f4-fc6f0af79920": "grammar",
  "c71baa0d-f6ca-4eb3-9d9d-31d9d6866b69": "grammar",
  "fcfd5e1b-29ab-493a-9101-7f0ff4b74c23": "grammar",
  "0f7ebaaa-668e-4e4c-9185-29d3f6ac8816": "grammar",
  "39a4010f-d6c9-4e8e-82db-7b7a031f9228": "grammar",
  "270a6d3f-71b7-4fea-a1bf-f86e1362857b": "grammar",
  "ce93f3e3-1b96-4ebd-80f7-9bff91978306": "grammar",
  "5970b3f9-8a60-4bdd-9da8-190c619c6be5": "grammar",
  "e46999ea-5b0a-4593-b72b-d35e68e4311d": "grammar",
  "453f1ee8-0101-4148-90c7-875ab79e59ea": "grammar",
  "1f641d8e-d5c9-4eac-a015-3966e079bd85": "grammar",
  "4f97f409-6907-4fc7-99a2-cce8899126b3": "grammar",
  "de4ee19b-b470-4659-b6fa-b222db96427a": "grammar",
  "6d172a25-3eb9-4b69-9738-60c2d2c8bc1d": "grammar",
  "9d1f3f14-bdbf-490d-9de7-dc588ecf3272": "grammar",
  "6ae75d58-1ca2-48b6-9989-2bfdc5228cf4": "grammar",
  "1daa70e2-03cb-44c3-8acb-73b8a6cd61bc": "grammar",
  "a47023f3-44d9-4bb9-abd8-27ef673ef560": "grammar",
  "c3914121-8662-4358-a33d-8f520caaf184": "grammar",
  "dde9dd5c-1cfd-4461-b03d-47d7a0bfbd31": "grammar",
};

export function auditedQuizSkill(questionId: string) {
  return AUDITED_QUIZ_SKILLS[questionId] ?? null;
}