// Portuguese translations for the app interface (course area).
// Lesson content, practice sentences and any AI generated text stay in English.
import { appGuidePt } from "./appGuidePt";

const baseUiPt: Record<string, string> = {
  "English Adventures": "Aventuras em inglês",
  "A story with EVO": "Uma história com a EVO",
  "Let's explore!": "Vamos explorar!",
  "English Adventures is a Premium feature": "English Adventures é um recurso Premium",
  "Unlock the stories with EVO and keep exploring your English.":
    "Desbloqueie as histórias com a EVO e continue evoluindo no inglês.",
  "Finish adventure": "Concluir aventura",
  "Continue the story": "Continuar a história",
  "Adventure complete!": "Aventura concluída!",
  "Your English. Your world. New experiences.": "Seu inglês. Seu mundo. Novas experiências.",
  "Explore again": "Explorar novamente",
  "Extra learning videos": "Vídeos extras de aprendizagem",
  "Watch video": "Assistir ao vídeo",
  "Today and Planning": "Hoje e planejamento",
  "Practise this task in English": "Praticar esta tarefa em inglês",
  // Admin push diagnostics
  Push: "Notificações push",
  "Push notifications": "Notificações push",
  "Each phone or browser registers itself only after tapping “Notifications” on that device and allowing them. The test goes only to your own devices.":
    "Cada celular ou navegador é registrado somente depois que você toca em “Notificações” nesse dispositivo e autoriza. O teste é enviado apenas aos seus próprios dispositivos.",
  "Check devices": "Verificar dispositivos",
  "Send test notification to my devices": "Enviar notificação de teste aos meus dispositivos",
  "The check could not run.": "Não foi possível realizar a verificação.",
  "Server push setup:": "Configuração do envio push:",
  configured: "configurado",
  "missing (LOVABLE_API_KEY / FIREBASE_MESSAGING_API_KEY)":
    "ausente (LOVABLE_API_KEY / FIREBASE_MESSAGING_API_KEY)",
  "Registered devices:": "Dispositivos registrados:",
  "students.": "alunos.",
  "Your devices:": "Seus dispositivos:",
  " — none: open the app on your phone, tap Notifications and allow them.":
    " — nenhum: abra o app no celular, toque em Notificações e autorize.",
  "last seen": "visto por último",
  "sent ✓": "enviado ✓",
  failed: "falhou",
  " (device no longer valid)": " (dispositivo não é mais válido)",
  "“sent ✓” but nothing on the phone: the phone or browser is blocking it (for example, Brave needs “Use Google services for push messaging” turned on, and Android needs the app’s notifications allowed). Test arrives but no daily push: the daily job is not running.":
    "“enviado ✓”, mas nada aparece no celular: o aparelho ou navegador está bloqueando a notificação (por exemplo, no Brave é preciso ativar “Usar serviços do Google para mensagens push”, e no Android permitir as notificações do app). Se o teste chega, mas o push diário não, o processo diário não está sendo executado.",
  // Authentication
  "Como você quer ser chamado": "What should we call you?",
  "seu@email.com": "you@example.com",
  "Ao criar uma conta, você concorda com os": "By creating an account, you agree to the",
  "Termos de Uso": "Terms of Use",
  "e a": "and the",
  "Política de Privacidade": "Privacy Policy",

  "Start Focus for your study?": "Quer iniciar o Focus para estudar?",
  "EVO invites you to focus": "A EVO convida você a entrar em foco.",
  "Start a {minutes}-minute focus block?": "Iniciar um bloco de foco de {minutes} minutos?",
  "Start Focus": "Iniciar Focus",
  "Not now": "Agora não",
  "EVO Focus suggestions": "Sugestões de Focus da EVO",

  "Allow Evoluir+ to send reminders and learning updates to this device.":
    "Permitir que o Evoluir+ envie lembretes e atualizações de estudo para este dispositivo.",
  Language: "Idioma",
  "Allow EVO to suggest starting a Focus session when you begin studying.":
    "Permitir que a EVO sugira iniciar uma sessão de Focus quando você começar a estudar.",
  "Could not update this preference. Please try again.":
    "Não foi possível atualizar esta preferência. Tente novamente.",
  "End and return to dashboard": "Encerrar e voltar ao painel",
  End: "Encerrar",
  "End call and return to dashboard": "Encerrar a chamada e voltar ao painel",
  "Start video call with EVO": "Iniciar videochamada com a EVO",
  "Ready to practise English in a realistic video call? Press the button when you are ready.":
    "Pronto para praticar inglês em uma videochamada realista? Pressione o botão quando estiver pronto.",
  "No call or AI request starts until you press this button.":
    "Nenhuma chamada ou solicitação à IA começa até você pressionar este botão.",
  "Checking song availability…": "Verificando disponibilidade da música…",
  "Your song is available for this session only.":
    "Sua música fica disponível apenas nesta sessão.",
  "Play it now and use Download to save the audio to your device before leaving or refreshing this page. Evoluir+ does not keep a permanent copy of the audio.":
    "Reproduza agora e use Baixar para salvar o áudio no seu dispositivo antes de sair ou atualizar esta página. O Evoluir+ não mantém uma cópia permanente do áudio.",
  "Session-only audio — download it now to keep a copy.":
    "Áudio disponível apenas nesta sessão — baixe agora para guardar uma cópia.",
  "Today's session progress": "Progresso da sessão de hoje",
  "Progress is available on this device, but could not be loaded from the server.":
    "O progresso está disponível neste dispositivo, mas não pôde ser carregado do servidor.",
  "Retry sync": "Tentar sincronizar novamente",
  "Your progress is saved on this device and is waiting to sync.":
    "Seu progresso está salvo neste dispositivo e aguarda sincronização.",
  "B1 Unit 1 Lesson 3 — Keeping a Conversation Going":
    "B1 Unidade 1 Lição 3 — Mantendo uma conversa",
  "B2 Unit 1 Lesson 1 — Listening to a Debate": "B2 Unidade 1 Lição 1 — Ouvindo um debate",
  "Microphone unavailable. Please try again.": "Microfone indisponível. Tente novamente.",
  Corrected: "Corrigido",
  "Next plan on Monday": "Próximo plano na segunda",
  "Delete this saved mistake? This cannot be undone.":
    "Excluir este erro salvo? Esta ação não pode ser desfeita.",
  "Mistake deleted.": "Erro excluído.",
  "Could not delete this mistake. Please try again.":
    "Não foi possível excluir este erro. Tente novamente.",
  Delete: "Excluir",
  "Download study book": "Baixar guia de estudos",
  "not reached yet": "ainda não alcançado",
  "Listen to EVO and LEO explore this lesson before you practise.":
    "Ouça EVO e LEO explorarem esta lição antes de praticar.",
  "click here": "clique aqui",
  // Life+ AI visual guide (/life/guide)
  "How Life+ AI works": "Como funciona o Life+ AI",
  "Your daily cycle": "Seu ciclo diário",
  "Open Life+ AI": "Abrir o Life+ AI",
  "Set your goals": "Defina suas metas",
  "Up to 3 goals, with a deadline and milestones.": "Até 3 metas, com prazo e etapas.",
  "EVO gives a step": "A EVO dá um passo",
  "One small step for each goal, every day.": "Um pequeno passo para cada meta, todo dia.",
  "Plan your day": "Planeje seu dia",
  "The day's tasks, by priority.": "As tarefas do dia, por prioridade.",
  "Keep your habits": "Mantenha seus hábitos",
  "One check-in a day builds a run.": "Um registro por dia forma uma sequência.",
  "Your day fills up": "Seu dia se completa",
  "The ring grows, and the goal steps count for your streak.":
    "O anel cresce, e os passos das metas contam para a sua sequência.",
  "What you want beyond English, one step a day.":
    "O que você quer além do inglês, um passo por dia.",
  "Write up to 3 goals.": "Escreva até 3 metas.",
  "Tick EVO's step of the day.": "Marque o passo do dia da EVO.",
  "Add milestones and a deadline to see how far you are.":
    "Adicione etapas e um prazo para ver quanto já avançou.",
  "The one thing that matters most today.": "A coisa que mais importa hoje.",
  "Write it in the morning.": "Escreva de manhã.",
  "Tick it when it is done.": "Marque quando estiver feita.",
  "The tasks of each day, by priority.": "As tarefas de cada dia, por prioridade.",
  "Add tasks for today or any day ahead.": "Adicione tarefas para hoje ou para os próximos dias.",
  "Choose high, medium or low and link a goal.": "Escolha alta, média ou baixa e ligue a uma meta.",
  "Tick them as you go.": "Marque conforme for fazendo.",
  "Small actions repeated until they stick.": "Pequenas ações repetidas até virarem rotina.",
  "Choose every day, weekdays or times a week.":
    "Escolha todo dia, dias úteis ou vezes por semana.",
  "Check in once a day; the last 7 days can be fixed.":
    "Marque uma vez por dia; os últimos 7 dias podem ser corrigidos.",
  "Watch the flame: days or weeks in a row.": "Acompanhe a chama: dias ou semanas seguidas.",
  "A habit like Study English can tick itself on your English study days.":
    "Um hábito como Estudar inglês pode se marcar sozinho nos seus dias de estudo de inglês.",
  "EVO helps you plan, in your language.": "A EVO ajuda você a planejar, no seu idioma.",
  "Ask for a plan or for today's priorities.": "Peça um plano ou as prioridades de hoje.",
  "EVO answers with your goals and habits in mind.":
    "A EVO responde pensando nas suas metas e hábitos.",
  "Add its suggestions with one tap.": "Adicione as sugestões com um toque.",
  "Relax and train your listening.": "Relaxe e treine sua escuta.",
  "Open Meditations at the top of Life+ AI and choose a session; EVO reads it slowly.":
    "Abra Meditações no topo do Life+ AI e escolha uma sessão; a EVO lê devagar.",
  "Focus blocks with short breaks, Pomodoro style.":
    "Blocos de foco com pausas curtas, no estilo Pomodoro.",
  "Choose 15, 25 or 50 minutes and start; a long break comes after every fourth block.":
    "Escolha 15, 25 ou 50 minutos e comece; a cada quatro blocos vem uma pausa longa.",
  "Premium: tie the block to one of today's tasks and tick it in the break.":
    "Premium: ligue o bloco a uma tarefa de hoje e marque-a na pausa.",
  "Use the break for two minutes of English; your week shows in bars.":
    "Use a pausa para dois minutos de inglês; sua semana aparece em barras.",
  "Follow the text and see the translation if you need it.":
    "Acompanhe o texto e veja a tradução se precisar.",
  "Finish with five key words and one question.":
    "Termine com cinco palavras-chave e uma pergunta.",
  "All meditations": "Todas as meditações",
  "Run 5 km": "Correr 5 km",
  "Walk for 15 minutes": "Caminhar 15 minutos",
  "Finish the report before lunch": "Terminar o relatório antes do almoço",
  "Call the bank": "Ligar para o banco",
  "Read 10 pages": "Ler 10 páginas",
  "Tidy the desk": "Arrumar a mesa",
  "How do I start saving money?": "Como começo a guardar dinheiro?",
  "Start small: save 10% of what you get this week.":
    "Comece pequeno: guarde 10% do que receber esta semana.",
  "Save 10% this week": "Guardar 10% esta semana",
  "3 min": "3 min",
  // Meditations in English (Life+ AI)
  "Meditations in English": "Meditações em inglês",
  "Relax and train your listening: EVO guides you slowly, with the text on screen.":
    "Relaxe e treine sua escuta: a EVO conduz devagar, com o texto na tela.",
  "Lesson audio": "Áudio da lição",
  "Summary videos": "Vídeos do Summary",
  "Listen to EVO and Leo explore this lesson before you practise.":
    "Ouça EVO e Leo explorarem esta lição antes de praticar.",
  "Listen to the lesson audio": "Ouvir o áudio da lição",
  "You did everything else — only the audio is left.":
    "Você já fez o resto — só falta ouvir o áudio.",
  "The lesson audio could not be prepared right now. Read the summary below and continue the lesson.":
    "Não foi possível preparar o áudio agora. Leia o resumo abaixo e continue a lição.",
  "EVO and Leo are preparing your lesson audio…":
    "EVO e Leo estão preparando o áudio da sua lição…",
  "Play audio": "Ouvir áudio",
  "Show translation": "Ver tradução",
  "Hide translation": "Ocultar tradução",
  "Key words": "Palavras-chave",
  "Think about it": "Para pensar",
  "Answer it with the AI Teacher": "Responda com o AI Teacher",
  "Back to meditations": "Voltar às meditações",
  "min of meditation": "min de meditação",
  "Calm breathing": "Respiração calma",
  "Any time you need a pause": "Sempre que precisar de uma pausa",
  "Focus before studying": "Foco antes de estudar",
  "Before a lesson or a task": "Antes de uma lição ou tarefa",
  Gratitude: "Gratidão",
  "In the morning or at night": "De manhã ou à noite",
  "Relax before sleep": "Relaxar antes de dormir",
  "At night, in bed": "À noite, na cama",
  "Two-minute break": "Pausa de dois minutos",
  "In the middle of work or study": "No meio do trabalho ou do estudo",
  "Try a meditation in English to relax and train your listening.":
    "Experimente uma meditação em inglês para relaxar e treinar a escuta.",
  // Life+ AI (phase 1)
  "Daily overview": "Visão geral do dia",
  "Life+ AI": "Life+ AI",
  "Evolve one day at a time.": "Evolua um dia de cada vez.",
  Tomorrow: "Amanhã",
  Yesterday: "Ontem",
  Routine: "Rotina",
  Habits: "Hábitos",
  "Life Coach": "Life Coach",
  "Ask EVO for help": "Pedir ajuda à EVO",
  "How do I start?": "Como eu começo?",
  "Words I can use": "Palavras que posso usar",
  "Check my last sentence": "Conferir minha última frase",
  "Ask anything, in Portuguese or English": "Pergunte o que quiser, em português ou inglês",
  "EVO gives hints, never your whole text. Uses your AI Teacher daily limit.":
    "A EVO dá dicas, nunca o texto inteiro. Usa o limite diário do Professor de IA.",
  "You reached today's AI Teacher limit. Please try again tomorrow.":
    "Você atingiu o limite de hoje do Professor de IA. Tente novamente amanhã.",
  "Your history": "Seu histórico",
  "Best position": "Melhor posição",
  "Join the league to see your position each week.":
    "Entre na liga para ver sua posição em cada semana.",
  "Try Premium free for": "Experimente o Premium grátis por",
  "Nothing is charged today. Cancel before the trial ends and you pay nothing.":
    "Nada é cobrado hoje. Cancele antes do fim do teste e você não paga nada.",
  "Start free trial": "Começar teste grátis",
  "Black Friday": "Black Friday",
  "BLACK FRIDAY WARM-UP IS NOW LIVE": "ESQUENTA BLACK FRIDAY JÁ ESTÁ NO AR",
  "Black Friday:": "Black Friday:",
  "off the monthly plan for": "de desconto no plano mensal por",
  "days free on the monthly plan": "dias grátis no plano mensal",
  "off for": "de desconto por",
  "months, then": "meses, depois",
  "Black Friday in": "Black Friday em",
  From: "A partir de",
  "days free on your first subscription": "dias grátis na sua primeira assinatura",
  "off Premium": "de desconto no Premium",
  "off Premium monthly for": "de desconto no Premium mensal por",
  months: "meses",
  for: "por",
  "days free": "dias grátis",
  Until: "Até",
  "After the trial,": "Depois do teste,",
  "Cancel any time in My subscription before the trial ends.":
    "Cancele quando quiser em Minha assinatura antes do fim do teste.",
  "Original text by EVO": "Texto original da EVO",
  "Send by email": "Enviar por e-mail",
  Source: "Fonte",
  Questions: "Perguntas",
  "Focus blocks with short breaks; use the breaks to practise English.":
    "Blocos de foco com pausas curtas; use as pausas para praticar inglês.",
  Break: "Pausa",
  Ready: "Pronto",
  "Block length": "Duração do bloco",
  "Task for this block": "Tarefa deste bloco",
  "No task": "Sem tarefa",
  "Start focus": "Iniciar foco",
  Resume: "Continuar",
  Pause: "Pausar",
  "Skip break": "Pular pausa",
  "Floating timer": "Cronômetro flutuante",
  "Focus timer": "Cronômetro de foco",
  Minimize: "Minimizar",
  Expand: "Expandir",
  "Open Focus in Life+ AI": "Abrir o Foco no Life+ AI",
  "Stopping keeps the minutes done; only a finished block counts as a 🍅.":
    "Parar guarda os minutos feitos; só o bloco completo conta como 🍅.",
  "min saved; a stopped block does not count as a 🍅.":
    "min salvos; um bloco interrompido não conta como 🍅.",
  "Did you finish this task?": "Você terminou esta tarefa?",
  "Two minutes of English in your break": "Dois minutos de inglês na sua pausa",
  "Review words": "Revisar palavras",
  "Good to have you back": "Que bom ter você de volta",
  "Continue with Google": "Continuar com Google",
  "or with your email": "ou com seu e-mail",
  "Your password": "Sua senha",
  "Create a password": "Crie uma senha",
  "EVO is ready for your next conversation.": "A EVO está pronta para a sua próxima conversa.",
  "30 core lessons in 5 units, plus a review unit":
    "30 lições principais em 5 unidades, mais uma unidade de revisão",
  "Each lesson: audio with EVO and Leo, summary, cards and quiz":
    "Cada lição: áudio com a EVO e o Leo, resumo, cartões e quiz",
  "The Final Test opens after 21 lessons; 70% moves you up":
    "O Teste Final abre depois de 21 lições; 70% sobe você de nível",
  "36 lessons in 6 units, written at your level": "36 lições em 6 unidades, escritas no seu nível",
  "Download each unit as a PDF workbook": "Baixe cada unidade como apostila em PDF",
  "Watch the level presentation": "Ver a apresentação do nível",
  "Hide video": "Esconder vídeo",
  "Optional: watch it whenever you like.": "Opcional: assista quando quiser.",
  "Level presentation": "Apresentação do nível",
  "Start here": "Comece aqui",
  "Welcome to": "Boas-vindas ao",
  "Delete 1 saved mistake? This cannot be undone.":
    "Apagar 1 erro salvo? Isso não pode ser desfeito.",
  "Delete {n} saved mistakes? This cannot be undone.":
    "Apagar {n} erros salvos? Isso não pode ser desfeito.",
  "1 mistake deleted.": "1 erro apagado.",
  "{n} mistakes deleted.": "{n} erros apagados.",
  "Could not delete these mistakes. Please try again.":
    "Não foi possível apagar esses erros. Tente de novo.",
  "Clear selection": "Limpar seleção",
  "Select all": "Selecionar todos",
  "Select to delete": "Selecionar para apagar",
  Select: "Selecionar",
  "See in Portuguese": "Ver em português",
  "Translating…": "Traduzindo…",
  "Review mistakes": "Revisar erros",
  "Focus this week": "Foco nesta semana",
  "in 7 days": "em 7 dias",
  "Focus block done! Time for a break.": "Bloco de foco concluído! Hora da pausa.",
  "Break over. Ready for the next focus block?": "Fim da pausa. Pronto para o próximo bloco de foco?",
  "Today’s reading is waiting": "A leitura de hoje está esperando",
  "Today's reading is waiting": "A leitura do dia está esperando",
  "Compare your options": "Compare suas opções",
  "Read another text": "Ler outro texto",
  "Fix them now so they do not become habits.": "Corrija agora para não virarem hábito.",
  "Nothing else pending right now.": "Nada mais pendente agora.",
  "Extra practice done for today": "Prática extra concluída hoje",
  "New options appear tomorrow.": "Novas opções aparecem amanhã.",
  "Nothing else to review right now.": "Nada mais para revisar agora.",
  "Business English": "Inglês para Negócios",
  "Meetings, e-mails, presentations, interviews, negotiation and networking, written at your level.":
    "Reuniões, e-mails, apresentações, entrevistas, negociação e networking, no seu nível.",
  "Business English opens at level B1.": "O Inglês para Negócios abre no nível B1.",
  "You are at": "Você está no",
  "Keep going in your learning path to unlock it.":
    "Continue sua trilha de aprendizado para desbloquear.",
  "Go to my learning path": "Ir para minha trilha",
  "Practise with EVO": "Pratique com a EVO",
  "Real work situations: EVO plays the other person.":
    "Situações reais de trabalho: a EVO faz o papel da outra pessoa.",
  Talk: "Conversar",
  Call: "Ligar",
  "The first lesson is free. Premium opens all 36 Business lessons.":
    "A primeira lição é grátis. O Premium libera as 36 lições de Negócios.",
  "Unit 1 — Meetings": "Unidade 1 — Reuniões",
  "Unit 2 — E-mails and Messages": "Unidade 2 — E-mails e mensagens",
  "Unit 3 — Presentations": "Unidade 3 — Apresentações",
  "Unit 4 — Job Interviews": "Unidade 4 — Entrevistas de emprego",
  "Unit 5 — Clients and Negotiation": "Unidade 5 — Clientes e negociação",
  "Unit 6 — Networking and Small Talk": "Unidade 6 — Networking e conversa informal",
  "Status meeting": "Reunião de status",
  "Client call": "Ligação com cliente",
  Negotiation: "Negociação",
  "Presentation Q&A": "Perguntas da apresentação",
  "Business English is part of Premium.": "O Inglês para Negócios faz parte do Premium.",
  "This lesson is not part of Business English.":
    "Esta lição não faz parte do Inglês para Negócios.",
  "Download all units (PDF)": "Baixar todas as unidades (PDF)",
  "Download PDF": "Baixar PDF",
  "Your PDF is downloading.": "Seu PDF está sendo baixado.",
  "Could not build the PDF. Please try again.": "Não foi possível gerar o PDF. Tente novamente.",
  BIZ: "BIZ",
  "All Business lessons completed": "Todas as lições de Negócios concluídas",
  "Open Business English": "Abrir Inglês para Negócios",
  Continuous: "Contínuo",
  "Today only: starts again tomorrow.": "Só de hoje: recomeça amanhã.",
  "Study by WhatsApp": "Estude pelo WhatsApp",
  "Connect your account to prepare for English practice with EVO on WhatsApp.":
    "Conecte sua conta para preparar a prática de inglês com a EVO pelo WhatsApp.",
  "WhatsApp connection": "Conexão com WhatsApp",
  "Your WhatsApp is connected.": "Seu WhatsApp está conectado.",
  "Connected number": "Número conectado",
  "The WhatsApp connection is not available yet. The official Meta setup is still being completed.":
    "A conexão com WhatsApp ainda não está disponível. A configuração oficial da Meta está sendo concluída.",
  "Generate connection code": "Gerar código de conexão",
  "Generating…": "Gerando…",
  "Send this code to the official Evoluir+ WhatsApp number:":
    "Envie este código para o número oficial do WhatsApp do Evoluir+:",
  "Code expires at": "O código expira às",
  "Copy code": "Copiar código",
  "Code copied.": "Código copiado.",
  "Could not generate a connection code. Please try again.":
    "Não foi possível gerar o código de conexão. Tente novamente.",
  "WhatsApp account linking is prepared, but English practice through WhatsApp is not active yet.":
    "A vinculação da conta ao WhatsApp está preparada, mas a prática de inglês pelo WhatsApp ainda não está ativa.",
  // Review podcast (owner request, 2026-10-26).
  Podcast: "Podcast",
  "Review podcast": "Podcast de revisão",
  "Listen again": "Ouvir de novo",
  "Play episode": "Ouvir episódio",
  "EVO and Leo are recording your episode…": "EVO e Leo estão gravando o seu episódio…",
  "The podcast could not be prepared right now. Read the summary below and continue the lesson.":
    "Não foi possível preparar o podcast agora. Leia o resumo abaixo e continue a lição.",
  "Listen to EVO and Leo review these units before you practise.":
    "Ouça EVO e Leo revisarem estas unidades antes de praticar.",
  "Tap a line to hear it again from there.":
    "Toque em uma fala para ouvi-la novamente a partir dali.",
  "Listen to the podcast": "Ouvir o podcast",
  "Audio could not be played": "Não foi possível reproduzir o áudio",
  "Your progress was not advanced. Press Continue to retry this line.":
    "Seu progresso não avançou. Pressione Continuar para tentar esta fala novamente.",
  Episode: "Episódio",
  "Watch the video": "Assistir ao vídeo",
  "Audio is not available for this lesson yet. You can watch the video in Summary.":
    "O áudio ainda não está disponível para esta lição. Você pode assistir ao vídeo no Resumo.",
  "A1 Unit 1 Lesson 3 — Introducing Yourself": "A1 Unidade 1, Lição 3 — Apresentando-se",
  "Business English Unit 1 Lesson 1 — Following a Status Meeting":
    "Business English Unidade 1, Lição 1 — Acompanhando uma reunião de status",
  "B1 Unit 2 Lesson 2 — Reading a Work Report":
    "B1 Unidade 2, Lição 2 — Leitura de um relatório de trabalho",
  "Pass the quiz (70%)": "Passar no quiz (70%)",
  "Loading saved songs...": "Carregando músicas salvas...",
  "Generated songs": "Músicas geradas",
  "My songs": "Minhas músicas",
  "Filter songs by Learning focus": "Filtrar músicas por foco de aprendizagem",
  "No songs for this Learning focus yet.":
    "Ainda não há músicas para este foco de aprendizagem.",
  "Built-in English translator": "Tradutor de inglês integrado",
  "Look up an English word or phrase and see its meaning in Portuguese without leaving Evoluir+.":
    "Pesquise uma palavra ou expressão em inglês e veja o significado em português sem sair do Evoluir+.",
  "Search in English": "Pesquisar em inglês",
  "Redo words": "Refazer palavras",
  "Enter an English word or phrase...": "Digite uma palavra ou expressão em inglês...",
  "Search in English with the built-in translator":
    "Pesquisar em inglês com o tradutor integrado",
  "Listening Experience • Music Lab": "Experiência de escuta • Laboratório de música",
  "Learn English through your own song": "Aprenda inglês com sua própria música",
  "EVO adapts the lyrics and language to your current level:":
    "A EVO adapta a letra e a linguagem ao seu nível atual:",
  ". You choose the topic and sound, not the CEFR level.":
    ". Você escolhe o tema e o estilo, não o nível CEFR.",
  "What should your song be about?": "Sobre o que deve ser sua música?",
  "e.g. travelling alone, new beginnings, everyday life":
    "ex.: viajar sozinho, novos começos, vida cotidiana",
  "Up to 80 characters. Keep it original and specific.":
    "Até 80 caracteres. Seja original e específico.",
  "Music style": "Estilo musical",
  "Music Lab is part of Premium.": "O Laboratório de música faz parte do Premium.",
  "Your song is already being created, or you made one in the last 24 hours. Please come back later for another track.":
    "Sua música já está sendo criada, ou você criou uma nas últimas 24 horas. Volte mais tarde para criar outra.",
  "You can create one song every 24 hours for now. Please come back later for another track.":
    "Por enquanto, você pode criar uma música a cada 24 horas. Volte mais tarde para criar outra.",
  "Learning focus": "Foco do aprendizado",
  "Creates an original 30-second English song with vocals and instrumental music.":
    "Cria uma música original em inglês de 30 segundos, com vocais e instrumental.",
  "Download song": "Baixar música",
  "Your browser does not support audio playback.":
    "Seu navegador não oferece suporte à reprodução de áudio.",
  "Recovery points": "Pontos de recuperação",
  Students: "Alunos",
  "AI and costs": "IA e custos",
  Content: "Conteúdo",
  Communication: "Comunicação",
  System: "Sistema",
  "Home images": "Imagens da Home",
  "Error monitoring": "Monitoramento de erros",
  "Lesson test": "Teste de lição",
  Lyrics: "Letra",
  // Premium extra videos (owner request, 2026-10-31).
  "Watch an extra video": "Assista a um vídeo extra",
  "Choose a video of your level": "Escolha um vídeo do seu nível",
  "Follow the main idea": "Acompanhe a ideia principal",
  "Write down two new words": "Anote duas palavras novas",
  Pick: "Escolha",
  Watch: "Assistir",
  Note: "Anote",
  "Just added": "Novidade",
  "Lessons on video, Premium": "Lições em vídeo, Premium",
  "New: extra lesson videos": "Novidade: vídeos extras das lições",
  "Extra lesson videos, by level": "Vídeos extras das lições, por nível",
  "Extra videos": "Vídeos extras",
  "Premium extras": "Extras Premium",
  "Extra lesson videos": "Vídeos extras das lições",
  "Short videos that go deeper into the lessons of your path.":
    "Vídeos curtos que aprofundam as lições da sua trilha.",
  "Extra videos are part of Premium. Subscribe to watch every one of them.":
    "Os vídeos extras fazem parte do Premium. Assine para assistir a todos.",
  Play: "Reproduzir",
  Like: "Curtir",
  Unlike: "Descurtir",
  Comments: "Comentários",
  "Loading...": "Carregando...",
  "Delete comment": "Excluir comentário",
  "Delete this comment?": "Excluir este comentário?",
  "Report comment": "Denunciar comentário",
  "Report this comment to the Evoluir+ team?":
    "Denunciar este comentário para a equipe do Evoluir+?",
  "Add a comment...": "Adicione um comentário...",
  Send: "Enviar",
  "No comments yet. Be the first to comment, in English if you can!":
    "Ainda não há comentários. Seja o primeiro a comentar, em inglês se puder!",
  "Others see your first name and initial. No links or contact details.":
    "Os outros alunos veem seu primeiro nome e a inicial. Sem links nem contatos.",
  "Thanks. The team will review this comment.": "Obrigado. A equipe vai revisar este comentário.",
  "Likes and comments are part of Premium.":
    "Curtidas e comentários fazem parte do Premium.",
  "This video is no longer available.": "Este vídeo não está mais disponível.",
  "Could not save your like. Please try again.":
    "Não foi possível salvar sua curtida. Tente novamente.",
  "Could not save your like.": "Não foi possível salvar sua curtida.",
  "Could not load the comments. Please try again.":
    "Não foi possível carregar os comentários. Tente novamente.",
  "Write a comment first.": "Escreva um comentário primeiro.",
  "Keep your comment under 500 characters.":
    "Seu comentário deve ter até 500 caracteres.",
  "Comments cannot have links.": "Comentários não podem ter links.",
  "Comments cannot have contact details.": "Comentários não podem ter contatos.",
  "You have commented a lot this hour. Please try again later.":
    "Você comentou bastante nesta hora. Tente novamente mais tarde.",
  "Could not post your comment. Please try again.":
    "Não foi possível publicar seu comentário. Tente novamente.",
  "Could not delete the comment. Please try again.":
    "Não foi possível excluir o comentário. Tente novamente.",
  "Could not send the report. Please try again.":
    "Não foi possível enviar a denúncia. Tente novamente.",
  Shorts: "Shorts",
  Reel: "Reel",
  "Video type": "Tipo de vídeo",
  "No shorts here yet. New ones are added over time.":
    "Ainda não há shorts aqui. Novos são adicionados com o tempo.",
  "No extra videos here yet. New ones are added over time.":
    "Ainda não há vídeos extras aqui. Novos vídeos chegam com o tempo.",
  "Close video": "Fechar vídeo",
  // Diamond celebration and cycles (owner decision, 2026-10-31).
  "days in a row. Another Diamond cycle is yours for good.":
    "dias seguidos. Mais um ciclo do Diamante é seu para sempre.",
  "63 days in a row: the last jewel is yours for good.":
    "63 dias seguidos: a última joia é sua para sempre.",
  "Look how far you have come. I am proud of you!":
    "Olha só quanto você já caminhou. Tenho orgulho de você!",
  "study days": "dias de estudo",
  "words learned": "palavras aprendidas",
  "Every 63 more days in a row adds another Diamond cycle.":
    "A cada mais 63 dias seguidos, você ganha mais um ciclo do Diamante.",
  // Learning and Focus completion notifications.
  "Focus block done!": "Bloco de foco concluído!",
  "Time for a break.": "Hora de fazer uma pausa.",
  "Break over.": "Pausa encerrada.",
  "Ready for the next focus block?": "Pronto para o próximo bloco de foco?",
  "Your score: {score}%": "Sua pontuação: {score}%",
  // Vocabulary review session and page (owner request, 2026-11-02).
  "Show meaning": "Mostrar significado",
  "Try to remember what it means, then check.":
    "Tente lembrar o que significa e depois confira.",
  "From reading": "Da leitura",
  "From lessons": "Das lições",
  "Back for review in": "Volta para revisão em",
  Skip: "Pular",
  Word: "Palavra",
  "Words you knew": "Palavras que você sabia",
  "Review done": "Revisão concluída",
  "Back to the list": "Voltar para a lista",
  "End review": "Encerrar revisão",
  "Review session": "Sessão de revisão",
  "Translate an English word...": "Traduza uma palavra em inglês...",
  "word to remember now": "palavra para lembrar agora",
  "words to remember now": "palavras para lembrar agora",
  "One word at a time: remember it, check the meaning, then rate it.":
    "Uma palavra por vez: lembre, confira o significado e avalie.",
  "Start review": "Começar revisão",
  "New words": "Palavras novas",
  "Done today": "Feitas hoje",
  "New words arrive with your next lesson.": "Palavras novas chegam com a sua próxima lição.",
  "Open your next lesson": "Abrir a próxima lição",
  "Search your words...": "Busque nas suas palavras...",
  Beat: "Supere",
  "Remember, check and say your words: ten new ones with every new lesson.":
    "Lembre, confira e fale suas palavras: dez novas a cada nova lição.",
  "Completed sessions": "Sessões concluídas",
  "Completion rate": "Taxa de conclusão",
  "Partial sessions": "Sessões parciais",
  "Recent focus sessions": "Sessões recentes de foco",
  "Life task": "Tarefa do Life+",
  "Independent focus": "Foco independente",
  "Stopped early": "Interrompida antes do fim",
  "How your score is calculated": "Como seu score é calculado",
  "English reflects your measured skill profile. Goals count active-goal steps over the last":
    "O Inglês reflete seu perfil de habilidades medido. Metas contam os passos das metas ativas nos últimos",
  "days, ending today.": "dias, até hoje.",
  "Measured English skills": "Habilidades de inglês medidas",
  "simple average": "média simples",
  "Completed steps in active goals": "Passos concluídos em metas ativas",
  "Both dimensions count equally: English × 50% + Goals × 50%.":
    "As duas dimensões têm o mesmo peso: Inglês × 50% + Metas × 50%.",
  "Only the measured dimension counts: 100% of the score.":
    "A única dimensão medida representa 100% do score.",
  "Your score appears when at least one dimension has valid data.":
    "Seu score aparece quando pelo menos uma dimensão tem dados válidos.",
  "Not measured": "Não medido",
  weight: "de peso",
  points: "pontos",
  "Evidence by skill": "Evidências por habilidade",
  "evidence items": "registros de evidência",
  "A skill needs at least 2 valid evidence items and an effective weight of at least 0.5 to be measured.":
    "Uma habilidade precisa de pelo menos 2 registros válidos e peso efetivo mínimo de 0,5 para ser medida.",
  "Effective weight is sample weight × evidence quality × source reliability. Evidence weight halves every 30 days for the skill score.":
    "O peso efetivo é peso da amostra × qualidade da evidência × confiabilidade da fonte. No score da habilidade, o peso da evidência cai pela metade a cada 30 dias.",
  "Reading uses daily reading evidence only; lesson quizzes are excluded.":
    "Reading considera apenas evidências da leitura diária; quizzes de lições não entram.",
  "Only steps from active goals dated within this 14-day window count. Future steps and archived goals are excluded.":
    "Contam apenas passos de metas ativas dentro desta janela de 14 dias. Passos futuros e metas arquivadas ficam de fora.",
  "score points": "pontos no score",
  "How activities affect your score": "Como as atividades afetam seu score",
  "An activity does not add points by itself. It can affect English when it creates valid assessment evidence; recent activity history also helps EVO choose what to practise next.":
    "Uma atividade não adiciona pontos por si só. Ela pode afetar o Inglês quando gera evidência válida de avaliação; o histórico recente também ajuda a EVO a escolher o que praticar em seguida.",
  "Your next recommended action": "Sua próxima ação recomendada",
  "Recent learning errors": "Erros recentes de aprendizagem",
  "More evidence is needed": "É preciso reunir mais evidências",
  "This is the lowest measured skill": "Esta é a habilidade medida com menor resultado",
  "Not practised in the last 7 days": "Não praticada nos últimos 7 dias",
  "Start building your learning evidence": "Comece a construir suas evidências de aprendizagem",
  "Build your first learning evidence": "Comece a gerar suas primeiras evidências de aprendizagem",
  "Open recommended practice": "Abrir prática recomendada",
};

// The app guide's lines live in their own file; the app's own terms win on a clash.
export const uiPt: Record<string, string> = {
  ...appGuidePt,
  ...baseUiPt,
  "Good morning": "Bom dia",
  "Good afternoon": "Boa tarde",
  "Good evening": "Boa noite",
  "Morning briefing": "Resumo do dia",
  "You completed everything planned for today.": "Você concluiu tudo o que planejou para hoje.",
  "You have {done} of {total} planned items completed.":
    "Você concluiu {done} de {total} itens planejados.",
  "Focus today": "Foco hoje",
  "Download Life+ AI manual": "Baixar manual do Life+ AI",
  "🇧🇷 PT": "🇧🇷 PT",
  "🇺🇸 EN": "🇺🇸 EN",
};
