import { ArrowRight, ExternalLink, MoonStar, Send, Sparkles, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import {
  queryBoraIa,
  type BoraIaMatch,
  type BoraIaNightlifeMatch,
} from '../services/boraIaService';
import { NIGHTLIFE_SUBAREA_META, type NightlifeEvent } from '../types/nightlife';
import type { Restaurant } from '../types/restaurant';

interface ConciergeWidgetProps {
  experiences: Restaurant[];
  nightlifeEvents?: NightlifeEvent[];
  externalPrompt?: string | null;
  onConsumeExternalPrompt?: () => void;
  onSendToPlanner?: (promptText: string) => void;
  onSelectExperience: (item: Restaurant) => void;
  onSelectNightlifeEvent?: (event: NightlifeEvent) => void;
  isHome?: boolean;
  hideFloatingButtonOnSmartBar?: boolean;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  matches?: BoraIaMatch[];
  nightlifeMatches?: BoraIaNightlifeMatch[];
  originQuery?: string;
}

const QUICK_PROMPTS = [
  'Onde jantar hoje em Botafogo até R$ 250 para casal?',
  'O que fazer com crianças neste fim de semana?',
  'Lugares com música ao vivo sem fila',
  'Samba, show ou festa para curtir hoje à noite no Rio',
];

export function ConciergeWidget({
  experiences,
  nightlifeEvents = [],
  externalPrompt,
  onConsumeExternalPrompt,
  onSendToPlanner,
  onSelectExperience,
  onSelectNightlifeEvent,
  isHome = false,
  hideFloatingButtonOnSmartBar = false,
}: ConciergeWidgetProps) {
  const [open, setOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'Olá! Sou a Bora IA. Cruzo o catálogo real do BoraRio, a agenda curada de A Noite Carioca, os seus Desejos salvos, indicações de amigos e o clima do Rio agora. O que você quer viver?',
    },
  ]);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 120);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
        nightlifeEvents,
      });

      const botMsg: ChatMessage = {
        id: `b-${Date.now() + 1}`,
        sender: 'bot',
        text: res.answer,
        matches: res.matches,
        nightlifeMatches: res.nightlifeMatches,
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

  const compactCollapsed = isScrolled && !open;
  // Na Home, oculta o FAB flutuante quando o usuário já está vendo a barra de busca ou a SmartBar (evita sobreposição)
  const hideFloatingButton = isHome && (hideFloatingButtonOnSmartBar || !isScrolled) && !open;

  return (
    <>
      {/* Floating Button (Oculto no topo da Home para evitar duplicidade com a barra de busca) */}
      {!hideFloatingButton && (
        <button
          type="button"
          data-testid="bora-ia-floating-btn"
          aria-label="Abrir Bora IA"
          title="Bora IA Concierge"
          onClick={() => setOpen((prev) => !prev)}
          className={`fixed bottom-[5.5rem] right-3.5 z-40 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] font-bold text-white shadow-lg shadow-[#FF4B2B]/25 transition-all duration-300 hover:scale-105 lg:bottom-6 lg:right-6 ${
            compactCollapsed
              ? 'h-11 w-11 p-0'
              : 'gap-1.5 px-3 py-2 text-[11px] sm:px-3.5 sm:py-2.5 sm:text-xs'
          }`}
        >
          <Sparkles className="h-4 w-4 shrink-0" />
          {!compactCollapsed && <span className="whitespace-nowrap">Bora IA</span>}
        </button>
      )}

      {/* Bora IA Chat Window */}
      {open && (
        <div className="fixed bottom-[9.25rem] right-3.5 z-50 flex h-[460px] max-h-[calc(100vh-11rem)] w-[calc(100vw-1.75rem)] max-w-sm flex-col overflow-hidden rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] shadow-2xl lg:bottom-20 lg:right-6 lg:h-[480px]">
          {/* Header */}
          <div className="flex items-center justify-between bg-borario-ocean px-4 py-3 text-white shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                <Sparkles className="h-4.5 w-4.5 text-[#FFB347]" />
              </div>
              <div>
                <p className="text-sm font-bold leading-tight">Bora IA Concierge</p>
                <p className="text-[11px] text-[#F1E8D8]">
                  Catálogo + Noite Carioca + Desejos + Indicações
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
            {messages.map((m) => {
              const hasMatches = (m.matches && m.matches.length > 0) || false;
              const hasNightlifeMatches = (m.nightlifeMatches && m.nightlifeMatches.length > 0) || false;
              return (
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

                  {(hasMatches || hasNightlifeMatches) && (
                    <div className="mt-2 w-full space-y-2">
                      {m.nightlifeMatches?.map((nl) => (
                        <div
                          key={nl.event.id}
                          onClick={() => {
                            onSelectNightlifeEvent?.(nl.event);
                            setOpen(false);
                          }}
                          className="cursor-pointer rounded-xl border border-[#FF6B35]/35 bg-[#0E2235] p-2.5 text-white shadow-xs transition-colors hover:border-[#FF6B35]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#FFB347]">
                              <MoonStar className="h-3 w-3" />
                              {NIGHTLIFE_SUBAREA_META[nl.event.sub_area].shortLabel}
                            </span>
                            <span className="rounded bg-[#FF6B35] px-1.5 py-0.5 text-[10px] font-bold text-white">
                              {nl.event.price_display_label}
                            </span>
                          </div>
                          <strong className="mt-1 block text-xs text-white">{nl.event.title}</strong>
                          <p className="mt-0.5 text-[11px] text-[#F1E8D8]/85">
                            {nl.event.venue_name} · {nl.event.neighborhood}
                          </p>
                          <p className="mt-1 text-[10px] font-semibold text-[#95E4CA]">
                            {nl.reasonTag} →
                          </p>
                        </div>
                      ))}

                      {m.matches?.map((match) => (
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
              );
            })}
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
