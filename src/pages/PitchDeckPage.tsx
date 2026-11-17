import {
  Award,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  Download,
  ExternalLink,
  Flame,
  Mail,
  Maximize2,
  Minimize2,
  Moon,
  QrCode,
  RotateCcw,
  ScrollText,
  Share2,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Tv,
  Users,
  Wallet,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BrandLogo } from '../components/BrandLogo';
import type { AppRoute } from '../services/router';

interface PitchDeckPageProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onNavigate: (route: AppRoute) => void;
}

interface SlideData {
  id: number;
  tag: string;
  tagColor: string;
  title: string;
  subtitle?: string;
  category: string;
}

const SLIDES: SlideData[] = [
  {
    id: 1,
    tag: 'Apresentação Executiva',
    tagColor: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
    title: 'A cidade acontece. Você aproveita.',
    subtitle: 'Plataforma de experiências e vantagens em tempo real para a cidade do Rio de Janeiro.',
    category: 'Capa & Proposta',
  },
  {
    id: 2,
    tag: '01 • Oportunidade',
    tagColor: 'border-amber-500/40 text-amber-400 bg-amber-500/10',
    title: 'O lazer no Rio ainda é fragmentado',
    subtitle: 'Como a falta de um elo digital integrado prejudica quem sai, quem oferece e o ecossistema carioca.',
    category: 'Problema & Mercado',
  },
  {
    id: 3,
    tag: '02 • Solução',
    tagColor: 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10',
    title: 'BoraRio: da descoberta à experiência',
    subtitle: 'Motor de fluxo qualificado para os estabelecimentos e passaporte de vantagens para quem vive o Rio.',
    category: 'Proposta de Valor',
  },
  {
    id: 4,
    tag: '03 • Produto',
    tagColor: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
    title: 'Uma jornada simples em 5 passos',
    subtitle: 'Experiência fluida e intuitiva desenhada para eliminar atritos em salão e gerar valor imediato.',
    category: 'Jornada do Usuário',
  },
  {
    id: 5,
    tag: '04 • Diferenciais',
    tagColor: 'border-purple-500/40 text-purple-400 bg-purple-500/10',
    title: 'Por que o BoraRio é diferente',
    subtitle: 'Vantagens competitivas estruturais frente a guias tradicionais e cupons promocionais ultrapassados.',
    category: 'Vantagem Competitiva',
  },
  {
    id: 6,
    tag: '05 • Modelo de Receita',
    tagColor: 'border-[#FF6B35]/40 text-[#FF6B35] bg-[#FF6B35]/10',
    title: 'Monetização clara e alinhada ao resultado',
    subtitle: 'O parceiro só paga por presença física individual confirmada. Risco zero e retorno tangível.',
    category: 'Modelo de Negócio',
  },
  {
    id: 7,
    tag: '06 • Estratégia de Entrada',
    tagColor: 'border-sky-500/40 text-sky-400 bg-sky-500/10',
    title: 'Foco inicial no Rio de Janeiro',
    subtitle: 'Expansão em três fases planejadas com metas pragmáticas e indicadores de validação rigorosos.',
    category: 'Go-To-Market',
  },
  {
    id: 8,
    tag: '07 • Conversa de Investimento',
    tagColor: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
    title: 'Próximos passos e uso de recursos',
    subtitle: 'Alocação disciplinada de capital para validação do piloto e tração acelerada no mercado carioca.',
    category: 'Rodada & Contato',
  },
];

export function PitchDeckPage({ isDark, onToggleTheme, onNavigate }: PitchDeckPageProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [viewMode, setViewMode] = useState<'slides' | 'scroll'>('slides');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation for presentation mode
  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev < SLIDES.length - 1 ? prev + 1 : prev));
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewMode !== 'slides') return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === 'Home') {
        e.preventDefault();
        setCurrentSlide(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setCurrentSlide(SLIDES.length - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, nextSlide, prevSlide]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const copyShareLink = () => {
    const canonicalUrl = `${window.location.origin}/pitch`;
    navigator.clipboard.writeText(canonicalUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2400);
    });
  };

  const downloadPptxUrl = '/BoraRio_Pitch_Deck_Investidores_Familiares.pptx';

  return (
    <div
      ref={containerRef}
      className={`min-h-screen ${
        isDark ? 'bg-[#07131F] text-slate-100' : 'bg-slate-50 text-slate-900'
      } flex flex-col font-sans transition-colors duration-200 selection:bg-[#FF6B35] selection:text-white`}
    >
      {/* Top Executive Header */}
      <header
        className={`sticky top-0 z-50 border-b backdrop-blur-xl ${
          isDark
            ? 'border-white/10 bg-[#07131F]/90 text-white'
            : 'border-slate-200 bg-white/90 text-slate-900'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="text-left transition hover:opacity-80 focus:outline-none"
              title="Voltar à página inicial"
            >
              <BrandLogo variant="horizontal" size="sm" onDark={isDark} />
            </button>
            <div className="hidden h-5 w-[1px] bg-white/20 sm:block" />
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 sm:inline-flex">
              <Sparkles className="h-3 w-3" /> Deck para Investidores Familiares
            </span>
          </div>

          {/* Center: Slide indicator (Presentation mode only) */}
          {viewMode === 'slides' && (
            <div className="hidden items-center gap-2 md:flex">
              <span className="text-xs font-medium text-slate-400">
                Slide <span className="font-bold text-white">{currentSlide + 1}</span> de {SLIDES.length}
              </span>
              <div className="flex items-center gap-1">
                {SLIDES.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentSlide(idx)}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === currentSlide
                        ? 'w-6 bg-emerald-400'
                        : 'w-2 bg-slate-700 hover:bg-slate-500'
                    }`}
                    title={`Ir para slide ${idx + 1}: ${SLIDES[idx].category}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Right: Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* View Mode Toggle */}
            <div className="flex rounded-lg border border-white/10 bg-slate-800/60 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('slides')}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition ${
                  viewMode === 'slides'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Modo Apresentação Slide a Slide"
              >
                <Tv className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Apresentação</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('scroll')}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition ${
                  viewMode === 'scroll'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Modo Leitura Contínua"
              >
                <ScrollText className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Documento</span>
              </button>
            </div>

            {/* Download PPTX */}
            <a
              href={downloadPptxUrl}
              download="BoraRio_Pitch_Deck_Investidores_Familiares.pptx"
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/20"
              title="Baixar arquivo original editável (.pptx)"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Baixar PPTX</span>
            </a>

            {/* Copy Share Link */}
            <button
              type="button"
              onClick={copyShareLink}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
              title="Copiar link exclusivo do deck"
            >
              {copiedLink ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="hidden sm:inline text-emerald-400">Copiado!</span>
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Compartilhar</span>
                </>
              )}
            </button>

            {/* Test Superapp */}
            <button
              type="button"
              onClick={() => onNavigate('/app')}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#FF6B35] to-[#F7931E] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:brightness-110"
              title="Abrir e testar o app em tempo real"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Ver App</span>
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Alternar tema"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-slate-800/80 text-slate-300 transition hover:text-white"
            >
              {isDark ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-slate-700" />}
            </button>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label="Tela cheia"
              className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-slate-800/80 text-slate-300 transition hover:text-white"
              title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Presentation progress bar */}
        {viewMode === 'slides' && (
          <div className="h-1 w-full bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-[#FF6B35] transition-all duration-300"
              style={{ width: `${((currentSlide + 1) / SLIDES.length) * 100}%` }}
            />
          </div>
        )}
      </header>

      {/* Main Content Area */}
      {viewMode === 'slides' ? (
        /* =================== SLIDE-BY-SLIDE PRESENTATION MODE =================== */
        <main className="relative flex flex-1 flex-col justify-between overflow-hidden px-4 py-6 sm:px-8 lg:px-12">
          {/* Active Slide Canvas (16:9 responsive frame) */}
          <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center">
            <div
              className={`relative overflow-hidden rounded-2xl border ${
                isDark
                  ? 'border-white/10 bg-gradient-to-b from-slate-900/90 to-[#0A1A2A]/90 text-white shadow-2xl'
                  : 'border-slate-200 bg-white text-slate-900 shadow-xl'
              } p-6 sm:p-10 lg:p-12 transition-all duration-300 min-h-[540px] flex flex-col justify-between`}
            >
              {/* Background ambient glow */}
              <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-[#FF6B35]/10 blur-3xl" />

              {/* Slide Body */}
              <div className="relative z-10 flex-1">
                {currentSlide === 0 && <Slide1Cover />}
                {currentSlide === 1 && <Slide2Opportunity />}
                {currentSlide === 2 && <Slide3Solution />}
                {currentSlide === 3 && <Slide4ProductJourney />}
                {currentSlide === 4 && <Slide5Differentiators />}
                {currentSlide === 5 && <Slide6BusinessModel />}
                {currentSlide === 6 && <Slide7GoToMarket />}
                {currentSlide === 7 && <Slide8Investment />}
              </div>

              {/* Slide Footer Info within the canvas */}
              <div className="relative z-10 mt-8 flex flex-wrap items-center justify-between border-t border-white/10 pt-4 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-300">BoraRio</span>
                  <span>•</span>
                  <span>Apresentação Executiva</span>
                  <span>•</span>
                  <span className="hidden sm:inline">Confidencial · Novembro 2026</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-slate-800/80 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                    Slide {currentSlide + 1} de {SLIDES.length}
                  </span>
                  <span className="hidden sm:inline text-slate-500">
                    (Use as teclas ← e → para navegar)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Presentation Bottom Navigation Controls */}
          <div className="mx-auto mt-6 flex w-full max-w-6xl items-center justify-between px-2">
            <button
              type="button"
              onClick={prevSlide}
              disabled={currentSlide === 0}
              className={`flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold transition ${
                currentSlide === 0
                  ? 'cursor-not-allowed opacity-30 text-slate-500'
                  : 'bg-slate-800/80 text-white hover:bg-slate-700 hover:border-slate-500'
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Anterior</span>
            </button>

            {/* Quick jump carousel pills */}
            <div className="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
              {SLIDES.map((slide, idx) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => setCurrentSlide(idx)}
                  className={`group relative flex items-center justify-center rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    idx === currentSlide
                      ? 'bg-emerald-500 text-white shadow-md'
                      : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                  title={`${slide.id}. ${slide.category}`}
                >
                  <span>{idx + 1}</span>
                  <span className="ml-1 hidden lg:inline font-normal opacity-80">
                    · {slide.category}
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={nextSlide}
              disabled={currentSlide === SLIDES.length - 1}
              className={`flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold transition ${
                currentSlide === SLIDES.length - 1
                  ? 'cursor-not-allowed opacity-30 text-slate-500'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500 hover:shadow-lg'
              }`}
            >
              <span>Próximo</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </main>
      ) : (
        /* =================== DOCUMENT / CONTINUOUS SCROLL MODE =================== */
        <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8 space-y-12">
          {/* Executive Overview Banner */}
          <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-slate-900/40 p-6 text-white shadow-xl backdrop-blur-md">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
                  Documento Completo · 8 Slides
                </span>
                <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">
                  BoraRio — Deck para Investidores Familiares
                </h1>
                <p className="mt-1 text-sm text-slate-300">
                  Visualização linear executiva do plano de negócios, oportunidade de mercado e modelo de receita.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={downloadPptxUrl}
                  download="BoraRio_Pitch_Deck_Investidores_Familiares.pptx"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-emerald-500"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Baixar PowerPoint (.pptx)</span>
                </a>
              </div>
            </div>
          </div>

          {/* All 8 slides rendered in order */}
          {SLIDES.map((slide, idx) => (
            <article
              key={slide.id}
              id={`slide-${slide.id}`}
              className={`relative overflow-hidden rounded-2xl border ${
                isDark
                  ? 'border-white/10 bg-slate-900/80 text-white'
                  : 'border-slate-200 bg-white text-slate-900 shadow-md'
              } p-6 sm:p-10 transition-all`}
            >
              <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
                <span className={`inline-block rounded-full border px-3 py-0.5 text-xs font-bold ${slide.tagColor}`}>
                  {slide.tag}
                </span>
                <span className="font-mono text-xs font-semibold text-slate-400">
                  Slide {slide.id} de {SLIDES.length}
                </span>
              </div>

              {idx === 0 && <Slide1Cover />}
              {idx === 1 && <Slide2Opportunity />}
              {idx === 2 && <Slide3Solution />}
              {idx === 3 && <Slide4ProductJourney />}
              {idx === 4 && <Slide5Differentiators />}
              {idx === 5 && <Slide6BusinessModel />}
              {idx === 6 && <Slide7GoToMarket />}
              {idx === 7 && <Slide8Investment />}
            </article>
          ))}

          {/* Bottom Action Card */}
          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900 to-[#0A1A2A] p-8 text-center text-white shadow-2xl">
            <h2 className="text-xl font-bold">Interessado em fazer parte do BoraRio?</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-300">
              Estamos estruturando a rodada inicial com parceiros e investidores familiares que compartilham nossa paixão pelo Rio.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <a
                href="mailto:contato@borario.com.br?subject=Conversa%20de%20Investimento%20-%20BoraRio"
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-emerald-500"
              >
                <Mail className="h-4 w-4" />
                <span>Falar com os Fundadores</span>
              </a>
              <button
                type="button"
                onClick={() => onNavigate('/app')}
                className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Explorar Superapp ao Vivo</span>
              </button>
            </div>
          </div>
        </main>
      )}

      {/* Footer bar */}
      <footer
        className={`border-t py-4 text-center text-xs ${
          isDark
            ? 'border-white/10 bg-[#07131F] text-slate-500'
            : 'border-slate-200 bg-slate-100 text-slate-600'
        }`}
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between px-4 sm:px-6">
          <p>© 2026 BoraRio Tecnologia e Experiências Cariocas. Todos os direitos reservados.</p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="hover:text-emerald-400 transition"
            >
              Início
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/parceiros')}
              className="hover:text-emerald-400 transition"
            >
              Para Estabelecimentos
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/app')}
              className="hover:text-emerald-400 transition"
            >
              Abrir App
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* =========================================================================
   INDIVIDUAL SLIDE COMPONENTS (Executive Content Matching the PowerPoint)
   ========================================================================= */

// Slide 1: Capa & Proposta
function Slide1Cover() {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-400">
        <Sparkles className="h-3.5 w-3.5" />
        <span>BoraRio · Apresentação para Potenciais Investidores Familiares</span>
      </div>

      <h1 className="mt-6 max-w-4xl text-3xl font-black tracking-tight sm:text-5xl lg:text-6xl">
        A cidade acontece.{' '}
        <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-[#FF6B35] bg-clip-text text-transparent">
          Você aproveita.
        </span>
      </h1>

      <p className="mt-4 max-w-2xl text-base text-slate-300 sm:text-xl">
        Plataforma de experiências e vantagens em tempo real para a cidade do Rio de Janeiro.
      </p>

      {/* 3 Executive Pillars Highlights */}
      <div className="mt-10 grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3 text-left">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-emerald-400">
            <Compass className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">O que é</span>
          </div>
          <p className="mt-2 text-sm text-slate-300">
            Superapp que conecta cariocas e visitantes aos melhores bares, restaurantes e atrações em tempo real.
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-[#FF6B35]">
            <Flame className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Diferencial</span>
          </div>
          <p className="mt-2 text-sm text-slate-300">
            Oportunidades dinâmicas em horários estratégicos e programa de fidelidade unificado (Rio Points).
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-amber-400">
            <Wallet className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Modelo</span>
          </div>
          <p className="mt-2 text-sm text-slate-300">
            Monetização baseada em presença física real: R$ 10 por check-in individual validado (R$ 5 no lançamento).
          </p>
        </div>
      </div>

      <div className="mt-8 flex items-center gap-2 text-xs text-slate-400">
        <span>Novembro / 2026</span>
        <span>•</span>
        <span>Versão Preliminar e Confidencial</span>
        <span>•</span>
        <span>Rio de Janeiro, Brasil</span>
      </div>
    </div>
  );
}

// Slide 2: Oportunidade (O lazer no Rio ainda é fragmentado)
function Slide2Opportunity() {
  return (
    <div>
      <div className="mb-6">
        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-0.5 text-xs font-bold text-amber-400">
          01 • Oportunidade
        </span>
        <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-4xl text-white">
          O lazer no Rio ainda é fragmentado
        </h2>
        <p className="mt-1 text-sm text-slate-300">
          A fricção na jornada do consumidor e a ineficiência comercial dos estabelecimentos geram um enorme desperdício econômico na cidade.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* Para quem sai */}
        <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-sm">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-white">Para quem sai</h3>
            </div>
            <p className="mt-3 text-xs font-semibold text-cyan-400">Dificuldade de decisão e incerteza</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <span className="mt-1 text-cyan-400 text-xs">▸</span>
                <span>Decidir onde ir exige abrir múltiplos apps, checar redes sociais e grupos de mensagens.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-cyan-400 text-xs">▸</span>
                <span>Informações desencontradas sobre horário real de funcionamento, fila e lotação.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-cyan-400 text-xs">▸</span>
                <span>Pouco reconhecimento: frequenta diversos locais sem nunca ser recompensado pela fidelidade à cidade.</span>
              </li>
            </ul>
          </div>
          <div className="mt-4 rounded-lg bg-cyan-950/30 p-2.5 text-[11px] text-cyan-300 border border-cyan-800/30">
            Resultado: Decisão por inércia e perda de experiências autênticas.
          </div>
        </div>

        {/* Para quem oferece */}
        <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-sm">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF6B35]/10 text-[#FF6B35]">
                <Building2 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-white">Para quem oferece</h3>
            </div>
            <p className="mt-3 text-xs font-semibold text-[#FF6B35]">Ociosidade e comissões abusivas</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <span className="mt-1 text-[#FF6B35] text-xs">▸</span>
                <span>Bares, restaurantes e casas noturnas enfrentam horários ociosos com mesas vazias e custos fixos correndo.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-[#FF6B35] text-xs">▸</span>
                <span>Custos de aquisição altos em plataformas predatórias que cobram 15% a 30% sem fidelizar o cliente.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-[#FF6B35] text-xs">▸</span>
                <span>Dificuldade para comunicar benefícios pontuais no momento exato em que a casa precisa de fluxo.</span>
              </li>
            </ul>
          </div>
          <div className="mt-4 rounded-lg bg-orange-950/30 p-2.5 text-[11px] text-orange-300 border border-orange-800/30">
            Resultado: Margem comprimida e dependência de intermediários tradicionais.
          </div>
        </div>

        {/* Para o mercado */}
        <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-sm">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-white">Para o mercado</h3>
            </div>
            <p className="mt-3 text-xs font-semibold text-amber-400">Potencial econômico subaproveitado</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li className="flex items-start gap-2">
                <span className="mt-1 text-amber-400 text-xs">▸</span>
                <span>O Rio tem vocação turística e gastronômica global, mas carece de uma infraestrutura digital unificada.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-amber-400 text-xs">▸</span>
                <span>Falta uma ponte ágil entre o que está acontecendo agora na cidade e quem está pronto para consumir.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-amber-400 text-xs">▸</span>
                <span>Demanda espontânea dispersa em algoritmos de redes sociais que não convertem em visitas reais ao salão.</span>
              </li>
            </ul>
          </div>
          <div className="mt-4 rounded-lg bg-amber-950/30 p-2.5 text-[11px] text-amber-300 border border-amber-800/30">
            Resultado: Um mercado multibilionário pronto para um player nativo focado em presença.
          </div>
        </div>
      </div>
    </div>
  );
}

// Slide 3: Solução (BoraRio: da descoberta à experiência)
function Slide3Solution() {
  return (
    <div>
      <div className="mb-6">
        <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-0.5 text-xs font-bold text-cyan-400">
          02 • Solução
        </span>
        <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-4xl text-white">
          BoraRio: da descoberta à experiência
        </h2>
        <p className="mt-1 text-sm text-slate-300">
          O BoraRio não é apenas um guia: é um <strong className="text-emerald-400">motor de fluxo qualificado</strong> para os estabelecimentos e um <strong className="text-emerald-400">passaporte de vantagens</strong> para quem vive o Rio.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Descobrir */}
        <div className="group rounded-xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-cyan-500/50">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 font-bold">
            1
          </div>
          <h3 className="mt-3 text-base font-bold text-white">Descobrir</h3>
          <p className="text-xs font-semibold text-cyan-400">Curadoria viva em tempo real</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">
            Gastronomia carioca, noites e eventos mapeados ao vivo por bairro e ocasião (Casal, Família, Galera ou Econômico).
          </p>
        </div>

        {/* 2. Aproveitar */}
        <div className="group rounded-xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-[#FF6B35]/50">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FF6B35]/10 text-[#FF6B35] font-bold">
            2
          </div>
          <h3 className="mt-3 text-base font-bold text-white">Aproveitar</h3>
          <p className="text-xs font-semibold text-[#FF6B35]">Oportunidades de verdade</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">
            Janelas curtas de benefício para horários específicos. Condições transparentes, sem pegadinhas nem regras confusas.
          </p>
        </div>

        {/* 3. Validar */}
        <div className="group rounded-xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-emerald-500/50">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 font-bold">
            3
          </div>
          <h3 className="mt-3 text-base font-bold text-white">Validar</h3>
          <p className="text-xs font-semibold text-emerald-400">Check-in individual verificado</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">
            Presença física confirmada no local via QR Code. Cada integrante do grupo valida sua própria visita no app.
          </p>
        </div>

        {/* 4. Recompensar */}
        <div className="group rounded-xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-amber-500/50">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 font-bold">
            4
          </div>
          <h3 className="mt-3 text-base font-bold text-white">Recompensar</h3>
          <p className="text-xs font-semibold text-amber-400">Rio Points em circulação</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">
            Pontos acumulados a cada visita que podem ser trocados em benefícios por toda a rede de parceiros cariocas.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4 text-center">
        <p className="text-xs font-medium text-emerald-300 sm:text-sm">
          💡 <strong>O ciclo virtuoso:</strong> Descoberta qualificada gera visita real → Check-in gera receita para a plataforma e dados para o parceiro → Recompensa estimula a próxima experiência na cidade.
        </p>
      </div>
    </div>
  );
}

// Slide 4: Produto e Jornada do Usuário
function Slide4ProductJourney() {
  const steps = [
    {
      num: '1',
      title: 'Descobre',
      desc: 'Abre o app e vê o que está acontecendo por perto agora, com curadoria editorial e disponibilidade.',
      icon: Compass,
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    },
    {
      num: '2',
      title: 'Ativa',
      desc: 'Escolhe uma oportunidade com condições, horário de validade e número de pessoas do grupo claros.',
      icon: Target,
      color: 'text-[#FF6B35] bg-[#FF6B35]/10 border-[#FF6B35]/30',
    },
    {
      num: '3',
      title: 'Comparece',
      desc: 'Vai ao local e cada pessoa do grupo valida sua presença individualmente via QR Code na mesa ou balcão.',
      icon: QrCode,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    },
    {
      num: '4',
      title: 'Acumula',
      desc: 'Ganha Rio Points imediatos pela visita individual confirmada no estabelecimento participante.',
      icon: Award,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    },
    {
      num: '5',
      title: 'Resgata',
      desc: 'Usa os pontos em benefícios, drinks cortesia, sobremesas ou novas visitas no ecossistema BoraRio.',
      icon: Wallet,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-0.5 text-xs font-bold text-emerald-400">
          03 • Produto
        </span>
        <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-4xl text-white">
          Uma jornada simples em 5 passos
        </h2>
        <p className="mt-1 text-sm text-slate-300">
          Criamos um fluxo direto e sem atrito, pensado para o ritmo da cidade e o dia a dia de um salão de restaurante.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        {steps.map((st) => {
          const Icon = st.icon;
          return (
            <div
              key={st.num}
              className="flex flex-col justify-between rounded-xl border border-white/10 bg-white/[0.02] p-4 text-left transition hover:border-white/30"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-lg font-black text-slate-400">0{st.num}</span>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${st.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <h3 className="mt-3 text-base font-bold text-white">{st.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">{st.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-slate-800/40 p-4 text-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
          Princípio fundamental da experiência
        </span>
        <p className="mt-1 text-sm font-medium text-slate-200">
          ✨ <strong>Sem atrito:</strong> Sem vouchers para imprimir, sem constrangimento na hora da conta e com cada cliente do grupo participando do app.
        </p>
      </div>
    </div>
  );
}

// Slide 5: Diferenciais Competitivos
function Slide5Differentiators() {
  const items = [
    {
      title: 'Oportunidades Vivas',
      desc: 'Condições dinâmicas criadas em tempo real pelo parceiro para preencher horários ociosos com inteligência e controle de fluxo.',
      icon: Flame,
      color: 'text-[#FF6B35]',
    },
    {
      title: 'Visita Verificável (Pay-for-Performance)',
      desc: 'O parceiro só paga por pessoas que efetivamente compareceram ao local e validaram seu check-in. Risco zero com reservas fantasmas ou no-show.',
      icon: ShieldCheck,
      color: 'text-emerald-400',
    },
    {
      title: 'Fidelização Cruzada entre Parceiros',
      desc: 'Pontos ganhos em um almoço tradicional na Tijuca podem ser usados em um rooftop no Leblon. O ecossistema inteiro estimula a circulação pela cidade.',
      icon: RotateCcw,
      color: 'text-cyan-400',
    },
    {
      title: 'Demanda Controlada pelo Parceiro',
      desc: 'O estabelecimento define estoque, horários de ativação e regras, sem cláusulas abusivas nem aprisionamento a descontos insustentáveis.',
      icon: Building2,
      color: 'text-amber-400',
    },
    {
      title: 'Inteligência Transversal Bora IA',
      desc: 'IA nativa que compreende contexto de clima, bairro e momento social para sugerir roteiros personalizados e maximizar a conversão das ofertas.',
      icon: Sparkles,
      color: 'text-purple-400',
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <span className="rounded-full border border-purple-500/40 bg-purple-500/10 px-3 py-0.5 text-xs font-bold text-purple-400">
          04 • Diferenciais
        </span>
        <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-4xl text-white">
          Por que o BoraRio é diferente
        </h2>
        <p className="mt-1 text-sm text-slate-300">
          Construímos um modelo que corrige as principais dores dos velhos clubes de desconto e guias estáticos.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={i}
              className={`rounded-xl border border-white/10 bg-white/[0.02] p-4 text-left transition hover:border-white/30 ${
                i === 4 ? 'sm:col-span-2 lg:col-span-1' : ''
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`h-5 w-5 ${item.color}`} />
                <h3 className="text-sm font-bold text-white">{item.title}</h3>
              </div>
              <p className="mt-2.5 text-xs leading-relaxed text-slate-300">{item.desc}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between rounded-xl border border-purple-500/30 bg-purple-950/20 px-4 py-3 text-xs text-purple-200">
        <span>Comparativo: <strong>Guias Clássicos:</strong> Anúncios fixos caros e sem métrica de conversão.</span>
        <span><strong>Clubes de Cupons:</strong> Descontos predatórios que atraem caçadores de preço único.</span>
        <span className="font-bold text-white"><strong>BoraRio:</strong> Performance real e fidelidade unificada.</span>
      </div>
    </div>
  );
}

// Slide 6: Modelo de Receita (Monetização clara e alinhada ao resultado)
function Slide6BusinessModel() {
  return (
    <div>
      <div className="mb-6">
        <span className="rounded-full border border-[#FF6B35]/40 bg-[#FF6B35]/10 px-3 py-0.5 text-xs font-bold text-[#FF6B35]">
          05 • Modelo de Receita
        </span>
        <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-4xl text-white">
          Monetização clara e alinhada ao resultado
        </h2>
        <p className="mt-1 text-sm text-slate-300">
          Modelo simples de explicar, fácil de auditar e 100% atrelado a quem efetivamente sentou à mesa.
        </p>
      </div>

      {/* 3 Core Pricing Pillars */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Tarifa Padrão */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-left">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Tarifa Operacional Padrão
          </span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-black text-white">R$ 10,00</span>
            <span className="text-xs text-slate-400">/ check-in individual</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-300">
            Cobrado do estabelecimento exclusivamente por pessoa com visita validada no salão.
          </p>
          <div className="mt-4 border-t border-white/10 pt-3 text-[11px] text-slate-400">
            ✓ Sem taxa fixa mensal<br />
            ✓ Sem cobrança por reserva cancelada<br />
            ✓ Sem surpresas na fatura
          </div>
        </div>

        {/* Condição de Lançamento */}
        <div className="relative rounded-xl border-2 border-emerald-500 bg-emerald-950/30 p-5 text-left shadow-lg">
          <span className="absolute -top-2.5 right-4 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-black">
            50% OFF · Early Adopters
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
            Condição Especial de Lançamento
          </span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-black text-emerald-300">R$ 5,00</span>
            <span className="text-xs text-slate-400">/ check-in individual</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-300">
            Para acelerar a adesão dos primeiros parceiros durante a fase de piloto e lançamento oficial no Rio.
          </p>
          <div className="mt-4 border-t border-emerald-500/20 pt-3 text-[11px] text-emerald-300">
            ✓ Reduz a barreira para 100% dos parceiros<br />
            ✓ Estímulo rápido à densidade de catálogo<br />
            ✓ Válido para os primeiros 200 cadastrados
          </div>
        </div>

        {/* Recompensas & Circulação */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-left">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Circulação de Recompensas
          </span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-black text-white">0%</span>
            <span className="text-xs text-slate-400">comissão em resgates</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-300">
            O parceiro oferece recompensas (cortesias/benefícios) sem pagar taxa percentual ao BoraRio no resgate de Rio Points.
          </p>
          <div className="mt-4 border-t border-white/10 pt-3 text-[11px] text-slate-400">
            ✓ Custo sob controle do próprio parceiro<br />
            ✓ Incentiva a oferta de benefícios reais<br />
            ✓ Fideliza clientes sem intermediários
          </div>
        </div>
      </div>

      {/* Simulation Table: Pessoas x Custo */}
      <div className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-slate-900/60">
        <div className="border-b border-white/10 bg-slate-800/60 px-4 py-2 text-xs font-bold text-slate-300">
          Simulação de Receita por Mesa / Grupo de Amigos
        </div>
        <div className="grid grid-cols-4 divide-x divide-white/10 p-3 text-center text-xs">
          <div>
            <span className="text-slate-400">Pessoas Validadas</span>
            <div className="mt-1 font-bold text-white">1 Pessoa</div>
            <div className="text-[10px] text-slate-400">Lançamento: <strong className="text-emerald-400">R$ 5</strong> | Padrão: <strong>R$ 10</strong></div>
          </div>
          <div>
            <span className="text-slate-400">Casal</span>
            <div className="mt-1 font-bold text-white">2 Pessoas</div>
            <div className="text-[10px] text-slate-400">Lançamento: <strong className="text-emerald-400">R$ 10</strong> | Padrão: <strong>R$ 20</strong></div>
          </div>
          <div>
            <span className="text-slate-400">Grupo Amigos</span>
            <div className="mt-1 font-bold text-white">4 Pessoas</div>
            <div className="text-[10px] text-slate-400">Lançamento: <strong className="text-emerald-400">R$ 20</strong> | Padrão: <strong>R$ 40</strong></div>
          </div>
          <div>
            <span className="text-slate-400">Mesa Grande</span>
            <div className="mt-1 font-bold text-white">6 Pessoas</div>
            <div className="text-[10px] text-slate-400">Lançamento: <strong className="text-emerald-400">R$ 30</strong> | Padrão: <strong>R$ 60</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Slide 7: Estratégia de Entrada (Foco inicial no Rio de Janeiro)
function Slide7GoToMarket() {
  return (
    <div>
      <div className="mb-6">
        <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-0.5 text-xs font-bold text-sky-400">
          06 • Estratégia de Entrada
        </span>
        <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-4xl text-white">
          Foco inicial no Rio de Janeiro
        </h2>
        <p className="mt-1 text-sm text-slate-300">
          Estratégia de expansão hiperlocal em três etapas sequenciais e focadas em densidade.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Fase 1: Piloto */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 text-left">
          <div className="flex items-center justify-between">
            <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-400">
              Meses 1 - 2
            </span>
            <span className="text-xs font-mono text-slate-500">FASE 1</span>
          </div>
          <h3 className="mt-3 text-lg font-bold text-white">Piloto Controlado</h3>
          <p className="mt-2 text-xs text-sky-300 font-semibold">30 a 50 estabelecimentos</p>
          <ul className="mt-3 space-y-2 text-xs text-slate-300">
            <li>• Concentração na <strong>Zona Sul</strong> (Leblon, Ipanema, Botafogo) e <strong>Barra da Tijuca</strong>.</li>
            <li>• Ajuste do fluxo de salão e engajamento da equipe de atendimento (garçons e hostess).</li>
            <li>• Validação da mecânica de check-in individual e acúmulo de Rio Points com 1.000 usuários beta.</li>
          </ul>
        </div>

        {/* Fase 2: Lançamento */}
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-5 text-left">
          <div className="flex items-center justify-between">
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
              Meses 3 - 6
            </span>
            <span className="text-xs font-mono text-emerald-400 font-bold">FASE 2</span>
          </div>
          <h3 className="mt-3 text-lg font-bold text-white">Lançamento Oficial</h3>
          <p className="mt-2 text-xs text-emerald-300 font-semibold">150 a 200 estabelecimentos</p>
          <ul className="mt-3 space-y-2 text-xs text-slate-300">
            <li>• Campanha aberta no Rio com a condição promocional de R$ 5,00 por check-in.</li>
            <li>• Meta de atingir <strong>10.000 usuários ativos mensais</strong> e 5.000 check-ins validados.</li>
            <li>• Ativação de parcerias com criadores de conteúdo gastronômico e cultural carioca.</li>
          </ul>
        </div>

        {/* Fase 3: Escala */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 text-left">
          <div className="flex items-center justify-between">
            <span className="rounded bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-400">
              Meses 7 - 12
            </span>
            <span className="text-xs font-mono text-slate-500">FASE 3</span>
          </div>
          <h3 className="mt-3 text-lg font-bold text-white">Escala & Novos Bairros</h3>
          <p className="mt-2 text-xs text-purple-300 font-semibold">300+ estabelecimentos</p>
          <ul className="mt-3 space-y-2 text-xs text-slate-300">
            <li>• Expansão para a <strong>Tijuca</strong>, <strong>Centro / Lapa</strong>, Santa Teresa e Niterói.</li>
            <li>• Integração de eventos, hotelaria, turismo e experiências noturnas integradas.</li>
            <li>• Consolidação do Rio Points como moeda de conveniência e lazer da cidade.</li>
          </ul>
        </div>
      </div>

      {/* 5 KPIs */}
      <div className="mt-5 rounded-xl border border-white/10 bg-slate-900/60 p-4">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Indicadores-Chave de Sucesso (KPIs de Acompanhamento)
        </span>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5 text-center text-xs">
          <div className="rounded-lg bg-slate-800/60 p-2">
            <span className="text-slate-400 block text-[10px]">Volume Transacional</span>
            <strong className="text-white">Check-ins / mês</strong>
          </div>
          <div className="rounded-lg bg-slate-800/60 p-2">
            <span className="text-slate-400 block text-[10px]">Saúde do Negócio</span>
            <strong className="text-white">Retenção Parceiros</strong>
          </div>
          <div className="rounded-lg bg-slate-800/60 p-2">
            <span className="text-slate-400 block text-[10px]">Eficiência de Growth</span>
            <strong className="text-white">CAC por Usuário</strong>
          </div>
          <div className="rounded-lg bg-slate-800/60 p-2">
            <span className="text-slate-400 block text-[10px]">Engajamento</span>
            <strong className="text-white">Frequência Rio Points</strong>
          </div>
          <div className="rounded-lg bg-slate-800/60 p-2">
            <span className="text-slate-400 block text-[10px]">Qualidade de Serviço</span>
            <strong className="text-white">NPS B2B & B2C</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

// Slide 8: Conversa de Investimento & Próximos Passos
function Slide8Investment() {
  return (
    <div>
      <div className="mb-6">
        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-0.5 text-xs font-bold text-emerald-400">
          07 • Conversa de Investimento
        </span>
        <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-4xl text-white">
          Próximos passos e uso de recursos
        </h2>
        <p className="mt-1 text-sm text-slate-300">
          Estrutura enxuta voltada para comprovar unit economics e criar uma máquina de tração sustentável.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Destinação do Capital */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 text-left">
          <div className="flex items-center gap-2 text-emerald-400">
            <Target className="h-5 w-5" />
            <h3 className="text-base font-bold text-white">O capital será direcionado para:</h3>
          </div>
          <ul className="mt-4 space-y-2.5 text-xs text-slate-300 sm:text-sm">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Finalização técnica e segurança:</strong> estabilidade de infraestrutura, QR Code anti-fraude e geolocalização precisa.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Aquisição e onboarding de parceiros:</strong> equipe de campo dedicada aos primeiros 50 estabelecimentos chave.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Marketing de lançamento:</strong> campanhas focadas em comunidades locais, embaixadores e microinfluenciadores no Rio.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Capital de giro operacional:</strong> sustentação dos primeiros 6 meses até atingimento do breakeven do piloto.</span>
            </li>
          </ul>
        </div>

        {/* Marco de Validação e Proposta */}
        <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-white/[0.02] p-5 text-left">
          <div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                Marco de Validação Inicial (90 dias)
              </span>
              <p className="mt-1 text-sm font-semibold text-white">
                5.000 check-ins validados e 50 estabelecimentos ativos com recorrência comprovada no Rio.
              </p>
            </div>

            <div className="mt-4">
              <h4 className="text-sm font-bold text-white">Proposta para a conversa:</h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                Rodada inicial com investidores familiares e anjos estratégicos para viabilizar o piloto e a tração inicial. Termos abertos para diálogo amigável e alinhado aos interesses de longo prazo.
              </p>
            </div>
          </div>

          {/* Founder contact and CTAs */}
          <div className="mt-5 rounded-xl border border-white/10 bg-slate-800/80 p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white">Contato dos Fundadores</span>
                <p className="text-xs text-slate-400">contato@borario.com.br · Rio de Janeiro, RJ</p>
              </div>
              <a
                href="mailto:contato@borario.com.br?subject=Conversa%20de%20Investimento%20-%20BoraRio"
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-500"
              >
                Iniciar Conversa
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 text-center text-xs text-slate-400">
        “Vamos construir juntos a próxima referência em experiências e gastronomia no Rio de Janeiro?”
      </div>
    </div>
  );
}
