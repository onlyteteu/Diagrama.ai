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
Você é uma Inteligência Artificial especialista em BPMN 2.0. Sua única tarefa é ler o texto do usuário e traduzi-lo em puro código semântico XML BPMN.
É CRÍTICO QUE TODAS AS TAREFAS ESTEJAM INTERLIGADAS! Se não houver tags <bpmn:sequenceFlow> ligando as caixas entre si, o motor falhará.

DESCRIÇÃO DO USUÁRIO: ${userPrompt}

Regras ABSOLUTAS E FATAIS:
1. Comece o texto exatamente com <?xml ... e termine com </bpmn:definitions>.
2. NÃO gere nenhuma tag de coordenadas virtuais como <bpmndi:BPMNDiagram>! Gere APENAS a lógica e a semântica de <bpmn:process>.
3. OBRIGATÓRIO: CADA CAIXA (Task) E EVENTO (Start/End/Gateway) DEVE ESTAR CONECTADO! Você deve OBRIGATORIAMENTE criar as tags de conexão no fim do arquivo: <bpmn:sequenceFlow id="..." sourceRef="NÓ_ORIGEM" targetRef="NÓ_DESTINO" />. Nunca deixe uma caixa flutuando sozinha sem um Flow de entrada e saída!
4. PADRÃO DO NOME DAS TAREFAS (ATORES): Para separar visualmente "Quem" faz "O Que", você deve OBRIGATORIAMENTE prefixar o nome da tarefa com o Setor/Pessoa responsável entre colchetes. Exemplo: "[RH] Avaliar Currículo", "[Cliente] Pagar Boleto", "[Sistema] Gerar Nota". Use no máximo 4 a 5 palavras no total!
5. Crie IDs simples e claros (ex: id="Gateway_Pagamento"). Use <bpmn:exclusiveGateway> se houver decisões! 
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
