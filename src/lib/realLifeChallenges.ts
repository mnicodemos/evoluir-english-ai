/**
 * Real-Life Challenge (prototype 1, owner request 2026-10-27): short,
 * optional situations under a lesson's Learning Guide. Content is static and
 * reviewed (no AI call). Challenges never touch the checklist, quiz or lesson
 * completion rules.
 */

export type ChallengeOutcome = "works" | "adjust";

export type ChallengeOption = {
  id: string;
  /** The student's possible message (English learning content). */
  text: string;
  outcome: ChallengeOutcome;
  /** What happens next in the situation. */
  consequence: string;
  /** EVO's explanation, based on the lesson objective. */
  feedback: string;
};

export type RealLifeChallenge = {
  key: string;
  title: string;
  situation: string;
  task: string;
  options: ChallengeOption[];
};

export const REAL_LIFE_CHALLENGES: Record<string, RealLifeChallenge> = {
  "b1-u2-l4": {
    key: "b1-u2-l4",
    title: "Asking a client for two more days",
    situation: "You are preparing a project report for your client, Mr. Davies. It was due on Wednesday, but you need two more days to finish it properly.",
    task: "Which email would you send?",
    options: [
      {
        id: "informal",
        text: "Hey Mark! Super busy here, the report isn't ready lol. Friday ok? Thx!",
        outcome: "adjust",
        consequence: "Mr. Davies replies briefly and asks whether the project is under control. The casual tone made the delay sound unplanned.",
        feedback: "This message is fine for a friend, but not for a client. A professional email needs a polite greeting, the reason for writing, a polite request and a clear next step.",
      },
      {
        id: "direct",
        text: "Mr. Davies, the report will be late. You must give us until Friday. Confirm this today.",
        outcome: "adjust",
        consequence: "Mr. Davies agrees, but his reply is cold. The request sounded like an order, not a question.",
        feedback: "The structure is clear, but 'You must' and 'Confirm this today' sound demanding. Modal verbs like 'could' and 'would' make a request polite: 'Could we deliver it on Friday?'",
      },
      {
        id: "professional",
        text: "Dear Mr. Davies, I am writing to update you on the project report. We need two more days to check the final figures. Could we deliver it on Friday? Please let me know if this works for you.",
        outcome: "works",
        consequence: "Mr. Davies thanks you for the update and agrees to Friday. He appreciates knowing the reason in advance.",
        feedback: "Great choice. You used a polite greeting, explained the reason, made a courteous request and offered a clear next step.",
      },
    ],
  },
  "biz-u1-l2": {
    key: "biz-u1-l2",
    title: "Finding the decision in meeting notes",
    situation: "After a team meeting, your manager asks what the team agreed to do about the launch date. The notes mention a decision, an owner and a deadline.",
    task: "Which response gives the clearest summary?",
    options: [
      {
        id: "vague",
        text: "We talked about the launch, and people had some ideas.",
        outcome: "adjust",
        consequence: "Your manager still does not know what was decided or who will act.",
        feedback: "A useful meeting summary identifies the decision, the person responsible and the date. Avoid a vague summary when the team needs a clear record.",
      },
      {
        id: "clear",
        text: "We agreed to keep the launch on May 20. Priya will confirm the final schedule by Friday.",
        outcome: "works",
        consequence: "Your manager understands the decision, owner and deadline.",
        feedback: "Exactly. You stated the decision, named the owner and included a specific deadline.",
      },
      {
        id: "opinion",
        text: "I think the launch date is probably fine, but we should discuss it again.",
        outcome: "adjust",
        consequence: "Your manager cannot tell whether this is the team's decision or only your opinion.",
        feedback: "Separate confirmed decisions from personal opinions. Report what the notes say and flag open questions clearly.",
      },
    ],
  },
  "biz-u1-l3": {
    key: "biz-u1-l3",
    title: "Giving a concise progress update",
    situation: "At the weekly meeting, your manager asks for an update on the customer research. You have finished the interviews, but the analysis is still in progress.",
    task: "What is the best update?",
    options: [
      {
        id: "unclear",
        text: "There are a lot of things happening, and I'll tell you more later.",
        outcome: "adjust",
        consequence: "The team cannot tell what is complete or what remains.",
        feedback: "A strong update distinguishes completed work from work in progress and gives a clear next step.",
      },
      {
        id: "specific",
        text: "We've completed the interviews. I'm analyzing the results now and will share the summary on Thursday.",
        outcome: "works",
        consequence: "The team knows the status and when to expect the next deliverable.",
        feedback: "Well done. You gave the completed task, the current activity and a concrete date for the next update.",
      },
      {
        id: "overpromise",
        text: "Everything is finished, so the report will definitely be ready today.",
        outcome: "adjust",
        consequence: "The team expects a finished report even though the analysis is not complete.",
        feedback: "Do not describe work in progress as complete. Give a realistic status and deadline.",
      },
    ],
  },
  "biz-u1-l4": {
    key: "biz-u1-l4",
    title: "Writing useful meeting notes",
    situation: "You are writing notes after a project meeting. The team decided that Omar will test the new feature by Tuesday, and the group will review the results on Wednesday.",
    task: "Which note is most useful?",
    options: [
      {
        id: "paragraph",
        text: "The team had a productive discussion about the feature and testing.",
        outcome: "adjust",
        consequence: "The note records the topic but loses the commitments.",
        feedback: "Meeting notes should capture decisions and actions, including the owner and deadline—not just the topic discussed.",
      },
      {
        id: "action",
        text: "Action: Omar to test the new feature by Tuesday. Follow-up: review results on Wednesday.",
        outcome: "works",
        consequence: "Everyone can see who must act and when the team will follow up.",
        feedback: "Correct. The action has a named owner and deadline, followed by a clear review point.",
      },
      {
        id: "ownerless",
        text: "The new feature should be tested soon, and the results should be reviewed.",
        outcome: "adjust",
        consequence: "No one is explicitly responsible and neither date is clear.",
        feedback: "Replace vague timing like 'soon' with dates, and name the person responsible for each action.",
      },
    ],
  },
  "biz-u1-l5": {
    key: "biz-u1-l5",
    title: "Clarifying an action item",
    situation: "A colleague says, 'I'll follow up on the figures before the next meeting.' You need to know exactly what that means.",
    task: "What should you ask?",
    options: [
      {
        id: "assume",
        text: "Great, I assume you'll do everything.",
        outcome: "adjust",
        consequence: "The task remains too broad and expectations may differ.",
        feedback: "Do not rely on assumptions. Clarify the specific action and timing.",
      },
      {
        id: "clarify",
        text: "Thanks. Could you confirm which figures you'll check and when you'll send the update?",
        outcome: "works",
        consequence: "You establish the scope of the task and when to expect the result.",
        feedback: "Good. 'Follow up' means take the next step, but the details and deadline may need clarification.",
      },
      {
        id: "dismiss",
        text: "Never mind. We'll figure it out at the meeting.",
        outcome: "adjust",
        consequence: "The team may arrive at the next meeting without the needed figures.",
        feedback: "Clarifying an action item early helps the team prepare and prevents avoidable delays.",
      },
    ],
  },
  "biz-u1-l6": {
    key: "biz-u1-l6",
    title: "Disagreeing politely in a meeting",
    situation: "A teammate suggests launching a feature tomorrow. You believe the team needs one more day of testing because a serious issue is unresolved.",
    task: "Which response is professional and constructive?",
    options: [
      {
        id: "blunt",
        text: "That's a bad idea. We can't do that.",
        outcome: "adjust",
        consequence: "Your teammate may become defensive, and the reason is not explained.",
        feedback: "Direct disagreement can sound confrontational. Explain the concern and offer a constructive alternative.",
      },
      {
        id: "polite",
        text: "I see your point, but I'm concerned about the unresolved issue. Could we launch after one more day of testing?",
        outcome: "works",
        consequence: "You explain the risk and suggest a practical next step.",
        feedback: "Exactly. Acknowledge the other view, state the concern and make a polite proposal.",
      },
      {
        id: "silent",
        text: "Sure, let's launch tomorrow.",
        outcome: "adjust",
        consequence: "The team proceeds without hearing about the unresolved issue.",
        feedback: "Professional communication includes raising important risks respectfully rather than staying silent.",
      },
    ],
  },
  "biz-u2-l1": {
    key: "biz-u2-l1",
    title: "Responding to a work voice message",
    situation: "You hear a voice message from a supplier. They say the delivery is delayed and ask you to call back before 3 p.m. to confirm a new date.",
    task: "What should you do next?",
    options: [
      {
        id: "missed",
        text: "Wait for another message because the supplier will probably call again.",
        outcome: "adjust",
        consequence: "The supplier does not receive the confirmation they requested.",
        feedback: "Listen for who called, the reason, the requested action and the deadline. Here, you need to call back before 3 p.m.",
      },
      {
        id: "action",
        text: "Call the supplier before 3 p.m. to discuss the delay and confirm a new delivery date.",
        outcome: "works",
        consequence: "You respond to the request and agree on the next step.",
        feedback: "Correct. You identified the issue, the action requested and the time limit.",
      },
      {
        id: "wrong",
        text: "Email the marketing team about the launch campaign.",
        outcome: "adjust",
        consequence: "The supplier's request remains unanswered.",
        feedback: "Make sure your next action matches the message. Identify the caller's purpose before responding.",
      },
    ],
  },
  "biz-u2-l2": {
    key: "biz-u2-l2",
    title: "Identifying the purpose of a work email",
    situation: "Your manager emails: 'Please review the attached draft and send me your comments by Thursday afternoon.'",
    task: "What is the main request?",
    options: [
      {
        id: "topic",
        text: "The manager is sharing information about a draft.",
        outcome: "adjust",
        consequence: "You may read the email but miss the requested action.",
        feedback: "Look for action verbs and deadlines. 'Review' and 'send me your comments' are the requested actions.",
      },
      {
        id: "request",
        text: "Review the attached draft and send comments by Thursday afternoon.",
        outcome: "works",
        consequence: "You know what to do and when to do it.",
        feedback: "Exactly. Identify both the action and the deadline in a work email.",
      },
      {
        id: "meeting",
        text: "Schedule a meeting for Friday morning.",
        outcome: "adjust",
        consequence: "You take an action that the email did not request.",
        feedback: "Do not add tasks that are not in the message. Follow the stated request and deadline.",
      },
    ],
  },
  "biz-u2-l3": {
    key: "biz-u2-l3",
    title: "Following up on an email by phone",
    situation: "You sent a supplier an email asking them to confirm a delivery date, but you have not received a reply and the project deadline is approaching.",
    task: "How should you open the call?",
    options: [
      {
        id: "accuse",
        text: "You ignored my email. Why haven't you answered?",
        outcome: "adjust",
        consequence: "The supplier may become defensive before you can resolve the issue.",
        feedback: "Keep the tone professional. Refer to your earlier email, explain why you are calling and ask for confirmation.",
      },
      {
        id: "professional",
        text: "Hello, I'm following up on my email about the delivery date. Could you confirm when we can expect it?",
        outcome: "works",
        consequence: "The supplier understands the context and the specific information you need.",
        feedback: "Good. 'I'm following up on…' is a natural professional phrase, followed by a clear request.",
      },
      {
        id: "unclear",
        text: "Hi, I'm calling about something. Can you help?",
        outcome: "adjust",
        consequence: "The supplier has to ask what the call is about.",
        feedback: "Give enough context to make the purpose of the call clear, then ask a specific question.",
      },
    ],
  },
  "biz-u2-l4": {
    key: "biz-u2-l4",
    title: "Writing a clear work email",
    situation: "You need your teammate Alex to send the latest sales figures by noon tomorrow so you can finish a report.",
    task: "Which email is clearest and most professional?",
    options: [
      {
        id: "vague",
        text: "Hi Alex, can you send me that thing when you can? Thanks.",
        outcome: "adjust",
        consequence: "Alex may not know which information you need or when you need it.",
        feedback: "A clear work email names the requested item and gives a deadline.",
      },
      {
        id: "clear",
        text: "Hi Alex, could you send me the latest sales figures by noon tomorrow? I need them to complete the report. Thanks.",
        outcome: "works",
        consequence: "Alex knows what to send, by when and why it is needed.",
        feedback: "Excellent. The request is polite, specific and includes a clear deadline and context.",
      },
      {
        id: "demand",
        text: "Send the figures immediately. I need them.",
        outcome: "adjust",
        consequence: "The message sounds abrupt and still does not specify which figures.",
        feedback: "Use a courteous request and identify the information clearly. Include a deadline rather than relying on 'immediately'.",
      },
    ],
  },
  "biz-u2-l5": {
    key: "biz-u2-l5",
    title: "Choosing the right tone for a message",
    situation: "You are messaging a new client to confirm that you received their project documents and will review them by Wednesday.",
    task: "Which message fits a professional client relationship?",
    options: [
      {
        id: "casual",
        text: "Got the stuff! I'll check it whenever. Cheers!",
        outcome: "adjust",
        consequence: "The client may find the wording too casual and the timing unclear.",
        feedback: "Informal wording may be fine with close teammates, but a new client needs a clear, professional message.",
      },
      {
        id: "appropriate",
        text: "Thank you for sending the project documents. I've received them and will review them by Wednesday.",
        outcome: "works",
        consequence: "The client receives a courteous confirmation and a clear timeframe.",
        feedback: "Correct. The tone is professional, the receipt is confirmed and the expected completion date is explicit.",
      },
      {
        id: "overformal",
        text: "I hereby acknowledge receipt of the aforementioned materials and shall endeavor to inspect them.",
        outcome: "adjust",
        consequence: "The message sounds unnecessarily complicated for a routine update.",
        feedback: "Professional does not have to mean overly formal. Prefer clear, natural language that suits the relationship.",
      },
    ],
  },
};

export function challengeFor(key: string | null | undefined): RealLifeChallenge | null {
  if (!key) return null;
  return REAL_LIFE_CHALLENGES[key] ?? null;
}

export function challengeOption(
  challenge: RealLifeChallenge,
  optionId: string | null,
): ChallengeOption | null {
  if (!optionId) return null;
  return challenge.options.find((option) => option.id === optionId) ?? null;
}

/** Local, device-only record that the challenge was completed. */
export function challengeStorageKey(userId: string, lessonKey: string) {
  return `real-life-challenge:${userId}:${lessonKey}`;
}
