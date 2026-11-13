import { ArrowRight, ExternalLink, Send, Sparkles, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { queryBoraIa, type BoraIaMatch } from '../services/boraIaService';
import type { Restaurant } from '../types/restaurant';

interface ConciergeWidgetProps {
  experiences: Restaurant[];
  externalPrompt?: string | null;
  onConsumeExternalPrompt?: () => void;
  onSendToPlanner?: (promptText: string) => void;
  onSelectExperience: (item: Restaurant) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  matches?: BoraIaMatch[];
  originQuery?: string;
}

const QUICK_PROMPTS = [
  'Onde jantar hoje em Botafogo até R$ 250 para casal?',
  'O que fazer com crianças neste fim de semana?',
  'Lugares com música ao vivo sem fila',
];

export function ConciergeWidget({
  experiences,
  externalPrompt,
  onConsumeExternalPrompt,
  onSendToPlanner,
  onSelectExperience,
}: ConciergeWidgetProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'Olá! Sou a Bora IA. Cruzo o catálogo real do BoraRio, o seu Cofre de Intenções, indicações autorizadas da sua Rede Confia e o clima do Rio agora. O que você quer viver?',
    },
  ]);

  const sendPrompt = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await queryBoraIa(trimmed, experiences, {
        includeVault: true,
        includeConfia: true,
        includeClub: true,
      });

      const botMsg: ChatMessage = {
        id: `b-${Date.now() + 1}`,
        sender: 'bot',
        text: res.answer,
        matches: res.matches,
        originQuery: trimmed,
      };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (externalPrompt && externalPrompt.trim()) {
      setOpen(true);
      void sendPrompt(externalPrompt);
      onConsumeExternalPrompt?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalPrompt]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendPrompt(input);
  };

  const whatsappText = encodeURIComponent(
    'Olá Bora IA Concierge! Gostaria de continuar meu atendimento pelo WhatsApp.'
  );

  return (
    <>
      {/* Floating Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="fixed bottom-20 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-4 py-3 text-xs font-bold text-white shadow-xl shadow-[#FF4B2B]/30 transition-transform hover:scale-105 lg:bottom-6 lg:right-6"
      >
        <Sparkles className="h-4 w-4" />
        <span>Bora IA</span>
      </button>

      {/* Bora IA Chat Window */}
      {open && (
        <div className="fixed bottom-36 right-4 z-50 flex h-[480px] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] shadow-2xl lg:bottom-20 lg:right-6">
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-[#123B56] via-[#102F46] to-[#FF6B35] px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                <Sparkles className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold leading-tight">Bora IA Concierge</p>
                <p className="text-[11px] text-[#F1E8D8]">
                  Catálogo + Cofre + Rede Confia + Clima
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar Bora IA"
              className="rounded-full p-1 text-white/80 hover:bg-white/10"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto bg-[#ECE5DD] p-3.5 dark:bg-[#0B141A]">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-xs ${
                    m.sender === 'user'
                      ? 'bg-[#DCF8C6] text-[#111B21] dark:bg-[#005C4B] dark:text-white'
                      : 'bg-white text-[#111B21] dark:bg-[#202C33] dark:text-[#E9EDEF]'
                  }`}
                >
                  {m.text}
                </div>

                {m.matches && m.matches.length > 0 && (
                  <div className="mt-2 w-full space-y-2">
                    {m.matches.map((match) => (
                      <div
                        key={match.venue.id}
                        onClick={() => {
                          onSelectExperience(match.venue);
                          setOpen(false);
                        }}
                        className="cursor-pointer rounded-xl border border-black/10 bg-white p-2.5 shadow-xs transition-colors hover:border-[#FF6B35] dark:border-white/10 dark:bg-[#202C33]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <strong className="text-xs text-[#111B21] dark:text-white">
                            {match.venue.name}
                          </strong>
                          <span className="rounded bg-[#FF6B35]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#FF6B35]">
                            {match.venue.attributes?.is_free ? 'Gratuito' : match.venue.price_range}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-neutral-600 dark:text-neutral-300">
                          {match.venue.neighborhood} · {match.venue.macro_category || match.venue.category}
                        </p>
                        <p className="mt-1 text-[10px] font-semibold text-[#397B68] dark:text-[#4CA188]">
                          Origem: {match.reasonTag} →
                        </p>
                      </div>
                    ))}

                    {onSendToPlanner && m.originQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          onSendToPlanner(m.originQuery || '');
                          setOpen(false);
                        }}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#123B56] py-2 text-[11px] font-bold text-white hover:bg-[#102F46]"
                      >
                        Montar roteiro completo com esta intenção
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
                Consultando fontes do BoraRio...
              </div>
            )}
          </div>

          {/* Quick Prompts */}
          <div className="flex gap-1.5 overflow-x-auto border-t border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 no-scrollbar">
            {QUICK_PROMPTS.map((qp) => (
              <button
                key={qp}
                type="button"
                onClick={() => void sendPrompt(qp)}
                className="shrink-0 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)] hover:border-[#25D366] hover:text-[var(--text-primary)]"
              >
                {qp}
              </button>
            ))}
          </div>

          {/* Input & Continue on WhatsApp */}
          <div className="border-t border-[var(--border-hairline)] bg-[var(--bg-surface)] p-2.5">
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunte à Bora IA..."
                className="flex-1 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2 text-xs text-[var(--text-primary)] focus:border-[#25D366] focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Enviar mensagem"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366] text-white hover:bg-[#1fb857]"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
            <a
              href={`https://wa.me/?text=${whatsappText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#075E54] hover:underline dark:text-[#25D366]"
            >
              Continuar conversa no meu WhatsApp
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}
    </>
  );
}
