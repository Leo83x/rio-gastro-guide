import {
  Award,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  Download,
  ExternalLink,
  Flame,
  Mail,
  MapPin,
  Maximize2,
  Minimize2,
  Moon,
  QrCode,
  RotateCcw,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Tv,
  Users,
  Wallet,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import rioHeroDay from '../assets/brand/rio-hero-day.jpg';
import rioHeroNight from '../assets/brand/rio-hero-night.jpg';
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
  tagColor: {
    dark: string;
    light: string;
  };
  title: string;
  subtitle?: string;
  category: string;
}

const SLIDES: SlideData[] = [
  {
    id: 1,
    tag: 'Apresentação Executiva',
    tagColor: {
      dark: 'border-[#0077B6]/40 text-[#38BDF8] bg-[#0077B6]/20',
      light: 'border-[#0077B6]/30 text-[#0077B6] bg-[#0077B6]/10',
    },
    title: 'A cidade acontece. Você aproveita.',
    subtitle: 'Plataforma de experiências e vantagens em tempo real para a cidade do Rio de Janeiro.',
    category: 'Capa & Proposta',
  },
  {
    id: 2,
    tag: '01 • Oportunidade',
    tagColor: {
      dark: 'border-amber-500/40 text-amber-300 bg-amber-500/15',
      light: 'border-amber-500/30 text-amber-700 bg-amber-50',
    },
    title: 'O lazer no Rio ainda é fragmentado',
    subtitle: 'Como a falta de um elo digital integrado prejudica quem sai, quem oferece e o ecossistema carioca.',
    category: 'Problema & Mercado',
  },
  {
    id: 3,
    tag: '02 • Solução',
    tagColor: {
      dark: 'border-[#0077B6]/40 text-[#38BDF8] bg-[#0077B6]/20',
      light: 'border-[#0077B6]/30 text-[#0077B6] bg-[#0077B6]/10',
    },
    title: 'BoraRio: da descoberta à experiência',
    subtitle: 'Motor de fluxo qualificado para os estabelecimentos e passaporte de vantagens para quem vive o Rio.',
    category: 'Proposta de Valor',
  },
  {
    id: 4,
    tag: '03 • Produto',
    tagColor: {
      dark: 'border-[#0077B6]/40 text-[#38BDF8] bg-[#0077B6]/20',
      light: 'border-[#0077B6]/30 text-[#0077B6] bg-[#0077B6]/10',
    },
    title: 'Uma jornada simples em 5 passos',
    subtitle: 'Experiência fluida e intuitiva desenhada para eliminar atritos em salão e gerar valor imediato.',
    category: 'Jornada do Usuário',
  },
  {
    id: 5,
    tag: '04 • Diferenciais',
    tagColor: {
      dark: 'border-purple-500/40 text-purple-300 bg-purple-500/15',
      light: 'border-purple-500/30 text-purple-700 bg-purple-50',
    },
    title: 'Por que o BoraRio é diferente',
    subtitle: 'Vantagens competitivas estruturais frente a guias tradicionais e cupons promocionais ultrapassados.',
    category: 'Vantagem Competitiva',
  },
  {
    id: 6,
    tag: '05 • Modelo de Receita',
    tagColor: {
      dark: 'border-[#FF6B35]/40 text-[#FF6B35] bg-[#FF6B35]/15',
      light: 'border-[#FF6B35]/30 text-[#C84B1A] bg-[#FF6B35]/10',
    },
    title: 'Monetização clara e alinhada ao resultado',
    subtitle: 'O parceiro só paga por presença física individual confirmada. Risco zero e retorno tangível.',
    category: 'Modelo de Negócio',
  },
  {
    id: 7,
    tag: '06 • Estratégia de Entrada',
    tagColor: {
      dark: 'border-[#0077B6]/40 text-[#38BDF8] bg-[#0077B6]/20',
      light: 'border-[#0077B6]/30 text-[#0077B6] bg-[#0077B6]/10',
    },
    title: 'Foco inicial no Rio de Janeiro',
    subtitle: 'Expansão em três fases planejadas com metas pragmáticas e indicadores de validação rigorosos.',
    category: 'Go-To-Market',
  },
  {
    id: 8,
    tag: '07 • Conversa de Investimento',
    tagColor: {
      dark: 'border-[#0077B6]/40 text-[#38BDF8] bg-[#0077B6]/20',
      light: 'border-[#0077B6]/30 text-[#0077B6] bg-[#0077B6]/10',
    },
    title: 'Próximos passos e uso de recursos',
    subtitle: 'Alocação disciplinada de capital para validação do piloto e tração acelerada no mercado carioca.',
    category: 'Rodada & Contato',
  },
];

export function PitchDeckPage({ isDark, onToggleTheme, onNavigate }: PitchDeckPageProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [viewMode, setViewMode] = useState<'slides' | 'scroll'>('slides');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const downloadPptxUrl = '/BoraRio_Pitch_Deck_Investidores_Familiares.pptx';

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

  return (
    <div
      ref={containerRef}
      className={`min-h-screen ${
        isDark ? 'bg-[#07131F] text-slate-100' : 'bg-[#F8F5EF] text-[#102F46]'
      } flex flex-col font-sans transition-colors duration-200 selection:bg-[#FF6B35] selection:text-white`}
    >
      {/* Top Executive Header */}
      <header
        className={`sticky top-0 z-50 border-b backdrop-blur-xl ${
          isDark
            ? 'border-white/10 bg-[#07131F]/90 text-white'
            : 'border-[#E5DDD0] bg-white/95 text-[#102F46] shadow-xs'
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
            <div className={`hidden h-5 w-[1px] ${isDark ? 'bg-white/20' : 'bg-slate-300'} sm:block`} />
            <span
              className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold sm:inline-flex ${
                isDark
                  ? 'border-[#0077B6]/40 bg-[#0077B6]/15 text-[#38BDF8]'
                  : 'border-[#0077B6]/30 bg-[#0077B6]/10 text-[#0077B6]'
              }`}
            >
              <Sparkles className="h-3 w-3" /> Deck para Investidores Familiares
            </span>
          </div>

          {/* Center: Slide indicator (Presentation mode only) */}
          {viewMode === 'slides' && (
            <div className="hidden items-center gap-2 md:flex">
              <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Slide <span className={`font-bold ${isDark ? 'text-white' : 'text-[#102F46]'}`}>{currentSlide + 1}</span> de {SLIDES.length}
              </span>
              <div className="flex items-center gap-1">
                {SLIDES.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentSlide(idx)}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === currentSlide
                        ? 'w-6 bg-[#0077B6]'
                        : isDark
                        ? 'w-2 bg-slate-700 hover:bg-slate-500'
                        : 'w-2 bg-slate-300 hover:bg-slate-400'
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
            <div
              className={`flex rounded-lg border p-0.5 text-xs ${
                isDark ? 'border-white/10 bg-slate-800/60' : 'border-slate-300 bg-slate-100'
              }`}
            >
              <button
                type="button"
                onClick={() => setViewMode('slides')}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition ${
                  viewMode === 'slides'
                    ? 'bg-[#0077B6] text-white shadow-sm'
                    : isDark
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-600 hover:text-[#102F46]'
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
                    ? 'bg-[#0077B6] text-white shadow-sm'
                    : isDark
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-600 hover:text-[#102F46]'
                }`}
                title="Modo Leitura Contínua"
              >
                <ScrollText className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Documento</span>
              </button>
            </div>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Alternar tema"
              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                isDark
                  ? 'border-white/10 bg-slate-800/80 text-slate-300 hover:text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {isDark ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-[#123B56]" />}
            </button>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label="Tela cheia"
              className={`hidden sm:flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                isDark
                  ? 'border-white/10 bg-slate-800/80 text-slate-300 hover:text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
              title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            >
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Presentation progress bar */}
        {viewMode === 'slides' && (
          <div className={`h-1 w-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
            <div
              className="h-full bg-gradient-to-r from-[#0077B6] via-[#0284C7] to-[#FF6B35] transition-all duration-300"
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
                  ? 'border-white/10 bg-gradient-to-b from-[#0E2235]/95 to-[#07131F]/95 text-white shadow-2xl'
                  : 'border-[#E5DDD0] bg-white text-[#102F46] shadow-xl'
              } p-6 sm:p-10 lg:p-12 transition-all duration-300 min-h-[560px] flex flex-col justify-between`}
            >
              {/* Background ambient glow */}
              <div
                className={`pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full blur-3xl ${
                  isDark ? 'bg-[#0077B6]/15' : 'bg-[#0077B6]/8'
                }`}
              />
              <div
                className={`pointer-events-none absolute -bottom-20 -left-20 h-80 w-80 rounded-full blur-3xl ${
                  isDark ? 'bg-[#FF6B35]/15' : 'bg-[#FF6B35]/8'
                }`}
              />

              {/* Slide Body */}
              <div className="relative z-10 flex-1">
                {currentSlide === 0 && <Slide1Cover isDark={isDark} />}
                {currentSlide === 1 && <Slide2Opportunity isDark={isDark} />}
                {currentSlide === 2 && <Slide3Solution isDark={isDark} />}
                {currentSlide === 3 && <Slide4ProductJourney isDark={isDark} />}
                {currentSlide === 4 && <Slide5Differentiators isDark={isDark} />}
                {currentSlide === 5 && <Slide6BusinessModel isDark={isDark} />}
                {currentSlide === 6 && <Slide7GoToMarket isDark={isDark} />}
                {currentSlide === 7 && <Slide8Investment isDark={isDark} />}
              </div>

              {/* Slide Footer Info within the canvas */}
              <div
                className={`relative z-10 mt-8 flex flex-wrap items-center justify-between border-t pt-4 text-xs ${
                  isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-[#102F46]'}`}>
                    BoraRio
                  </span>
                  <span>•</span>
                  <span>Apresentação Executiva</span>
                  <span>•</span>
                  <span className="hidden sm:inline">Confidencial · Novembro 2026</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 font-mono text-[11px] ${
                      isDark
                        ? 'bg-slate-800 text-slate-300'
                        : 'bg-slate-100 text-[#102F46] font-semibold border border-slate-200'
                    }`}
                  >
                    Slide {currentSlide + 1} de {SLIDES.length}
                  </span>
                  <span className={`hidden sm:inline ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                    (Navegue com as setas ← e →)
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
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                currentSlide === 0
                  ? 'cursor-not-allowed opacity-30 text-slate-400 border-transparent'
                  : isDark
                  ? 'border-white/10 bg-slate-800/80 text-white hover:bg-slate-700 hover:border-slate-500'
                  : 'border-slate-300 bg-white text-[#102F46] hover:bg-slate-50 shadow-xs'
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
                      ? 'bg-[#0077B6] text-white shadow-md'
                      : isDark
                      ? 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-[#102F46]'
                  }`}
                  title={`${slide.id}. ${slide.category}`}
                >
                  <span>{idx + 1}</span>
                  <span className="ml-1 hidden lg:inline font-normal opacity-90">
                    · {slide.category}
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={nextSlide}
              disabled={currentSlide === SLIDES.length - 1}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                currentSlide === SLIDES.length - 1
                  ? 'cursor-not-allowed opacity-30 text-slate-400'
                  : 'bg-[#0077B6] text-white hover:bg-[#0284C7] hover:shadow-lg'
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
          <div
            className={`rounded-2xl border p-6 shadow-xl backdrop-blur-md ${
              isDark
                ? 'border-[#0077B6]/30 bg-gradient-to-r from-[#0E2235] via-[#102F46] to-[#07131F] text-white'
                : 'border-[#0077B6]/30 bg-gradient-to-r from-[#0077B6]/10 via-white to-white text-[#102F46]'
            }`}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                    isDark
                      ? 'border-[#0077B6]/40 bg-[#0077B6]/20 text-[#38BDF8]'
                      : 'border-[#0077B6]/40 bg-[#0077B6]/10 text-[#0077B6]'
                  }`}
                >
                  Documento Completo · 8 Slides
                </span>
                <h1 className={`mt-2 text-2xl font-black sm:text-3xl ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
                  BoraRio — Deck para Investidores Familiares
                </h1>
                <p className={`mt-1 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Visualização linear executiva do plano de negócios, oportunidade de mercado e modelo de receita.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={downloadPptxUrl}
                  download="BoraRio_Pitch_Deck_Investidores_Familiares.pptx"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0077B6] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#0284C7] shadow-sm"
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
                  ? 'border-white/10 bg-[#0E2235]/90 text-white shadow-2xl'
                  : 'border-[#E5DDD0] bg-white text-[#102F46] shadow-md'
              } p-6 sm:p-10 transition-all`}
            >
              <div
                className={`mb-6 flex items-center justify-between border-b pb-4 ${
                  isDark ? 'border-white/10' : 'border-slate-200'
                }`}
              >
                <span
                  className={`inline-block rounded-full border px-3 py-0.5 text-xs font-bold ${
                    isDark ? slide.tagColor.dark : slide.tagColor.light
                  }`}
                >
                  {slide.tag}
                </span>
                <span className={`font-mono text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Slide {slide.id} de {SLIDES.length}
                </span>
              </div>

              {idx === 0 && <Slide1Cover isDark={isDark} />}
              {idx === 1 && <Slide2Opportunity isDark={isDark} />}
              {idx === 2 && <Slide3Solution isDark={isDark} />}
              {idx === 3 && <Slide4ProductJourney isDark={isDark} />}
              {idx === 4 && <Slide5Differentiators isDark={isDark} />}
              {idx === 5 && <Slide6BusinessModel isDark={isDark} />}
              {idx === 6 && <Slide7GoToMarket isDark={isDark} />}
              {idx === 7 && <Slide8Investment isDark={isDark} />}
            </article>
          ))}

          {/* Bottom Action Card */}
          <div
            className={`rounded-2xl border p-8 text-center shadow-2xl ${
              isDark
                ? 'border-white/10 bg-gradient-to-b from-[#0E2235] to-[#07131F] text-white'
                : 'border-[#E5DDD0] bg-gradient-to-b from-white to-[#F8F5EF] text-[#102F46]'
            }`}
          >
            <h2 className="text-xl font-bold">Interessado em fazer parte do BoraRio?</h2>
            <p className={`mx-auto mt-2 max-w-xl text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Estamos estruturando a rodada inicial com parceiros e investidores familiares que compartilham nossa paixão pelo Rio.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <a
                href="mailto:contato@borario.com.br?subject=Conversa%20de%20Investimento%20-%20BoraRio"
                className="flex items-center gap-2 rounded-xl bg-[#0077B6] px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-[#0284C7]"
              >
                <Mail className="h-4 w-4" />
                <span>Falar com os Fundadores</span>
              </a>
              <button
                type="button"
                onClick={() => onNavigate('/app')}
                className={`flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-bold transition ${
                  isDark
                    ? 'border-white/20 bg-white/5 text-white hover:bg-white/10'
                    : 'border-slate-300 bg-white text-[#102F46] hover:bg-slate-50 shadow-xs'
                }`}
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
            : 'border-[#E5DDD0] bg-white text-slate-600'
        }`}
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between px-4 sm:px-6">
          <p>© 2026 BoraRio Tecnologia e Experiências Cariocas. Todos os direitos reservados.</p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="hover:text-[#0077B6] transition"
            >
              Início
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/parceiros')}
              className="hover:text-[#0077B6] transition"
            >
              Para Estabelecimentos
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/app')}
              className="hover:text-[#0077B6] transition"
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

// Slide 1: Capa & Proposta (Com foto Hero do Rio)
function Slide1Cover({ isDark }: { isDark: boolean }) {
  const heroImage = isDark ? rioHeroNight : rioHeroDay;

  return (
    <div className="flex flex-col gap-8 py-2">
      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
        {/* Left Column: Headline and Pillars */}
        <div className="flex flex-col text-left lg:col-span-7">
          <div
            className={`inline-flex w-fit items-center gap-2 rounded-full border px-3.5 py-1 text-xs font-semibold ${
              isDark
                ? 'border-[#0077B6]/40 bg-[#0077B6]/20 text-[#38BDF8]'
                : 'border-[#0077B6]/30 bg-[#0077B6]/10 text-[#0077B6]'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>BoraRio · Apresentação para Potenciais Investidores Familiares</span>
          </div>

          <h1
            className={`mt-4 text-3xl font-black tracking-tight sm:text-5xl ${
              isDark ? 'text-white' : 'text-[#102F46]'
            }`}
          >
            A cidade acontece.{' '}
            <span className="bg-gradient-to-r from-[#0077B6] via-[#0284C7] to-[#FF6B35] bg-clip-text text-transparent">
              Você aproveita.
            </span>
          </h1>

          <p className={`mt-3 text-base sm:text-lg ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Plataforma de experiências e vantagens em tempo real para a cidade do Rio de Janeiro.
          </p>

          {/* 3 Executive Pillars Highlights */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div
              className={`rounded-xl border p-3.5 ${
                isDark ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-slate-50 shadow-xs'
              }`}
            >
              <div className="flex items-center gap-1.5 text-[#0077B6]">
                <Compass className="h-4 w-4" />
                <span className="text-[11px] font-bold uppercase tracking-wider">O que é</span>
              </div>
              <p className={`mt-1.5 text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Superapp que conecta cariocas e visitantes aos melhores bares, restaurantes e atrações.
              </p>
            </div>

            <div
              className={`rounded-xl border p-3.5 ${
                isDark ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-slate-50 shadow-xs'
              }`}
            >
              <div className="flex items-center gap-1.5 text-[#FF6B35]">
                <Flame className="h-4 w-4" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Diferencial</span>
              </div>
              <p className={`mt-1.5 text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Oportunidades dinâmicas em horários de vale e fidelidade unificada Rio Points.
              </p>
            </div>

            <div
              className={`rounded-xl border p-3.5 ${
                isDark ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-slate-50 shadow-xs'
              }`}
            >
              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <Wallet className="h-4 w-4" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Modelo</span>
              </div>
              <p className={`mt-1.5 text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Presença real no salão: R$ 10 padrão / R$ 5 condição especial de lançamento.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Authentic Rio Hero Visual Banner with live overlay */}
        <div className="relative overflow-hidden rounded-2xl border border-white/20 shadow-xl lg:col-span-5 h-[280px] sm:h-[320px]">
          <img
            src={heroImage}
            alt="Rio de Janeiro - BoraRio"
            className="h-full w-full object-cover object-center transition duration-700 hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

          {/* Floating Pill: Rio Ao Vivo */}
          <div className="absolute top-3.5 left-3.5 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md border border-white/20">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Rio de Janeiro · Ao Vivo</span>
          </div>

          {/* Bottom Card: Live Pass preview */}
          <div className="absolute bottom-3.5 left-3.5 right-3.5 rounded-xl border border-white/20 bg-black/70 p-3 text-white backdrop-blur-md">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#FFB347]">🎟️ Passaporte BoraRio</span>
              <span className="rounded bg-[#0077B6] px-2 py-0.5 text-[10px] font-bold">Check-in QR Code</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-200">
              Presença verificada em salão. Validação individual para casais e grupos.
            </p>
          </div>
        </div>
      </div>

      <div
        className={`flex items-center justify-center gap-2 text-xs border-t pt-3 ${
          isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-600'
        }`}
      >
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
function Slide2Opportunity({ isDark }: { isDark: boolean }) {
  return (
    <div>
      <div className="mb-6">
        <span
          className={`rounded-full border px-3 py-0.5 text-xs font-bold ${
            isDark
              ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
              : 'border-amber-500/30 bg-amber-50 text-amber-700'
          }`}
        >
          01 • Oportunidade
        </span>
        <h2 className={`mt-2 text-2xl font-black tracking-tight sm:text-4xl ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
          O lazer no Rio ainda é fragmentado
        </h2>
        <p className={`mt-1 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          A fricção na jornada do consumidor e a ineficiência comercial dos estabelecimentos geram um enorme desperdício econômico na cidade.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* Para quem sai */}
        <div
          className={`flex flex-col justify-between rounded-xl border p-5 ${
            isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white shadow-sm'
          }`}
        >
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0077B6]/15 text-[#0077B6]">
                <Users className="h-5 w-5" />
              </div>
              <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-[#102F46]'}`}>Para quem sai</h3>
            </div>
            <p className="mt-3 text-xs font-semibold text-[#0077B6]">Dificuldade de decisão e incerteza</p>
            <ul className={`mt-3 space-y-2 text-xs sm:text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-[#0077B6] text-xs">▸</span>
                <span>Decidir onde ir exige abrir múltiplos apps, checar redes sociais e grupos de mensagens.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-[#0077B6] text-xs">▸</span>
                <span>Informações desencontradas sobre horário real de funcionamento, fila e lotação.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-[#0077B6] text-xs">▸</span>
                <span>Pouco reconhecimento: frequenta diversos locais sem nunca ser recompensado pela fidelidade à cidade.</span>
              </li>
            </ul>
          </div>
          <div
            className={`mt-4 rounded-lg p-2.5 text-[11px] border ${
              isDark
                ? 'bg-[#0077B6]/10 text-sky-200 border-[#0077B6]/30'
                : 'bg-[#0077B6]/10 text-[#0077B6] border-[#0077B6]/20 font-medium'
            }`}
          >
            Resultado: Decisão por inércia e perda de experiências autênticas.
          </div>
        </div>

        {/* Para quem oferece */}
        <div
          className={`flex flex-col justify-between rounded-xl border p-5 ${
            isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white shadow-sm'
          }`}
        >
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF6B35]/15 text-[#FF6B35]">
                <Building2 className="h-5 w-5" />
              </div>
              <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-[#102F46]'}`}>Para quem oferece</h3>
            </div>
            <p className="mt-3 text-xs font-semibold text-[#FF6B35]">Ociosidade e comissões abusivas</p>
            <ul className={`mt-3 space-y-2 text-xs sm:text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
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
          <div
            className={`mt-4 rounded-lg p-2.5 text-[11px] border ${
              isDark
                ? 'bg-orange-950/30 text-orange-200 border-orange-800/30'
                : 'bg-orange-50 text-orange-800 border-orange-200 font-medium'
            }`}
          >
            Resultado: Margem comprimida e dependência de intermediários tradicionais.
          </div>
        </div>

        {/* Para o mercado */}
        <div
          className={`flex flex-col justify-between rounded-xl border p-5 ${
            isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white shadow-sm'
          }`}
        >
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-[#102F46]'}`}>Para o mercado</h3>
            </div>
            <p className="mt-3 text-xs font-semibold text-amber-600 dark:text-amber-400">Potencial econômico subaproveitado</p>
            <ul className={`mt-3 space-y-2 text-xs sm:text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-amber-500 text-xs">▸</span>
                <span>O Rio tem vocação turística e gastronômica global, mas carece de uma infraestrutura digital unificada.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-amber-500 text-xs">▸</span>
                <span>Falta uma ponte ágil entre o que está acontecendo agora na cidade e quem está pronto para consumir.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 text-amber-500 text-xs">▸</span>
                <span>Demanda espontânea dispersa em redes sociais que não convertem em visitas reais ao salão.</span>
              </li>
            </ul>
          </div>
          <div
            className={`mt-4 rounded-lg p-2.5 text-[11px] border ${
              isDark
                ? 'bg-amber-950/30 text-amber-200 border-amber-800/30'
                : 'bg-amber-50 text-amber-800 border-amber-200 font-medium'
            }`}
          >
            Resultado: Um mercado multibilionário pronto para um player nativo focado em presença.
          </div>
        </div>
      </div>
    </div>
  );
}

// Slide 3: Solução (BoraRio: da descoberta à experiência)
function Slide3Solution({ isDark }: { isDark: boolean }) {
  return (
    <div>
      <div className="mb-6">
        <span
          className={`rounded-full border px-3 py-0.5 text-xs font-bold ${
            isDark
              ? 'border-[#0077B6]/40 bg-[#0077B6]/20 text-[#38BDF8]'
              : 'border-[#0077B6]/30 bg-[#0077B6]/10 text-[#0077B6]'
          }`}
        >
          02 • Solução
        </span>
        <h2 className={`mt-2 text-2xl font-black tracking-tight sm:text-4xl ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
          BoraRio: da descoberta à experiência
        </h2>
        <p className={`mt-1 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          O BoraRio não é apenas um guia: é um <strong className="text-[#0077B6]">motor de fluxo qualificado</strong> para os estabelecimentos e um <strong className="text-[#0077B6]">passaporte de vantagens</strong> para quem vive o Rio.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Descobrir */}
        <div
          className={`group rounded-xl border p-5 transition ${
            isDark
              ? 'border-white/10 bg-white/[0.03] hover:border-[#0077B6]/50'
              : 'border-slate-200 bg-white hover:border-[#0077B6] shadow-sm'
          }`}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0077B6]/15 text-[#0077B6] font-bold">
            1
          </div>
          <h3 className={`mt-3 text-base font-bold ${isDark ? 'text-white' : 'text-[#102F46]'}`}>Descobrir</h3>
          <p className="text-xs font-semibold text-[#0077B6]">Curadoria viva em tempo real</p>
          <p className={`mt-2 text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Gastronomia carioca, noites e eventos mapeados ao vivo por bairro e ocasião (Casal, Família, Galera ou Econômico).
          </p>
        </div>

        {/* 2. Aproveitar */}
        <div
          className={`group rounded-xl border p-5 transition ${
            isDark
              ? 'border-white/10 bg-white/[0.03] hover:border-[#FF6B35]/50'
              : 'border-slate-200 bg-white hover:border-[#FF6B35] shadow-sm'
          }`}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FF6B35]/15 text-[#FF6B35] font-bold">
            2
          </div>
          <h3 className={`mt-3 text-base font-bold ${isDark ? 'text-white' : 'text-[#102F46]'}`}>Aproveitar</h3>
          <p className="text-xs font-semibold text-[#FF6B35]">Oportunidades de verdade</p>
          <p className={`mt-2 text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Janelas curtas de benefício para horários específicos. Condições transparentes, sem pegadinhas nem regras confusas.
          </p>
        </div>

        {/* 3. Validar */}
        <div
          className={`group rounded-xl border p-5 transition ${
            isDark
              ? 'border-white/10 bg-white/[0.03] hover:border-[#0077B6]/50'
              : 'border-slate-200 bg-white hover:border-[#0077B6] shadow-sm'
          }`}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0077B6]/15 text-[#0077B6] font-bold">
            3
          </div>
          <h3 className={`mt-3 text-base font-bold ${isDark ? 'text-white' : 'text-[#102F46]'}`}>Validar</h3>
          <p className="text-xs font-semibold text-[#0077B6]">Check-in individual verificado</p>
          <p className={`mt-2 text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Presença física confirmada no local via QR Code. Cada integrante do grupo valida sua própria visita no app.
          </p>
        </div>

        {/* 4. Recompensar */}
        <div
          className={`group rounded-xl border p-5 transition ${
            isDark
              ? 'border-white/10 bg-white/[0.03] hover:border-amber-500/50'
              : 'border-slate-200 bg-white hover:border-amber-500 shadow-sm'
          }`}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold">
            4
          </div>
          <h3 className={`mt-3 text-base font-bold ${isDark ? 'text-white' : 'text-[#102F46]'}`}>Recompensar</h3>
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">Rio Points em circulação</p>
          <p className={`mt-2 text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Pontos acumulados a cada visita que podem ser trocados em benefícios por toda a rede de parceiros cariocas.
          </p>
        </div>
      </div>

      <div
        className={`mt-6 rounded-xl border p-4 text-center ${
          isDark
            ? 'border-[#0077B6]/30 bg-[#0077B6]/10 text-sky-200'
            : 'border-[#0077B6]/20 bg-[#0077B6]/5 text-[#102F46]'
        }`}
      >
        <p className="text-xs font-medium sm:text-sm">
          💡 <strong>O ciclo virtuoso:</strong> Descoberta qualificada gera visita real → Check-in gera receita para a plataforma e dados para o parceiro → Recompensa estimula a próxima experiência na cidade.
        </p>
      </div>
    </div>
  );
}

// Slide 4: Produto e Jornada do Usuário (Com Mockup Interativo do App)
function Slide4ProductJourney({ isDark }: { isDark: boolean }) {
  const steps = [
    {
      num: '1',
      title: 'Descobre',
      desc: 'Abre o app e vê o que está acontecendo por perto agora com curadoria viva.',
      icon: Compass,
      color: 'text-[#0077B6] bg-[#0077B6]/10 border-[#0077B6]/30',
    },
    {
      num: '2',
      title: 'Ativa',
      desc: 'Escolhe a oportunidade com condições, janela de horário e tamanho do grupo.',
      icon: Target,
      color: 'text-[#FF6B35] bg-[#FF6B35]/10 border-[#FF6B35]/30',
    },
    {
      num: '3',
      title: 'Comparece',
      desc: 'Cada pessoa do grupo valida presença individualmente via QR Code na mesa.',
      icon: QrCode,
      color: 'text-[#0077B6] bg-[#0077B6]/10 border-[#0077B6]/30',
    },
    {
      num: '4',
      title: 'Acumula',
      desc: 'Ganha Rio Points imediatos pela visita individual confirmada no salão.',
      icon: Award,
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    },
    {
      num: '5',
      title: 'Resgata',
      desc: 'Usa os pontos em drinks cortesia, sobremesas ou novas visitas na rede.',
      icon: Wallet,
      color: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
    },
  ];

  return (
    <div>
      <div className="mb-4">
        <span
          className={`rounded-full border px-3 py-0.5 text-xs font-bold ${
            isDark
              ? 'border-[#0077B6]/40 bg-[#0077B6]/20 text-[#38BDF8]'
              : 'border-[#0077B6]/30 bg-[#0077B6]/10 text-[#0077B6]'
          }`}
        >
          03 • Produto
        </span>
        <h2 className={`mt-2 text-2xl font-black tracking-tight sm:text-4xl ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
          Uma jornada simples em 5 passos
        </h2>
        <p className={`mt-1 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          Criamos um fluxo direto e sem atrito, pensado para o ritmo da cidade e a rotina de um salão de restaurante.
        </p>
      </div>

      <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
        {/* Left: 5 Steps */}
        <div className="space-y-2.5 lg:col-span-7">
          {steps.map((st) => {
            const Icon = st.icon;
            return (
              <div
                key={st.num}
                className={`flex items-start gap-3 rounded-xl border p-3 transition ${
                  isDark
                    ? 'border-white/10 bg-white/[0.03] hover:border-white/30'
                    : 'border-slate-200 bg-white hover:border-[#0077B6] shadow-xs'
                }`}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${st.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#0077B6]">PASSO 0{st.num}</span>
                    <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-[#102F46]'}`}>{st.title}</h3>
                  </div>
                  <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{st.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Mocked Smartphone UI Frame of BoraRio */}
        <div className="flex justify-center lg:col-span-5">
          <div
            className={`w-full max-w-[290px] rounded-3xl border-4 p-3 shadow-2xl ${
              isDark ? 'border-slate-700 bg-slate-900 text-white' : 'border-slate-300 bg-white text-[#102F46]'
            }`}
          >
            {/* Phone Speaker & Camera Notch */}
            <div className="mx-auto mb-2.5 h-3.5 w-24 rounded-full bg-slate-800" />

            {/* Mocked Header */}
            <div className="flex items-center justify-between border-b pb-2 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="flex h-5 w-5 items-center justify-center rounded bg-[#FF6B35] text-white font-black text-[10px]">
                  B
                </div>
                <span className="font-bold text-xs">BoraRio</span>
              </div>
              <span className="rounded-full bg-[#0077B6]/15 px-2 py-0.5 text-[10px] font-bold text-[#0077B6]">
                ⭐ 1.250 RP
              </span>
            </div>

            {/* Mocked Live Opportunity Card */}
            <div className="mt-2.5 rounded-xl border border-[#FF6B35]/30 bg-gradient-to-br from-[#FF6B35]/10 to-transparent p-2.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-bold text-[#FF6B35]">🔥 AO VIVO AGORA</span>
                <span className="text-slate-500">Válido até 21h30</span>
              </div>
              <div className="mt-1 font-bold text-xs">Bar Urca · Pôr do Sol</div>
              <p className="mt-0.5 text-[10px] text-slate-500">2 Chopes + Bolinhos de Bacalhau por R$ 38</p>
              <div className="mt-2 flex items-center justify-between rounded bg-white/10 dark:bg-black/30 p-1.5 text-[10px]">
                <span>Mesa 04 · Seu Grupo:</span>
                <span className="font-bold text-[#0077B6]">2 de 4 Validados</span>
              </div>
            </div>

            {/* Mocked QR Code Check-in Status */}
            <div className="mt-2.5 rounded-xl border border-[#0077B6]/30 bg-[#0077B6]/10 p-2 text-center">
              <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-[#0077B6]">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#0077B6]" />
                <span>Check-in Validado!</span>
              </div>
              <p className="mt-0.5 text-[9px] text-slate-500">
                +250 Rio Points creditados na sua carteira.
              </p>
            </div>

            {/* Bottom Nav pill */}
            <div className="mt-3 flex justify-around border-t pt-2 text-[9px] text-slate-400">
              <span className="font-bold text-[#0077B6]">Explorar</span>
              <span>Desejos</span>
              <span>Carteira</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Slide 5: Diferenciais Competitivos
function Slide5Differentiators({ isDark }: { isDark: boolean }) {
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
      color: 'text-[#0077B6]',
    },
    {
      title: 'Fidelização Cruzada entre Parceiros',
      desc: 'Pontos ganhos em um almoço tradicional na Tijuca podem ser usados em um rooftop no Leblon. O ecossistema inteiro estimula a circulação pela cidade.',
      icon: RotateCcw,
      color: 'text-[#0077B6]',
    },
    {
      title: 'Demanda Controlada pelo Parceiro',
      desc: 'O estabelecimento define estoque, horários de ativação e regras, sem cláusulas abusivas nem aprisionamento a descontos insustentáveis.',
      icon: Building2,
      color: 'text-amber-600 dark:text-amber-400',
    },
    {
      title: 'Inteligência Transversal Bora IA',
      desc: 'IA nativa que compreende contexto de clima, bairro e momento social para sugerir roteiros personalizados e maximizar a conversão das ofertas.',
      icon: Sparkles,
      color: 'text-purple-600 dark:text-purple-400',
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <span
          className={`rounded-full border px-3 py-0.5 text-xs font-bold ${
            isDark
              ? 'border-purple-500/40 bg-purple-500/15 text-purple-300'
              : 'border-purple-500/30 bg-purple-50 text-purple-700'
          }`}
        >
          04 • Diferenciais
        </span>
        <h2 className={`mt-2 text-2xl font-black tracking-tight sm:text-4xl ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
          Por que o BoraRio é diferente
        </h2>
        <p className={`mt-1 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          Construímos um modelo que corrige as principais dores dos velhos clubes de desconto e guias estáticos.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={i}
              className={`rounded-xl border p-4 text-left transition ${
                isDark
                  ? 'border-white/10 bg-white/[0.03] hover:border-white/30'
                  : 'border-slate-200 bg-white hover:border-[#0077B6] shadow-sm'
              } ${i === 4 ? 'sm:col-span-2 lg:col-span-1' : ''}`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`h-5 w-5 ${item.color}`} />
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-[#102F46]'}`}>{item.title}</h3>
              </div>
              <p className={`mt-2 text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {item.desc}
              </p>
            </div>
          );
        })}
      </div>

      <div
        className={`mt-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-xs ${
          isDark
            ? 'border-purple-500/30 bg-purple-950/20 text-purple-200'
            : 'border-purple-200 bg-purple-50 text-purple-900 font-medium'
        }`}
      >
        <span><strong>Guias Clássicos:</strong> Anúncios fixos caros e sem métrica de conversão.</span>
        <span><strong>Clubes de Cupons:</strong> Descontos predatórios que atraem caçadores de preço único.</span>
        <span className="font-bold text-[#0077B6]"><strong>BoraRio:</strong> Performance real e fidelidade unificada.</span>
      </div>
    </div>
  );
}

// Slide 6: Modelo de Receita (Monetização clara e alinhada ao resultado)
function Slide6BusinessModel({ isDark }: { isDark: boolean }) {
  return (
    <div>
      <div className="mb-6">
        <span
          className={`rounded-full border px-3 py-0.5 text-xs font-bold ${
            isDark
              ? 'border-[#FF6B35]/40 bg-[#FF6B35]/15 text-[#FF6B35]'
              : 'border-[#FF6B35]/30 bg-[#FF6B35]/10 text-[#C84B1A]'
          }`}
        >
          05 • Modelo de Receita
        </span>
        <h2 className={`mt-2 text-2xl font-black tracking-tight sm:text-4xl ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
          Monetização clara e alinhada ao resultado
        </h2>
        <p className={`mt-1 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          Modelo simples de explicar, fácil de auditar e 100% atrelado a quem efetivamente sentou à mesa.
        </p>
      </div>

      {/* 3 Core Pricing Pillars */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Tarifa Padrão */}
        <div
          className={`rounded-xl border p-5 text-left ${
            isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white shadow-sm'
          }`}
        >
          <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Tarifa Operacional Padrão
          </span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className={`text-3xl font-black ${isDark ? 'text-white' : 'text-[#102F46]'}`}>R$ 10,00</span>
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>/ check-in individual</span>
          </div>
          <p className={`mt-3 text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Cobrado do estabelecimento exclusivamente por pessoa com visita validada no salão.
          </p>
          <div className={`mt-4 border-t pt-3 text-[11px] ${isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-600'}`}>
            ✓ Sem taxa fixa mensal<br />
            ✓ Sem cobrança por reserva cancelada<br />
            ✓ Sem surpresas na fatura
          </div>
        </div>

        {/* Condição de Lançamento */}
        <div
          className={`relative rounded-xl border-2 p-5 text-left shadow-lg ${
            isDark
              ? 'border-[#0077B6] bg-[#0077B6]/15'
              : 'border-[#0077B6] bg-[#0077B6]/5 shadow-blue-500/10'
          }`}
        >
          <span className="absolute -top-2.5 right-4 rounded-full bg-[#0077B6] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
            50% OFF · Early Adopters
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#0077B6]">
            Condição Especial de Lançamento
          </span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-black text-[#0077B6]">R$ 5,00</span>
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>/ check-in individual</span>
          </div>
          <p className={`mt-3 text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Para acelerar a adesão dos primeiros parceiros durante a fase de piloto e lançamento oficial no Rio.
          </p>
          <div
            className={`mt-4 border-t pt-3 text-[11px] ${
              isDark ? 'border-[#0077B6]/30 text-sky-200' : 'border-[#0077B6]/30 text-[#0077B6] font-medium'
            }`}
          >
            ✓ Reduz a barreira para 100% dos parceiros<br />
            ✓ Estímulo rápido à densidade de catálogo<br />
            ✓ Válido para os primeiros 200 cadastrados
          </div>
        </div>

        {/* Recompensas & Circulação */}
        <div
          className={`rounded-xl border p-5 text-left ${
            isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white shadow-sm'
          }`}
        >
          <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Circulação de Recompensas
          </span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className={`text-3xl font-black ${isDark ? 'text-white' : 'text-[#102F46]'}`}>0%</span>
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>comissão em resgates</span>
          </div>
          <p className={`mt-3 text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            O parceiro oferece recompensas (cortesias/benefícios) sem pagar taxa percentual ao BoraRio no resgate de Rio Points.
          </p>
          <div className={`mt-4 border-t pt-3 text-[11px] ${isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-600'}`}>
            ✓ Custo sob controle do próprio parceiro<br />
            ✓ Incentiva a oferta de benefícios reais<br />
            ✓ Fideliza clientes sem intermediários
          </div>
        </div>
      </div>

      {/* Simulation Table: Pessoas x Custo */}
      <div
        className={`mt-5 overflow-hidden rounded-xl border ${
          isDark ? 'border-white/10 bg-slate-900/60' : 'border-slate-200 bg-white shadow-xs'
        }`}
      >
        <div
          className={`border-b px-4 py-2 text-xs font-bold ${
            isDark ? 'border-white/10 bg-slate-800/60 text-slate-200' : 'border-slate-200 bg-slate-50 text-[#102F46]'
          }`}
        >
          Simulação de Receita por Mesa / Grupo de Amigos
        </div>
        <div
          className={`grid grid-cols-4 divide-x p-3 text-center text-xs ${
            isDark ? 'divide-white/10' : 'divide-slate-200'
          }`}
        >
          <div>
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Pessoas Validadas</span>
            <div className={`mt-1 font-bold ${isDark ? 'text-white' : 'text-[#102F46]'}`}>1 Pessoa</div>
            <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Lançamento: <strong className="text-[#0077B6]">R$ 5</strong> | Padrão: <strong>R$ 10</strong>
            </div>
          </div>
          <div>
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Casal</span>
            <div className={`mt-1 font-bold ${isDark ? 'text-white' : 'text-[#102F46]'}`}>2 Pessoas</div>
            <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Lançamento: <strong className="text-[#0077B6]">R$ 10</strong> | Padrão: <strong>R$ 20</strong>
            </div>
          </div>
          <div>
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Grupo Amigos</span>
            <div className={`mt-1 font-bold ${isDark ? 'text-white' : 'text-[#102F46]'}`}>4 Pessoas</div>
            <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Lançamento: <strong className="text-[#0077B6]">R$ 20</strong> | Padrão: <strong>R$ 40</strong>
            </div>
          </div>
          <div>
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Mesa Grande</span>
            <div className={`mt-1 font-bold ${isDark ? 'text-white' : 'text-[#102F46]'}`}>6 Pessoas</div>
            <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Lançamento: <strong className="text-[#0077B6]">R$ 30</strong> | Padrão: <strong>R$ 60</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Slide 7: Estratégia de Entrada (Com Foto Hero do Rio & Fases)
function Slide7GoToMarket({ isDark }: { isDark: boolean }) {
  const heroImage = isDark ? rioHeroNight : rioHeroDay;

  return (
    <div>
      <div className="mb-4">
        <span
          className={`rounded-full border px-3 py-0.5 text-xs font-bold ${
            isDark
              ? 'border-[#0077B6]/40 bg-[#0077B6]/20 text-[#38BDF8]'
              : 'border-[#0077B6]/30 bg-[#0077B6]/10 text-[#0077B6]'
          }`}
        >
          06 • Estratégia de Entrada
        </span>
        <h2 className={`mt-2 text-2xl font-black tracking-tight sm:text-4xl ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
          Foco inicial no Rio de Janeiro
        </h2>
        <p className={`mt-1 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          Estratégia de expansão hiperlocal em três etapas sequenciais e focadas em densidade territorial.
        </p>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12">
        {/* Left: 3 Phases */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:col-span-8">
          {/* Fase 1: Piloto */}
          <div
            className={`rounded-xl border p-4 text-left flex flex-col justify-between ${
              isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white shadow-xs'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded bg-[#0077B6]/20 px-2 py-0.5 text-[10px] font-bold text-[#0077B6]">
                  Meses 1 - 2
                </span>
                <span className="text-[10px] font-mono text-slate-500">FASE 1</span>
              </div>
              <h3 className={`mt-2.5 text-base font-bold ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
                Piloto Controlado
              </h3>
              <p className="mt-1 text-xs text-[#0077B6] font-semibold">30 a 50 estabelecimentos</p>
              <ul className={`mt-2.5 space-y-1.5 text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                <li>• Zona Sul (Leblon, Ipanema, Botafogo) e Barra da Tijuca.</li>
                <li>• Treinamento de garçons e hostess no fluxo de QR Code.</li>
                <li>• 1.000 usuários beta ativos.</li>
              </ul>
            </div>
          </div>

          {/* Fase 2: Lançamento */}
          <div
            className={`rounded-xl border-2 p-4 text-left flex flex-col justify-between ${
              isDark
                ? 'border-[#0077B6] bg-[#0077B6]/15'
                : 'border-[#0077B6] bg-[#0077B6]/5 shadow-sm'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded bg-[#0077B6] px-2 py-0.5 text-[10px] font-bold text-white">
                  Meses 3 - 6
                </span>
                <span className="text-[10px] font-mono text-[#0077B6] font-bold">FASE 2</span>
              </div>
              <h3 className={`mt-2.5 text-base font-bold ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
                Lançamento Oficial
              </h3>
              <p className="mt-1 text-xs text-[#0077B6] font-semibold">150 a 200 estabelecimentos</p>
              <ul className={`mt-2.5 space-y-1.5 text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                <li>• Tarifa promocional de R$ 5,00 por check-in.</li>
                <li>• 10.000 usuários ativos e 5.000 check-ins/mês.</li>
                <li>• Parcerias com criadores cariocas.</li>
              </ul>
            </div>
          </div>

          {/* Fase 3: Escala */}
          <div
            className={`rounded-xl border p-4 text-left flex flex-col justify-between ${
              isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white shadow-xs'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-400">
                  Meses 7 - 12
                </span>
                <span className="text-[10px] font-mono text-slate-500">FASE 3</span>
              </div>
              <h3 className={`mt-2.5 text-base font-bold ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
                Escala Carioca
              </h3>
              <p className="mt-1 text-xs text-purple-600 dark:text-purple-400 font-semibold">300+ estabelecimentos</p>
              <ul className={`mt-2.5 space-y-1.5 text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                <li>• Expansão para Tijuca, Centro/Lapa e Niterói.</li>
                <li>• Integração com hotelaria e turismo.</li>
                <li>• Rio Points como moeda de lazer da cidade.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right: Rio Map & Territory Visual Card */}
        <div className="relative overflow-hidden rounded-xl border border-white/20 shadow-md lg:col-span-4 min-h-[190px]">
          <img
            src={heroImage}
            alt="Expansão Rio de Janeiro"
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20" />
          <div className="absolute inset-0 p-3.5 flex flex-col justify-between text-white">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#FFB347]">
              <MapPin className="h-4 w-4" />
              <span>Polos de Densidade Rio</span>
            </div>
            <div className="space-y-1 text-[11px] text-slate-200">
              <div className="flex items-center justify-between">
                <span>Zona Sul (Leblon, Ipanema)</span>
                <span className="font-bold text-[#38BDF8]">Fase 1</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Barra da Tijuca & Botafogo</span>
                <span className="font-bold text-[#38BDF8]">Fase 1</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Tijuca, Centro, Lapa & Niterói</span>
                <span className="font-bold text-[#FFB347]">Fases 2-3</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5 KPIs */}
      <div
        className={`mt-4 rounded-xl border p-3.5 ${
          isDark ? 'border-white/10 bg-slate-900/60' : 'border-slate-200 bg-white shadow-xs'
        }`}
      >
        <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Indicadores-Chave de Sucesso (KPIs de Acompanhamento)
        </span>
        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-5 text-center text-xs">
          <div className={`rounded-lg p-2 ${isDark ? 'bg-slate-800/60' : 'bg-slate-50 border border-slate-200'}`}>
            <span className={`block text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Transacional</span>
            <strong className={isDark ? 'text-white' : 'text-[#102F46]'}>Check-ins / mês</strong>
          </div>
          <div className={`rounded-lg p-2 ${isDark ? 'bg-slate-800/60' : 'bg-slate-50 border border-slate-200'}`}>
            <span className={`block text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Saúde B2B</span>
            <strong className={isDark ? 'text-white' : 'text-[#102F46]'}>Retenção Parceiros</strong>
          </div>
          <div className={`rounded-lg p-2 ${isDark ? 'bg-slate-800/60' : 'bg-slate-50 border border-slate-200'}`}>
            <span className={`block text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Eficiência</span>
            <strong className={isDark ? 'text-white' : 'text-[#102F46]'}>CAC por Usuário</strong>
          </div>
          <div className={`rounded-lg p-2 ${isDark ? 'bg-slate-800/60' : 'bg-slate-50 border border-slate-200'}`}>
            <span className={`block text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Engajamento</span>
            <strong className={isDark ? 'text-white' : 'text-[#102F46]'}>Giro Rio Points</strong>
          </div>
          <div className={`rounded-lg p-2 ${isDark ? 'bg-slate-800/60' : 'bg-slate-50 border border-slate-200'}`}>
            <span className={`block text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Qualidade</span>
            <strong className={isDark ? 'text-white' : 'text-[#102F46]'}>NPS B2B & B2C</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

// Slide 8: Conversa de Investimento & Próximos Passos
function Slide8Investment({ isDark }: { isDark: boolean }) {
  const downloadPptxUrl = '/BoraRio_Pitch_Deck_Investidores_Familiares.pptx';

  return (
    <div>
      <div className="mb-6">
        <span
          className={`rounded-full border px-3 py-0.5 text-xs font-bold ${
            isDark
              ? 'border-[#0077B6]/40 bg-[#0077B6]/20 text-[#38BDF8]'
              : 'border-[#0077B6]/30 bg-[#0077B6]/10 text-[#0077B6]'
          }`}
        >
          07 • Conversa de Investimento
        </span>
        <h2 className={`mt-2 text-2xl font-black tracking-tight sm:text-4xl ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
          Próximos passos e uso de recursos
        </h2>
        <p className={`mt-1 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          Estrutura enxuta voltada para comprovar unit economics e criar uma máquina de tração sustentável.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Destinação do Capital */}
        <div
          className={`rounded-xl border p-5 text-left ${
            isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white shadow-sm'
          }`}
        >
          <div className="flex items-center gap-2 text-[#0077B6]">
            <Target className="h-5 w-5" />
            <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
              O capital será direcionado para:
            </h3>
          </div>
          <ul className={`mt-4 space-y-2.5 text-xs sm:text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#0077B6] shrink-0 mt-0.5" />
              <span><strong>Finalização técnica e segurança:</strong> estabilidade de infraestrutura, QR Code anti-fraude e geolocalização precisa.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#0077B6] shrink-0 mt-0.5" />
              <span><strong>Aquisição e onboarding de parceiros:</strong> equipe de campo dedicada aos primeiros 50 estabelecimentos chave.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#0077B6] shrink-0 mt-0.5" />
              <span><strong>Marketing de lançamento:</strong> campanhas focadas em comunidades locais, embaixadores e microinfluenciadores no Rio.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#0077B6] shrink-0 mt-0.5" />
              <span><strong>Capital de giro operacional:</strong> sustentação dos primeiros 6 meses até atingimento do breakeven do piloto.</span>
            </li>
          </ul>
        </div>

        {/* Marco de Validação e Proposta */}
        <div
          className={`flex flex-col justify-between rounded-xl border p-5 text-left ${
            isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white shadow-sm'
          }`}
        >
          <div>
            <div
              className={`rounded-lg border p-3.5 ${
                isDark
                  ? 'border-amber-500/30 bg-amber-500/10'
                  : 'border-amber-200 bg-amber-50'
              }`}
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Marco de Validação Inicial (90 dias)
              </span>
              <p className={`mt-1 text-sm font-semibold ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
                5.000 check-ins validados e 50 estabelecimentos ativos com recorrência comprovada no Rio.
              </p>
            </div>

            <div className="mt-4">
              <h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
                Proposta para a conversa:
              </h4>
              <p className={`mt-1 text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Rodada inicial com investidores familiares e anjos estratégicos para viabilizar o piloto e a tração inicial. Termos abertos para diálogo amigável e alinhado aos interesses de longo prazo.
              </p>
            </div>
          </div>

          {/* Founder contact and CTAs */}
          <div
            className={`mt-5 rounded-xl border p-4 ${
              isDark ? 'border-white/10 bg-slate-800/80' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
                  Contato dos Fundadores
                </span>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  contato@borario.com.br · Rio de Janeiro, RJ
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={downloadPptxUrl}
                  download="BoraRio_Pitch_Deck_Investidores_Familiares.pptx"
                  className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition flex items-center gap-1 ${
                    isDark
                      ? 'border-white/20 text-slate-200 hover:bg-white/10'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Download className="h-3 w-3" />
                  <span>PPTX</span>
                </a>
                <a
                  href="mailto:contato@borario.com.br?subject=Conversa%20de%20Investimento%20-%20BoraRio"
                  className="rounded-lg bg-[#0077B6] px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#0284C7] shadow-sm flex items-center gap-1"
                >
                  <Mail className="h-3 w-3" />
                  <span>Iniciar Conversa</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`mt-6 text-center text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
        “Vamos construir juntos a próxima referência em experiências e gastronomia no Rio de Janeiro?”
      </div>
    </div>
  );
}
