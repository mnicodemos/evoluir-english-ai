import { jsPDF } from "jspdf";

import { createWorkbook } from "@/lib/pdfWorkbook";
import { loadLogo } from "@/lib/pdfTheme";
import { savePdf } from "@/lib/pdfDownload";

type GuideSection = {
  title: string;
  intro: string;
  topics: { heading: string; paragraphs?: string[]; bullets?: string[] }[];
  note?: string;
};

const SECTIONS: GuideSection[] = [
  {
    title: "O Life+ AI e seu dia",
    intro:
      "O Life+ AI conecta objetivos pessoais e profissionais a pequenas ações diárias. Ele ajuda a organizar a rotina, construir hábitos e tomar decisões com mais clareza, mantendo o inglês presente no seu caminho.",
    topics: [
      {
        heading: "Your Day — resumo diário",
        bullets: [
          "O anel combina passos de metas concluídos, tarefas de rotina de hoje e hábitos que vencem no dia.",
          "Ao atingir 100%, o aplicativo apresenta uma celebração visual e, em celulares compatíveis, retorno tátil.",
        ],
      },
      {
        heading: "Evolution Score — Score de Evolução",
        paragraphs: [
          "Combina duas dimensões com pesos iguais: 50% evidências de proficiência em inglês e 50% execução de passos de vida nos últimos 14 dias. É uma visão integrada e não substitui os indicadores detalhados de cada área.",
        ],
        bullets: [
          "50% Inglês: evidências de Listening, Speaking, Reading, Writing e Grammar.",
          "50% Vida: percentual de micro-passos das metas concluídos nos últimos 14 dias.",
        ],
      },
    ],
    note: "Suas metas dão propósito ao aprendizado; o inglês oferece uma ferramenta para alcançar oportunidades reais.",
  },
  {
    title: "Metas e micro-passos da EVO",
    intro:
      "Metas representam objetivos pessoais ou profissionais: mudar de carreira, preparar uma apresentação, conquistar uma promoção, morar fora ou desenvolver confiança para falar em público.",
    topics: [
      {
        heading: "Como usar suas metas",
        bullets: [
          "Cadastre de 1 a 3 metas ativas.",
          "Descreva o resultado desejado e defina um prazo.",
          "Organize o caminho em marcos intermediários (milestones), quando fizer sentido.",
          "Consulte o micro-passo diário sugerido pela EVO e marque-o como concluído depois de realizar a ação.",
          "Revise a meta e seus marcos quando sua realidade mudar.",
        ],
      },
      {
        heading: "Praticar inglês a partir de uma meta real",
        paragraphs: [
          "Quando disponível, use Praticar agora para iniciar uma simulação oral ligada à meta. A EVO pode assumir o papel de colega, gestor, cliente ou entrevistador e adaptar a conversa ao nível CEFR do estudante.",
        ],
      },
    ],
    note: "Exemplo: “Apresentar uma proposta comercial” pode virar uma simulação de reunião com um cliente internacional.",
  },
  {
    title: "Rotina e tarefas",
    intro:
      "As tarefas transformam o plano em compromissos concretos. Podem ser ligadas a uma meta ou usadas de forma independente.",
    topics: [
      {
        heading: "Criar e organizar tarefas",
        bullets: [
          "Adicione uma tarefa para hoje ou escolha uma data futura.",
          "Defina a prioridade: alta, média ou baixa.",
          "Se desejar, associe a tarefa a uma meta cadastrada.",
          "Marque como concluída quando terminar; edite texto, prioridade ou vínculo quando necessário.",
        ],
      },
      {
        heading: "Navegar pelas datas",
        paragraphs: [
          "É possível consultar dias anteriores (até uma semana) e planejar tarefas futuras (até um mês à frente). Distribua os compromissos para evitar concentrar tudo em um único dia.",
        ],
      },
      {
        heading: "Como escolher a prioridade",
        bullets: [
          "Alta: prazo próximo, impacto relevante ou bloqueia outra atividade.",
          "Média: importante, mas pode ser organizada ao longo da semana.",
          "Baixa: útil, porém pode esperar se o dia ficar cheio.",
        ],
      },
    ],
    note: "Planeje um volume realista. Uma lista curta concluída costuma ser mais útil do que uma lista extensa.",
  },
  {
    title: "Hábitos inteligentes",
    intro:
      "Hábitos são ações recorrentes que você deseja tornar parte da rotina. Configure a frequência de acordo com o comportamento que pretende construir.",
    topics: [
      {
        heading: "Frequências disponíveis",
        bullets: [
          "Diário: todos os dias.",
          "Dias úteis: de segunda a sexta.",
          "N vezes por semana: escolha uma quantidade semanal.",
        ],
      },
      {
        heading: "Check-ins e histórico",
        paragraphs: [
          "Use o painel dos últimos sete dias para registrar o que foi realizado. Quando disponível, você pode corrigir um check-in anterior marcando ou desmarcando o dia correspondente.",
        ],
      },
      {
        heading: "Hábito conectado ao inglês",
        paragraphs: [
          "O hábito especial study_day pode ser vinculado ao registro oficial de estudo. Nesse caso, é atualizado automaticamente quando o sistema reconhece uma atividade válida de inglês. Não precisa ser marcado manualmente.",
        ],
      },
    ],
    note: "Vincule “Manter contato diário com o inglês” ao dia de estudo para evitar registrar duas vezes a mesma atividade.",
  },
  {
    title: "Life Coach com IA",
    intro:
      "O Life Coach é um espaço de orientação pessoal e profissional. Você pode conversar sobre objetivos, prioridades, organização e próximos passos. A IA considera o contexto disponível no Life+ AI.",
    topics: [
      {
        heading: "Como aproveitar melhor",
        bullets: [
          "Explique o contexto e o resultado que deseja alcançar.",
          "Peça um plano simples, uma forma de priorizar ou alternativas para sair de um bloqueio.",
          "Informe prazos, restrições e recursos disponíveis.",
          "Avalie as sugestões e escolha apenas as que fazem sentido para você.",
        ],
      },
      {
        heading: "Action Chips — transformar sugestão em ação",
        paragraphs: [
          "Ao final de algumas respostas, a EVO pode apresentar até três ações práticas. Conforme a sugestão e os recursos disponíveis, um toque pode transformar a ideia em tarefa, hábito ou marco de uma meta.",
        ],
      },
      {
        heading: "Compartilhar",
        paragraphs: [
          "Quando disponível, use copiar ou compartilhar para enviar o conteúdo, inclusive pelo WhatsApp. Revise a mensagem antes de encaminhá-la e evite compartilhar informações confidenciais.",
        ],
      },
    ],
    note: "A EVO apoia sua reflexão; a responsabilidade pelas escolhas permanece com você.",
  },
  {
    title: "Matriz de decisões ponderadas",
    intro:
      "A área Decisões ajuda a comparar alternativas quando há vários fatores envolvidos. Você explicita opções, critérios e pesos antes de avaliar.",
    topics: [
      {
        heading: "Montar uma matriz",
        bullets: [
          "Descreva a decisão que precisa tomar.",
          "Cadastre de 2 a 6 opções.",
          "Defina de 1 a 8 critérios relevantes, atribuindo peso de 1 a 5.",
          "Dê uma nota de 1 a 10 para cada combinação de opção e critério.",
        ],
      },
      {
        heading: "Entender o resultado",
        paragraphs: [
          "O sistema calcula uma média ponderada para cada opção. Altere o peso dos critérios e use a simulação “E se?” para observar como o resultado muda quando suas prioridades mudam.",
        ],
      },
      {
        heading: "Análise da EVO",
        paragraphs: [
          "A EVO pode apontar pontos cegos, tensões entre critérios e perguntas para reflexão. A análise é apoio — não uma ordem nem uma decisão automática. Se uma alternativa fizer sentido, você pode convertê-la em meta.",
        ],
      },
    ],
    note: "Não use a pontuação como verdade absoluta. Confira se opções e critérios representam o que realmente importa para você.",
  },
  {
    title: "Foco e meditações em inglês",
    intro:
      "Foco e meditações ajudam a organizar a atenção, fazer pausas e manter contato com o idioma.",
    topics: [
      {
        heading: "Foco — temporizador Pomodoro",
        bullets: [
          "Curto: 15 minutos de foco e 3 minutos de pausa.",
          "Padrão: 25 minutos de foco e 5 minutos de pausa.",
          "Longo: 50 minutos de foco e 10 minutos de pausa.",
          "Depois de quatro blocos, o ciclo prevê uma pausa longa.",
          "O temporizador pode continuar acompanhado enquanto você navega por outras páginas; o estado é mantido localmente no navegador.",
          "O widget flutuante pode ser movido para não atrapalhar o uso do aplicativo.",
          "Durante a pausa, aproveite uma sugestão de dois minutos de inglês: revisar palavras, ouvir um trecho ou fazer uma meditação curta.",
        ],
      },
      {
        heading: "Meditações em inglês",
        paragraphs: [
          "Escolha uma sessão curta narrada pela EVO: respiração calma, foco antes de estudar, gratidão, relaxamento antes de dormir ou pausa de dois minutos. A experiência pode incluir transcrição acompanhada, tradução sob demanda e vocabulário-chave.",
          "Quando registrados como atividade de meditação, os minutos ouvidos podem contribuir para o acompanhamento do tempo e para o treino de Listening. Confira o registro no Dashboard.",
        ],
      },
    ],
    note: "Ajuste o bloco de foco à sua energia. O objetivo é criar ritmo sustentável, não cumprir o maior tempo possível.",
  },
  {
    title: "Integração com o Dashboard e o inglês",
    intro:
      "O Dashboard resume partes do Life+ AI para você consultar o essencial sem abrir o módulo completo. Os atalhos e slots podem variar conforme plano, data e itens disponíveis.",
    topics: [
      {
        heading: "O que aparece no Dashboard",
        bullets: [
          "Passo da meta: micro-passo do dia, com acesso para consultar detalhes ou concluir.",
          "Tarefa do dia: tarefa mais urgente, com prioridade e opção de marcar como feita.",
          "Hábito do dia: hábito previsto para hoje e seu acompanhamento de sequência.",
          "Em telas amplas, um slot inteligente pode exibir uma decisão recente ou o bloco de Foco, conforme o contexto.",
        ],
      },
      {
        heading: "Sete conexões entre vida e inglês",
        bullets: [
          "Ofensiva compartilhada: a conclusão dos micro-passos pode contar como dia de estudo conforme as regras do aplicativo, refletindo no streak e nas conquistas associadas.",
          "Speaking contextual: uma meta pode iniciar uma simulação oral relacionada ao seu objetivo e ao seu nível CEFR.",
          "Hábito automático: o vínculo study_day consulta o registro oficial e evita check-in duplicado.",
          "Score integrado: reúne evidências de inglês e execução recente das metas pessoais.",
          "Pausas produtivas: o Foco pode sugerir vocabulário, Listening ou meditação nos intervalos.",
          "Meditação: sessões em inglês apoiam compreensão auditiva e familiaridade com a pronúncia.",
          "Lembretes cruzados: notificações podem considerar o que falta no estudo e na rotina.",
        ],
      },
    ],
  },
  {
    title: "Free, Premium e primeiros passos",
    intro:
      "A disponibilidade depende do plano ativo. Esta é a divisão de recursos descrita para o Life+ AI; consulte sua página de assinatura para confirmar as condições atuais.",
    topics: [
      {
        heading: "Recursos Free",
        bullets: [
          "Metas e micro-passos da EVO.",
          "Foco Pomodoro.",
          "Meditação Respiração Calma.",
        ],
      },
      {
        heading: "Recursos Premium",
        bullets: [
          "Rotina de tarefas completa.",
          "Hábitos com acompanhamento de sequências.",
          "Life Coach interativo.",
          "Matriz de Decisões.",
          "Meditações guiadas avançadas.",
        ],
      },
      {
        heading: "Um roteiro simples para começar",
        bullets: [
          "Hoje: cadastre uma meta importante e conclua o primeiro micro-passo da EVO.",
          "Hoje: organize uma tarefa prioritária e escolha um bloco de Foco adequado.",
          "Esta semana: defina um hábito simples e uma frequência realista.",
          "Quando surgir uma dúvida: converse com o Life Coach e transforme uma sugestão útil em ação.",
          "Quando houver uma escolha difícil: monte uma matriz com opções e critérios antes de decidir.",
        ],
      },
      {
        heading: "Boas práticas",
        bullets: [
          "Você não precisa usar todos os recursos; escolha os que apoiam sua rotina agora.",
          "Se perder um dia, retome no próximo com uma ação pequena, sem tentar compensar tudo de uma vez.",
          "Evite inserir senhas, dados bancários, documentos pessoais ou informações confidenciais de terceiros em metas, tarefas ou conversas.",
          "A EVO organiza informações e sugere ações; você avalia as sugestões e toma suas decisões.",
        ],
      },
    ],
    note: "Seu próximo passo: abra Life+ AI, escolha uma meta e transforme-a em uma ação pequena que consiga realizar hoje.",
  },
];

export async function downloadLifeGuidePdf() {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const logo = await loadLogo();
  const book = createWorkbook(doc, logo, {
    brand: "Evoluir+ English AI",
    levelLabel: "Life+ AI · Manual do usuário",
    docTitle: "Manual Life+ AI",
  });

  book.cover({
    title: "Manual do usuário — Life+ AI",
    subtitle:
      "Metas, rotina, hábitos, foco e decisões conectados ao seu desenvolvimento pessoal e profissional.",
    footnote: "Evoluir+ English AI · Mais que inglês",
  });
  book.newPage();

  book.heading("Bem-vindo ao Life+ AI");
  book.para(
    "O Life+ AI conecta o que você quer conquistar na vida e na carreira com pequenas ações diárias. Ele ajuda a transformar objetivos em passos possíveis, organizar a rotina, construir hábitos e tomar decisões com mais clareza — enquanto mantém o inglês presente no seu caminho.",
  );
  book.note(
    "A ideia central",
    "Suas metas dão propósito ao aprendizado; o inglês oferece uma ferramenta para alcançar oportunidades reais.",
  );

  SECTIONS.forEach((section, index) => {
    book.divider(`${String(index + 1).padStart(2, "0")} · ${section.title}`);
    book.para(section.intro);
    section.topics.forEach((topic) => {
      book.heading(topic.heading);
      topic.paragraphs?.forEach((paragraph) => book.para(paragraph));
      topic.bullets?.forEach((bullet) => book.bullet(bullet));
    });
    if (section.note) book.note("Dica prática", section.note);
  });

  book.finish();
  return savePdf(doc, "Evoluir_Manual_Life_AI.pdf");
}
