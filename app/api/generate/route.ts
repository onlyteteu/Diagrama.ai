import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { userPrompt } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'COLE_SUA_CHAVE_AQUI') {
        return NextResponse.json({ error: 'Chave Gemini não configurada no servidor (.env.local)' }, { status: 400 });
    }
    if (!userPrompt) return NextResponse.json({ error: 'Escreva um prompt válido.' }, { status: 400 });

    const AutoLayoutModule = await import('bpmn-auto-layout');
    const layoutProcess = AutoLayoutModule.layoutProcess || (AutoLayoutModule.default && AutoLayoutModule.default.layoutProcess);

    if (typeof layoutProcess !== 'function') {
        throw new Error("Não encontrei a função layoutProcess na biblioteca.");
    }

    const prompt = `
Você é um especialista em Processos de Negócio. Sua tarefa é criar um diagrama XML BPMN 2.0 (SEM MARCAÇÕES VISUAIS/DIAGRAMA). Apenas a semântica: <bpmn:definitions>, <bpmn:process>, <bpmn:startEvent>, <bpmn:task>, <bpmn:sequenceFlow>.

DESCRIÇÃO DO USUÁRIO: ${userPrompt}

Regras ABSOLUTAS:
0. Identifique silenciosamente o Processo/Título e os Atores com base no texto acima antes de construir.
1. Comece exatamente com <?xml e termine em </bpmn:definitions>. Não use markdown (ex: \`\`\`xml).
2. Não gere nenhuma tag <bpmndi:BPMNDiagram> ou posições matemáticas x/y! Quero APENAS o lógico. Apenas o <bpmn:process> com os fluxos fechados de ida e volta.
3. Se o processo acabar, use sempre um <bpmn:endEvent>. 
4. NOME DAS TAREFAS CURTOS E DIRETOS: Este é o maior segredo para o gráfico ficar bonito. Use no máximo 4 palavras. (Ex: Ao invés de "O Setor de Recursos Humanos avalia a pessoa", use "Avaliar Candidato"). Nomes grandes "bagunçam" as caixas, resuma as ações rigidamente.
5. Atribua 'id' e 'name' para todas as tarefas. Assuma apenas 1 Process, sem colaborações complexas.
`;

    const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!modelsRes.ok) throw new Error("Falha ao validar a sua Chave de API da Google.");
    
    const modelsData = await modelsRes.json();
    const supportedModels = modelsData.models.filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'));
    
    let chosenModel = '';
    const preferred = ['models/gemini-2.5-flash', 'models/gemini-1.5-flash', 'models/gemini-1.5-pro', 'models/gemini-pro'];
    for (const p of preferred) {
        if (supportedModels.some((m: any) => m.name === p)) {
            chosenModel = p;
            break;
        }
    }
    if (!chosenModel && supportedModels.length > 0) chosenModel = supportedModels[0].name;
    
    if (!chosenModel) {
        return NextResponse.json({ error: "Sua chave não tem acesso a nenhum modelo de IA suportado." }, { status: 400 });
    }

    const modelResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${chosenModel}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1 }
        })
    });

    if (!modelResponse.ok) {
        const err = await modelResponse.json();
        return NextResponse.json({ error: err.error?.message || 'Erro na API Gemini' }, { status: 500 });
    }

    const aiData = await modelResponse.json();
    let pureXML = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    pureXML = pureXML.replace(/^```(xml|bpmn)?\s*/i, '').replace(/\s*```$/i, '').trim();

    // The Magic! Pass SEMANTIC XML into AutoLayout.
    // AutoLayout computes X and Y bounds, inserting the visual <bpmndi:BPMNDiagram> automatically.
    const layoutedXML = await layoutProcess(pureXML);

    return NextResponse.json({ xml: layoutedXML });
  } catch (error: any) {
    console.error('Server error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
