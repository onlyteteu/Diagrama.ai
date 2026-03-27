"use client";

import React, { useState, useEffect, useRef } from 'react';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

type ToastType = { id: number; text: string; type: 'success' | 'error' | 'info'; closing?: boolean };

export default function Home() {
  const [userPrompt, setUserPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Gerar Diagrama Inteligente');
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [toasts, setToasts] = useState<ToastType[]>([]);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const toastCounter = useRef(0);

  useEffect(() => {
    if (canvasRef.current && !viewerRef.current) {
        viewerRef.current = new NavigatedViewer({
            container: canvasRef.current,
            width: '100%',
            height: '100%'
        });
    }
  }, []);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = ++toastCounter.current;
    setToasts(prev => [...prev, { id, text, type }]);
    
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, closing: true } : t));
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 300);
    }, 4500);
  };

  const setShortcut = (text: string) => {
      setUserPrompt(text);
  };

  const handleDynamicLoading = (stage: number) => {
    if (stage === 1) setLoadingText('Analisando o Escopo...');
    if (stage === 2) setLoadingText('Estruturando Lógica IA...');
    if (stage === 3) setLoadingText('Renderizando BPMN...');
    if (stage === 4) setLoadingText('Gerar Diagrama Inteligente');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPrompt || userPrompt.trim() === '') return showToast('Descreva o seu processo primeiro!', 'error');
    
    setLoading(true);
    handleDynamicLoading(1);
    showToast('Iniciando análise do prompt com IA...', 'info');

    try {
      setTimeout(() => handleDynamicLoading(2), 2000);

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPrompt })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha na resposta do servidor');

      handleDynamicLoading(3);
      showToast('Aplicando Auto-Layout de Interface...', 'info');
      
      await viewerRef.current.importXML(data.xml);
      viewerRef.current.get('canvas').zoom('fit-viewport', 'auto');
      
      showToast('Diagrama Gerado com Sucesso!', 'success');
      const placeholder = document.getElementById('canvas-placeholder');
      if (placeholder) placeholder.style.opacity = '0';
      
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Erro crítico ao estruturar BPMN.', 'error');
    } finally {
      handleDynamicLoading(4);
      setLoading(false);
    }
  };

  const handleZoom = (step: number) => viewerRef.current?.get('zoomScroll')?.stepZoom(step);
  const resetZoom = () => viewerRef.current?.get('canvas').zoom('fit-viewport', 'auto');

  const handleDownload = async () => {
      try {
          const { svg } = await viewerRef.current.saveSVG();
          const blob = new Blob([svg], { type: 'image/svg+xml' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'diagrama.svg';
          a.click();
          showToast('Descarregado em SVG perfeitamente!', 'success');
      } catch (err) {
          showToast('Nenhum diagrama na tela para exportar.', 'error');
      }
  };

  const handleExportPDF = async () => {
      try {
          const { jsPDF } = await import('jspdf');
          const html2canvas = (await import('html2canvas')).default;
          
          const canvasEl = document.querySelector('.bjs-container') as HTMLElement;
          if (!canvasEl) throw new Error('Container');

          showToast('Capturando layout HD para Fotografia...', 'info');
          viewerRef.current?.get('canvas').zoom('fit-viewport', 'auto');
          await new Promise(r => setTimeout(r, 600));

          const canvas = await html2canvas(canvasEl, {
              backgroundColor: '#0B0E14',
              scale: 2,
              logging: false,
          });

          const imgData = canvas.toDataURL('image/jpeg', 1.0);
          const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          const imgRatio = canvas.width / canvas.height;
          const pdfRatio = pdfWidth / pdfHeight;
          
          let renderW = pdfWidth;
          let renderH = pdfWidth / imgRatio;
          if (imgRatio < pdfRatio) {
              renderH = pdfHeight;
              renderW = pdfHeight * imgRatio;
          }
          
          const x = (pdfWidth - renderW) / 2;
          const y = (pdfHeight - renderH) / 2;

          pdf.setFillColor('#0B0E14');
          pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');

          pdf.addImage(imgData, 'JPEG', x, y, renderW, renderH);
          pdf.save('diagrama-premium.pdf');

          showToast('PDF Premium gerado com sucesso!', 'success');
      } catch (err) {
          showToast('Erro ao processar imagem para PDF.', 'error');
      }
  };

  return (
    <div className={`app-container ${isFullscreen ? 'fullscreen' : ''}`}>
      
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type} ${t.closing ? 'closing' : ''}`}>
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
        <header>
          <div className="logo-container">
            <svg className="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
            <h1>diagrama<span>.ai</span></h1>
          </div>
          <p>O seu cérebro visual movido por Inteligência Artificial em tempo real.</p>
        </header>

        <form onSubmit={handleSubmit}>
          
          <div className="quick-prompts">
             <span className="chip" onClick={() => setShortcut("Processo de Contratação RH: O candidato envia o currículo, o RH tria a vaga. Decisão: Aprovado para Mapeamento? Se não, envia email de dispensa. Se sim, Agenda entrevista técnica. Em seguida o time técnico avalia, e se OK, o RH realiza a Proposta Final.")}>🌟 RH Básico</span>
             <span className="chip" onClick={() => setShortcut("Logística de Entrega: Cliente compra no site. Sistema confirma o pagamento. Se rejeitado, cancela o fluxo. Se aceito, o robô movimenta peça, o CD embala e entrega à transportadora que rastreia até o destino e encerra.")}>📦 Logística E-com</span>
             <span className="chip" onClick={() => setShortcut("Chamado TI: O Usuário abre o ticket. O Nível 1 faz triagem. Gateway de decisão: É problema de hardware? Se sim, manda pro Financeiro comprar peça. Se não, o Nível 2 assume e resolve via acesso remoto.")}>💽 Chamado TI</span>
          </div>

          <div className="form-group">
            <label style={{ color: '#F8FAFC', marginBottom: '12px' }}>O que você deseja mapear?</label>
            <textarea 
               rows={10} 
               value={userPrompt} 
               onChange={e => setUserPrompt(e.target.value)} 
               required 
               placeholder="Escreva livremente como se estivesse conversando com uma IA. Você não precisa citar títulos nem separar osatores, apenas relate o processo de negócios do início ao fim..." 
               style={{ height: '300px' }}
            />
          </div>

          <button type="submit" className="generate-btn" disabled={loading}>
            <div className="btn-content">
              {loading && <div className="loader"></div>}
              <span>{loadingText}</span>
            </div>
          </button>
        </form>

        <div className="sidebar-footer" style={{ marginTop: 'auto', paddingTop: '32px' }}>
          <div className="info-card" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.1)', padding: '16px', borderRadius: '12px', fontSize: '13px', color: '#94a3b8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#F8FAFC', fontWeight: 600 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
              SaaS de Arquitetura Limpa
            </div>
            O <strong>Diagrama.ai</strong> preserva seus segredos corporativos encapsulando seu Prompt localmente numa ponte direta com o <i>Large Language Model</i> de sua escolha, e convertendo a matemática nodal 100% no seu navegador usando canvas virtual.
          </div>
          
          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: '#64748B', fontWeight: 500, letterSpacing: '0.5px' }}>
            ⚡ POWERED BY GEMINI AI & BPMN-JS
          </div>
        </div>
      </aside>

      <main className="canvas-container">
        <div ref={canvasRef} id="bpmn-canvas"></div>
        
        <div className="canvas-placeholder" id="canvas-placeholder">
          <div style={{ padding: '20px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '50%', marginBottom: '24px', color: '#6366F1' }}>
             <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0z"></path><path d="M2 22l3.3-3.3"></path><path d="M14 6l4 4"></path></svg>
          </div>
          <h2>Conceba seu Design System</h2>
          <p>Descreva o processo como numa conversa, clique nos botões rápidos de exemplo ou deixe o Módulo Lógico Inteligente modelar o espaço automaticamente na sua tela.</p>
        </div>

        <div className="canvas-controls">
          <button onClick={() => setIsFullscreen(!isFullscreen)} title="Modo Telão" style={{ marginRight: '8px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
          </button>
          
          <button onClick={() => handleZoom(1)} title="Aproximar">+</button>
          <button onClick={() => handleZoom(-1)} title="Distanciar">-</button>
          <button onClick={resetZoom} title="Resetar Câmera">[ ]</button>
          <button onClick={handleDownload} className="text-btn">Exportar SVG</button>
          <button onClick={handleExportPDF} className="text-btn" style={{ marginLeft: '8px', color: '#6366F1', fontWeight: 600, border: '1px solid rgba(99,102,241,0.3)', padding: '4px 12px', borderRadius: '12px' }}>Exportar PDF ✦</button>
        </div>
      </main>
    </div>
  );
}
