-- Phase 11: pedagogical content enrichment.
-- Six lessons in the existing format (level b2, unit 2) covering the skills the
-- adaptive 'next step' layer could not match: grammar, vocabulary, talking
-- (speaking) and pronunciation. No schema change, no new table, no new model.
-- Quiz items keep the existing pedagogical_skill contract (grammar/vocabulary).

INSERT INTO public.lessons (title, category, level, objective, summary, transcript, transcript_pt, sort_order, unit_number, position_in_unit, skill, curriculum_key, generated, video_duration_seconds)
VALUES ('Present Perfect in Real Life', 'grammar', 'b2', 'Talk about experiences and results with the present perfect.', 'Use the present perfect for experiences and for past actions with a result now: ''I have finished the report.'' Use ''for'' with a period and ''since'' with a starting point.', 'The present perfect links the past to now. We use it for experiences without a fixed time: I have worked with international teams. We use it for results we can still see: She has sent the proposal, so the client has it now. With ''for'' we give a period: for three years. With ''since'' we give a starting point: since 2021. When the time is finished and known, we use the past simple instead: I sent it yesterday. In a meeting you often mix both: We have reviewed the numbers, and we agreed on them last Friday.', 'O present perfect liga o passado ao agora. Usamos para experiências sem tempo definido: I have worked with international teams. Usamos para resultados que ainda se veem: She has sent the proposal. Com ''for'' indicamos um período: for three years. Com ''since'', um ponto de início: since 2021. Quando o tempo terminou e é conhecido, usamos past simple: I sent it yesterday.', 4, 2, 1, 'grammar', 'b2-u2-l1', false, 0)
ON CONFLICT DO NOTHING;

INSERT INTO public.quizzes (lesson_id, question, question_type, options, correct_answer, explanation, sort_order, pedagogical_skill)
SELECT id, 'She _____ the report, so the client already has it.', 'multiple_choice', jsonb_build_array('has sent', 'sent', 'is sending', 'have sent'), 'has sent', 'The result matters now, so we use the present perfect.', 0, 'grammar'
FROM public.lessons WHERE curriculum_key = 'b2-u2-l1'
ON CONFLICT DO NOTHING;

INSERT INTO public.quizzes (lesson_id, question, question_type, options, correct_answer, explanation, sort_order, pedagogical_skill)
SELECT id, 'I have worked here _____ 2021.', 'multiple_choice', jsonb_build_array('since', 'for', 'during', 'from'), 'since', '''Since'' introduces a starting point.', 1, 'grammar'
FROM public.lessons WHERE curriculum_key = 'b2-u2-l1'
ON CONFLICT DO NOTHING;

INSERT INTO public.quizzes (lesson_id, question, question_type, options, correct_answer, explanation, sort_order, pedagogical_skill)
SELECT id, 'We _____ the contract last Friday.', 'multiple_choice', jsonb_build_array('signed', 'have signed', 'has signed', 'are signing'), 'signed', 'The time is finished and known, so past simple.', 2, 'grammar'
FROM public.lessons WHERE curriculum_key = 'b2-u2-l1'
ON CONFLICT DO NOTHING;

INSERT INTO public.quizzes (lesson_id, question, question_type, options, correct_answer, explanation, sort_order, pedagogical_skill)
SELECT id, 'They have lived in Lisbon _____ three years.', 'multiple_choice', jsonb_build_array('for', 'since', 'ago', 'by'), 'for', '''For'' introduces a period of time.', 3, 'grammar'
FROM public.lessons WHERE curriculum_key = 'b2-u2-l1'
ON CONFLICT DO NOTHING;

INSERT INTO public.flashcards (lesson_id, word, translation, pronunciation, example, definition, difficulty, sort_order)
SELECT id, 'have been', 'já estive/estivemos', '/hæv bɪn/', 'I have been to three interviews this month.', 'Present perfect of ''be'', used for experiences.', 'medium', 0
FROM public.lessons WHERE curriculum_key = 'b2-u2-l1'
ON CONFLICT DO NOTHING;

INSERT INTO public.flashcards (lesson_id, word, translation, pronunciation, example, definition, difficulty, sort_order)
SELECT id, 'since', 'desde', '/sɪns/', 'I have known her since university.', 'Marks the starting point of an action.', 'medium', 1
FROM public.lessons WHERE curriculum_key = 'b2-u2-l1'
ON CONFLICT DO NOTHING;

INSERT INTO public.flashcards (lesson_id, word, translation, pronunciation, example, definition, difficulty, sort_order)
SELECT id, 'for', 'por/durante', '/fɔːr/', 'We have waited for two weeks.', 'Marks a period of duration.', 'medium', 2
FROM public.lessons WHERE curriculum_key = 'b2-u2-l1'
ON CONFLICT DO NOTHING;

INSERT INTO public.lessons (title, category, level, objective, summary, transcript, transcript_pt, sort_order, unit_number, position_in_unit, skill, curriculum_key, generated, video_duration_seconds)
VALUES ('Conditionals for Work Decisions', 'grammar', 'b2', 'Use first and second conditionals to discuss plans and hypotheses.', 'First conditional for real possibilities: ''If we finish today, we will launch tomorrow.'' Second conditional for hypotheses: ''If I had more budget, I would hire another developer.''', 'Conditionals help you negotiate and plan. The first conditional describes a real possibility: If the client approves the budget, we will start in March. The second conditional describes something imaginary or unlikely now: If I were the manager, I would change the process. Notice the forms: if + present simple, will + verb; if + past simple, would + verb. In professional English, ''would'' also softens a request: It would help if you sent the file today. Avoid ''will'' after ''if'' in the condition clause.', 'Condicionais ajudam a negociar e planejar. A primeira condicional descreve possibilidade real: If the client approves the budget, we will start in March. A segunda descreve algo imaginário: If I were the manager, I would change the process. Formas: if + present simple, will + verbo; if + past simple, would + verbo. Evite ''will'' depois de ''if'' na condição.', 5, 2, 2, 'grammar', 'b2-u2-l2', false, 0)
ON CONFLICT DO NOTHING;

INSERT INTO public.quizzes (lesson_id, question, question_type, options, correct_answer, explanation, sort_order, pedagogical_skill)
SELECT id, 'If the client approves the budget, we _____ in March.', 'multiple_choice', jsonb_build_array('will start', 'would start', 'started', 'start will'), 'will start', 'Real possibility: first conditional.', 0, 'grammar'
FROM public.lessons WHERE curriculum_key = 'b2-u2-l2'
ON CONFLICT DO NOTHING;

INSERT INTO public.quizzes (lesson_id, question, question_type, options, correct_answer, explanation, sort_order, pedagogical_skill)
SELECT id, 'If I _____ the manager, I would change the process.', 'multiple_choice', jsonb_build_array('were', 'am', 'will be', 'have been'), 'were', 'Second conditional uses the past form, and ''were'' with I.', 1, 'grammar'
FROM public.lessons WHERE curriculum_key = 'b2-u2-l2'
ON CONFLICT DO NOTHING;

INSERT INTO public.quizzes (lesson_id, question, question_type, options, correct_answer, explanation, sort_order, pedagogical_skill)
SELECT id, 'It _____ help if you sent the file today.', 'multiple_choice', jsonb_build_array('would', 'will', 'did', 'has'), 'would', '''Would'' softens the request.', 2, 'grammar'
FROM public.lessons WHERE curriculum_key = 'b2-u2-l2'
ON CONFLICT DO NOTHING;

INSERT INTO public.quizzes (lesson_id, question, question_type, options, correct_answer, explanation, sort_order, pedagogical_skill)
SELECT id, 'If we _____ today, we will launch tomorrow.', 'multiple_choice', jsonb_build_array('finish', 'will finish', 'would finish', 'finished'), 'finish', 'No ''will'' in the if-clause of a first conditional.', 3, 'grammar'
FROM public.lessons WHERE curriculum_key = 'b2-u2-l2'
ON CONFLICT DO NOTHING;

INSERT INTO public.flashcards (lesson_id, word, translation, pronunciation, example, definition, difficulty, sort_order)
SELECT id, 'if I were you', 'se eu fosse você', '/ɪf aɪ wɜːr juː/', 'If I were you, I would ask for more time.', 'Common second-conditional advice phrase.', 'medium', 0
FROM public.lessons WHERE curriculum_key = 'b2-u2-l2'
ON CONFLICT DO NOTHING;

INSERT INTO public.flashcards (lesson_id, word, translation, pronunciation, example, definition, difficulty, sort_order)
SELECT id, 'unless', 'a menos que', '/ənˈles/', 'We cannot ship unless the client signs.', 'Means ''if not''.', 'medium', 1
FROM public.lessons WHERE curriculum_key = 'b2-u2-l2'
ON CONFLICT DO NOTHING;

INSERT INTO public.flashcards (lesson_id, word, translation, pronunciation, example, definition, difficulty, sort_order)
SELECT id, 'as long as', 'desde que', '/æz lɒŋ æz/', 'We will deliver as long as the data arrives today.', 'Introduces a condition.', 'medium', 2
FROM public.lessons WHERE curriculum_key = 'b2-u2-l2'
ON CONFLICT DO NOTHING;

INSERT INTO public.lessons (title, category, level, objective, summary, transcript, transcript_pt, sort_order, unit_number, position_in_unit, skill, curriculum_key, generated, video_duration_seconds)
VALUES ('Vocabulary for Meetings at Work', 'vocabulary', 'b2', 'Use common meeting expressions to lead and take part in discussions.', 'Learn phrases to open, interrupt politely, agree, disagree and close a meeting, with natural collocations such as ''set the agenda'' and ''follow up''.', 'Meetings follow a predictable language pattern. To open: Let''s get started. Shall we begin? To structure: The first item on the agenda is the budget. To interrupt politely: Sorry to jump in, but... To check understanding: Just to be clear, are you saying that...? To agree: That makes sense. To disagree softly: I see your point, although I would suggest... To close: Let''s follow up by email. Useful collocations: set the agenda, raise a concern, take the minutes, follow up on an action.', 'Reuniões seguem um padrão de linguagem previsível. Para abrir: Let''s get started. Para estruturar: The first item on the agenda is the budget. Para interromper com educação: Sorry to jump in, but... Para discordar com cuidado: I see your point, although I would suggest... Para encerrar: Let''s follow up by email.', 6, 2, 3, 'vocabulary', 'b2-u2-l3', false, 0)
ON CONFLICT DO NOTHING;

INSERT INTO public.quizzes (lesson_id, question, question_type, options, correct_answer, explanation, sort_order, pedagogical_skill)
SELECT id, 'Choose the polite way to interrupt in a meeting.', 'multiple_choice', jsonb_build_array('Sorry to jump in, but...', 'Stop talking now.', 'You are wrong.', 'Listen to me.'), 'Sorry to jump in, but...', 'It signals the interruption politely.', 0, 'vocabulary'
FROM public.lessons WHERE curriculum_key = 'b2-u2-l3'
ON CONFLICT DO NOTHING;

INSERT INTO public.quizzes (lesson_id, question, question_type, options, correct_answer, explanation, sort_order, pedagogical_skill)
SELECT id, 'Which phrase opens a meeting?', 'multiple_choice', jsonb_build_array('Let''s get started.', 'Let''s follow up by email.', 'Take the minutes.', 'I see your point.'), 'Let''s get started.', 'It starts the discussion.', 1, 'vocabulary'
FROM public.lessons WHERE curriculum_key = 'b2-u2-l3'
ON CONFLICT DO NOTHING;

INSERT INTO public.quizzes (lesson_id, question, question_type, options, correct_answer, explanation, sort_order, pedagogical_skill)
SELECT id, 'Complete: Let''s _____ up on that action next week.', 'multiple_choice', jsonb_build_array('follow', 'make', 'take', 'raise'), 'follow', '''Follow up on'' means to check progress later.', 2, 'vocabulary'
FROM public.lessons WHERE curriculum_key = 'b2-u2-l3'
ON CONFLICT DO NOTHING;

INSERT INTO public.quizzes (lesson_id, question, question_type, options, correct_answer, explanation, sort_order, pedagogical_skill)
SELECT id, 'Which expression softens disagreement?', 'multiple_choice', jsonb_build_array('I see your point, although...', 'That is wrong.', 'No.', 'Next topic.'), 'I see your point, although...', 'It acknowledges before disagreeing.', 3, 'vocabulary'
FROM public.lessons WHERE curriculum_key = 'b2-u2-l3'
ON CONFLICT DO NOTHING;

INSERT INTO public.flashcards (lesson_id, word, translation, pronunciation, example, definition, difficulty, sort_order)
SELECT id, 'set the agenda', 'definir a pauta', '/set ði əˈdʒendə/', 'Could you set the agenda before Friday?', 'To decide the topics of a meeting.', 'medium', 0
FROM public.lessons WHERE curriculum_key = 'b2-u2-l3'
ON CONFLICT DO NOTHING;

INSERT INTO public.flashcards (lesson_id, word, translation, pronunciation, example, definition, difficulty, sort_order)
SELECT id, 'follow up', 'dar seguimento', '/ˈfɒləʊ ʌp/', 'I will follow up with the client tomorrow.', 'To check progress after a meeting.', 'medium', 1
FROM public.lessons WHERE curriculum_key = 'b2-u2-l3'
ON CONFLICT DO NOTHING;

INSERT INTO public.flashcards (lesson_id, word, translation, pronunciation, example, definition, difficulty, sort_order)
SELECT id, 'raise a concern', 'levantar uma preocupação', '/reɪz ə kənˈsɜːn/', 'She raised a concern about the deadline.', 'To mention a problem politely.', 'medium', 2
FROM public.lessons WHERE curriculum_key = 'b2-u2-l3'
ON CONFLICT DO NOTHING;

INSERT INTO public.lessons (title, category, level, objective, summary, transcript, transcript_pt, sort_order, unit_number, position_in_unit, skill, curriculum_key, generated, video_duration_seconds)
VALUES ('Travel Vocabulary in Context', 'vocabulary', 'b2', 'Handle travel situations with precise vocabulary and polite requests.', 'Airport, hotel and transport vocabulary used in short, natural requests: check in, boarding pass, connecting flight, book a room, aisle seat.', 'Travel English is short and polite. At the airport: I am checking in for the flight to Madrid. Is this a connecting flight? Could I have an aisle seat, please? At the hotel: I have a reservation under my name. Is breakfast included? Could you call a taxi for eight o''clock? When something goes wrong, describe it calmly: My luggage did not arrive. The air conditioning is not working. Notice the polite pattern: Could I / Could you + verb, which is softer than ''I want''.', 'Inglês de viagem é curto e educado. No aeroporto: I am checking in for the flight to Madrid. No hotel: I have a reservation under my name. Is breakfast included? Quando algo dá errado: My luggage did not arrive. Note o padrão educado: Could I / Could you + verbo, mais suave que ''I want''.', 7, 2, 4, 'vocabulary', 'b2-u2-l4', false, 0)
ON CONFLICT DO NOTHING;

INSERT INTO public.quizzes (lesson_id, question, question_type, options, correct_answer, explanation, sort_order, pedagogical_skill)
SELECT id, 'You want a seat next to the corridor. Ask for:', 'multiple_choice', jsonb_build_array('an aisle seat', 'a window seat', 'a middle seat', 'a gate seat'), 'an aisle seat', 'The aisle is the corridor of the plane.', 0, 'vocabulary'
FROM public.lessons WHERE curriculum_key = 'b2-u2-l4'
ON CONFLICT DO NOTHING;

INSERT INTO public.quizzes (lesson_id, question, question_type, options, correct_answer, explanation, sort_order, pedagogical_skill)
SELECT id, 'Complete: I have a _____ for two nights.', 'multiple_choice', jsonb_build_array('reservation', 'reserve', 'booked', 'reserving'), 'reservation', '''Reservation'' is the noun used at hotels.', 1, 'vocabulary'
FROM public.lessons WHERE curriculum_key = 'b2-u2-l4'
ON CONFLICT DO NOTHING;

INSERT INTO public.quizzes (lesson_id, question, question_type, options, correct_answer, explanation, sort_order, pedagogical_skill)
SELECT id, 'A flight with a change of planes is a:', 'multiple_choice', jsonb_build_array('connecting flight', 'direct flight', 'boarding pass', 'check-in desk'), 'connecting flight', 'You connect to another plane.', 2, 'vocabulary'
FROM public.lessons WHERE curriculum_key = 'b2-u2-l4'
ON CONFLICT DO NOTHING;

INSERT INTO public.quizzes (lesson_id, question, question_type, options, correct_answer, explanation, sort_order, pedagogical_skill)
SELECT id, 'Choose the most polite request.', 'multiple_choice', jsonb_build_array('Could you call a taxi, please?', 'Call a taxi.', 'I want a taxi.', 'Taxi now.'), 'Could you call a taxi, please?', '''Could you'' softens the request.', 3, 'vocabulary'
FROM public.lessons WHERE curriculum_key = 'b2-u2-l4'
ON CONFLICT DO NOTHING;

INSERT INTO public.flashcards (lesson_id, word, translation, pronunciation, example, definition, difficulty, sort_order)
SELECT id, 'boarding pass', 'cartão de embarque', '/ˈbɔːdɪŋ pɑːs/', 'Please show your boarding pass at the gate.', 'Document that allows you to board.', 'medium', 0
FROM public.lessons WHERE curriculum_key = 'b2-u2-l4'
ON CONFLICT DO NOTHING;

INSERT INTO public.flashcards (lesson_id, word, translation, pronunciation, example, definition, difficulty, sort_order)
SELECT id, 'check in', 'fazer check-in', '/tʃek ɪn/', 'We can check in online 24 hours before.', 'To register for a flight or hotel.', 'medium', 1
FROM public.lessons WHERE curriculum_key = 'b2-u2-l4'
ON CONFLICT DO NOTHING;

INSERT INTO public.flashcards (lesson_id, word, translation, pronunciation, example, definition, difficulty, sort_order)
SELECT id, 'aisle seat', 'assento no corredor', '/aɪl siːt/', 'I always book an aisle seat on long flights.', 'Seat next to the corridor.', 'medium', 2
FROM public.lessons WHERE curriculum_key = 'b2-u2-l4'
ON CONFLICT DO NOTHING;

INSERT INTO public.lessons (title, category, level, objective, summary, transcript, transcript_pt, sort_order, unit_number, position_in_unit, skill, curriculum_key, generated, video_duration_seconds)
VALUES ('Speaking: Presenting Your Ideas', 'speaking', 'b2', 'Present an idea clearly in one minute with a simple spoken structure.', 'Structure short spoken presentations: state the idea, give one reason, give one example, close with a question. Practise aloud with the AI Talking coach.', 'A clear one-minute presentation has four moves. State the idea: My suggestion is to test the feature with ten users first. Give one reason: This way we reduce the risk before launch. Give one example: We did the same with the payment flow and found two bugs early. Close with a question: What do you think about starting next week? Speak in short sentences, stress the key word in each sentence, and pause between the moves. Fillers like ''so'' and ''well'' are natural, but keep them short.', 'Uma apresentação clara de um minuto tem quatro movimentos. Apresente a ideia, dê um motivo, dê um exemplo e encerre com uma pergunta. Fale em frases curtas, enfatize a palavra-chave e pause entre os movimentos.', 8, 2, 5, 'talking', 'b2-u2-l5', false, 0)
ON CONFLICT DO NOTHING;

INSERT INTO public.quizzes (lesson_id, question, question_type, options, correct_answer, explanation, sort_order, pedagogical_skill)
SELECT id, 'Which sentence states the idea?', 'multiple_choice', jsonb_build_array('My suggestion is to test with ten users first.', 'What do you think?', 'We found two bugs.', 'So, well, anyway.'), 'My suggestion is to test with ten users first.', 'It presents the proposal directly.', 0, 'vocabulary'
FROM public.lessons WHERE curriculum_key = 'b2-u2-l5'
ON CONFLICT DO NOTHING;

INSERT INTO public.quizzes (lesson_id, question, question_type, options, correct_answer, explanation, sort_order, pedagogical_skill)
SELECT id, 'Which phrase is the best way to close a short presentation?', 'multiple_choice', jsonb_build_array('What do you think?', 'Repeat everything.', 'I am sorry.', 'Nothing else.'), 'What do you think?', 'A question invites a response.', 1, 'vocabulary'
FROM public.lessons WHERE curriculum_key = 'b2-u2-l5'
ON CONFLICT DO NOTHING;

INSERT INTO public.quizzes (lesson_id, question, question_type, options, correct_answer, explanation, sort_order, pedagogical_skill)
SELECT id, 'Complete: _____ example, we tested the payment flow first.', 'multiple_choice', jsonb_build_array('For', 'By', 'In', 'At'), 'For', '''For example'' introduces an example.', 2, 'vocabulary'
FROM public.lessons WHERE curriculum_key = 'b2-u2-l5'
ON CONFLICT DO NOTHING;

INSERT INTO public.quizzes (lesson_id, question, question_type, options, correct_answer, explanation, sort_order, pedagogical_skill)
SELECT id, 'Which phrase introduces a proposal?', 'multiple_choice', jsonb_build_array('My suggestion is...', 'I am late.', 'That is all.', 'Never mind.'), 'My suggestion is...', 'It presents what you propose.', 3, 'vocabulary'
FROM public.lessons WHERE curriculum_key = 'b2-u2-l5'
ON CONFLICT DO NOTHING;

INSERT INTO public.flashcards (lesson_id, word, translation, pronunciation, example, definition, difficulty, sort_order)
SELECT id, 'my suggestion is', 'minha sugestão é', '/maɪ səˈdʒestʃən ɪz/', 'My suggestion is to start with a small test.', 'Introduces a proposal.', 'medium', 0
FROM public.lessons WHERE curriculum_key = 'b2-u2-l5'
ON CONFLICT DO NOTHING;

INSERT INTO public.flashcards (lesson_id, word, translation, pronunciation, example, definition, difficulty, sort_order)
SELECT id, 'for example', 'por exemplo', '/fɔːr ɪɡˈzɑːmpəl/', 'For example, we tested the payment flow first.', 'Introduces an example.', 'medium', 1
FROM public.lessons WHERE curriculum_key = 'b2-u2-l5'
ON CONFLICT DO NOTHING;

INSERT INTO public.flashcards (lesson_id, word, translation, pronunciation, example, definition, difficulty, sort_order)
SELECT id, 'what do you think', 'o que você acha', '/wɒt duː juː θɪŋk/', 'What do you think about next week?', 'Invites the other person to answer.', 'medium', 2
FROM public.lessons WHERE curriculum_key = 'b2-u2-l5'
ON CONFLICT DO NOTHING;

INSERT INTO public.lessons (title, category, level, objective, summary, transcript, transcript_pt, sort_order, unit_number, position_in_unit, skill, curriculum_key, generated, video_duration_seconds)
VALUES ('Word Stress and Clear Speech', 'pronunciation', 'b2', 'Place word stress correctly and link words in connected speech.', 'English rhythm depends on stress. Learn to stress the right syllable, weaken the others, and link words naturally: ''PRE-sent'' (noun) vs ''pre-SENT'' (verb).', 'English is a stress-based language. In every word of two syllables or more, one syllable is stronger: DE-ve-lop, im-POR-tant, in-for-MA-tion. Some words change meaning with stress: a PREsent (gift) and to preSENT (to show). Unstressed syllables become weak, often with the schwa sound: ''computer'' sounds like cuhm-PYOO-ter. In connected speech we link words: ''an apple'' sounds like ''a-napple''. Practise slowly first, then at natural speed.', 'O inglês é uma língua de tonicidade. Em palavras com duas sílabas ou mais, uma é mais forte: DE-ve-lop, im-POR-tant. Algumas mudam de sentido com a tônica: a PREsent (presente) e to preSENT (apresentar). Sílabas não tônicas ficam fracas, com o som do schwa. Na fala conectada, ligamos as palavras: ''an apple'' soa como ''a-napple''.', 9, 2, 6, 'pronunciation', 'b2-u2-l6', false, 0)
ON CONFLICT DO NOTHING;

INSERT INTO public.quizzes (lesson_id, question, question_type, options, correct_answer, explanation, sort_order, pedagogical_skill)
SELECT id, 'Where is the stress in ''important''?', 'multiple_choice', jsonb_build_array('im-POR-tant', 'IM-por-tant', 'im-por-TANT', 'no stress'), 'im-POR-tant', 'The second syllable is the strongest.', 0, 'vocabulary'
FROM public.lessons WHERE curriculum_key = 'b2-u2-l6'
ON CONFLICT DO NOTHING;

INSERT INTO public.quizzes (lesson_id, question, question_type, options, correct_answer, explanation, sort_order, pedagogical_skill)
SELECT id, '''A present'' (a gift) is stressed on the:', 'multiple_choice', jsonb_build_array('first syllable', 'second syllable', 'both syllables', 'last letter'), 'first syllable', 'The noun takes the stress at the beginning.', 1, 'vocabulary'
FROM public.lessons WHERE curriculum_key = 'b2-u2-l6'
ON CONFLICT DO NOTHING;

INSERT INTO public.quizzes (lesson_id, question, question_type, options, correct_answer, explanation, sort_order, pedagogical_skill)
SELECT id, 'In connected speech, ''an apple'' usually sounds like:', 'multiple_choice', jsonb_build_array('a-napple', 'an-apple with a pause', 'an apple slowly', 'ann apple'), 'a-napple', 'The consonant links to the next vowel.', 2, 'vocabulary'
FROM public.lessons WHERE curriculum_key = 'b2-u2-l6'
ON CONFLICT DO NOTHING;

INSERT INTO public.quizzes (lesson_id, question, question_type, options, correct_answer, explanation, sort_order, pedagogical_skill)
SELECT id, 'Unstressed syllables are usually:', 'multiple_choice', jsonb_build_array('weak, with the schwa sound', 'louder', 'longer', 'silent'), 'weak, with the schwa sound', 'Weak vowels reduce to the schwa.', 3, 'vocabulary'
FROM public.lessons WHERE curriculum_key = 'b2-u2-l6'
ON CONFLICT DO NOTHING;

INSERT INTO public.flashcards (lesson_id, word, translation, pronunciation, example, definition, difficulty, sort_order)
SELECT id, 'word stress', 'tonicidade', '/wɜːd stres/', 'Word stress changes the meaning of ''present''.', 'The strongest syllable in a word.', 'medium', 0
FROM public.lessons WHERE curriculum_key = 'b2-u2-l6'
ON CONFLICT DO NOTHING;

INSERT INTO public.flashcards (lesson_id, word, translation, pronunciation, example, definition, difficulty, sort_order)
SELECT id, 'linking', 'ligação de sons', '/ˈlɪŋkɪŋ/', 'Linking makes ''an apple'' sound like one word.', 'Joining the end of a word to the next.', 'medium', 1
FROM public.lessons WHERE curriculum_key = 'b2-u2-l6'
ON CONFLICT DO NOTHING;

INSERT INTO public.flashcards (lesson_id, word, translation, pronunciation, example, definition, difficulty, sort_order)
SELECT id, 'schwa', 'som fraco de vogal', '/ʃwɑː/', 'The first vowel in ''computer'' is a schwa.', 'The weak vowel of unstressed syllables.', 'medium', 2
FROM public.lessons WHERE curriculum_key = 'b2-u2-l6'
ON CONFLICT DO NOTHING;