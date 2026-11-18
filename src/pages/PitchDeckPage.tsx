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
      dark: 'border-[#0077B6]/50 text-[#38BDF8] bg-[#0077B6]/20',
      light: 'border-[#0077B6]/40 text-[#005B8C] bg-[#0077B6]/15',
    },
    title: 'A cidade acontece. Você aproveita.',
    subtitle: 'Plataforma de experiências e vantagens em tempo real para a cidade do Rio de Janeiro.',
    category: 'Capa & Proposta',
  },
  {
    id: 2,
    tag: '01 • Oportunidade',
    tagColor: {
      dark: 'border-amber-500/50 text-amber-300 bg-amber-500/20',
      light: 'border-amber-600/40 text-amber-900 bg-amber-100',
    },
    title: 'O lazer no Rio ainda é fragmentado',
    subtitle: 'Como a falta de um elo digital integrado prejudica quem sai, quem oferece e o ecossistema carioca.',
    category: 'Problema & Mercado',
  },
  {
    id: 3,
    tag: '02 • Solução',
    tagColor: {
      dark: 'border-[#0077B6]/50 text-[#38BDF8] bg-[#0077B6]/20',
      light: 'border-[#0077B6]/40 text-[#005B8C] bg-[#0077B6]/15',
    },
    title: 'BoraRio: da descoberta à experiência',
    subtitle: 'Motor de fluxo qualificado para os estabelecimentos e passaporte de vantagens para quem vive o Rio.',
    category: 'Proposta de Valor',
  },
  {
    id: 4,
    tag: '03 • Produto',
    tagColor: {
      dark: 'border-[#0077B6]/50 text-[#38BDF8] bg-[#0077B6]/20',
      light: 'border-[#0077B6]/40 text-[#005B8C] bg-[#0077B6]/15',
    },
    title: 'Uma jornada simples em 5 passos',
    subtitle: 'Experiência fluida e intuitiva desenhada para eliminar atritos em salão e gerar valor imediato.',
    category: 'Jornada do Usuário',
  },
  {
    id: 5,
    tag: '04 • Diferenciais',
    tagColor: {
      dark: 'border-purple-500/50 text-purple-300 bg-purple-500/20',
      light: 'border-purple-600/40 text-purple-900 bg-purple-100',
    },
    title: 'Por que o BoraRio é diferente',
    subtitle: 'Vantagens competitivas estruturais frente a guias tradicionais e cupons promocionais ultrapassados.',
    category: 'Vantagem Competitiva',
  },
  {
    id: 6,
    tag: '05 • Modelo de Receita',
    tagColor: {
      dark: 'border-[#FF6B35]/50 text-[#FF6B35] bg-[#FF6B35]/20',
      light: 'border-[#FF6B35]/40 text-[#B83E12] bg-[#FF6B35]/15',
    },
    title: 'Monetização clara e alinhada ao resultado',
    subtitle: 'O parceiro só paga por presença física individual confirmada. Risco zero e retorno tangível.',
    category: 'Modelo de Negócio',
  },
  {
    id: 7,
    tag: '06 • Estratégia de Entrada',
    tagColor: {
      dark: 'border-[#0077B6]/50 text-[#38BDF8] bg-[#0077B6]/20',
      light: 'border-[#0077B6]/40 text-[#005B8C] bg-[#0077B6]/15',
    },
    title: 'Foco inicial no Rio de Janeiro',
    subtitle: 'Expansão em três fases planejadas com metas pragmáticas e indicadores de validação rigorosos.',
    category: 'Go-To-Market',
  },
  {
    id: 8,
    tag: '07 • Conversa de Investimento',
    tagColor: {
      dark: 'border-[#0077B6]/50 text-[#38BDF8] bg-[#0077B6]/20',
      light: 'border-[#0077B6]/40 text-[#005B8C] bg-[#0077B6]/15',
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
      {/* Top Executive Header - Full Widescreen Width */}
      <header
        className={`sticky top-0 z-50 border-b backdrop-blur-xl ${
          isDark
            ? 'border-white/10 bg-[#07131F]/95 text-white'
            : 'border-[#E5DDD0] bg-white/95 text-[#102F46] shadow-xs'
        }`}
      >
        <div className="mx-auto flex w-full max-w-[1720px] items-center justify-between px-4 py-3 sm:px-8">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="text-left transition hover:opacity-80 focus:outline-none"
              title="Voltar à página inicial"
            >
              <BrandLogo variant="horizontal" size="sm" onDark={isDark} />
            </button>
            <div className={`hidden h-6 w-[1px] ${isDark ? 'bg-white/20' : 'bg-slate-300'} sm:block`} />
            <span
              className={`hidden items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold sm:inline-flex ${
                isDark
                  ? 'border-[#0077B6]/50 bg-[#0077B6]/20 text-[#38BDF8]'
                  : 'border-[#0077B6]/40 bg-[#0077B6]/15 text-[#005B8C]'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" /> Deck para Investidores Familiares
            </span>
          </div>

          {/* Center: Slide indicator (Presentation mode only) */}
          {viewMode === 'slides' && (
            <div className="hidden items-center gap-3 md:flex">
              <span className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Slide <span className={`font-black ${isDark ? 'text-white' : 'text-[#102F46]'}`}>{currentSlide + 1}</span> de {SLIDES.length}
              </span>
              <div className="flex items-center gap-1.5">
                {SLIDES.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentSlide(idx)}
                    className={`h-2 rounded-full transition-all ${
                      idx === currentSlide
                        ? 'w-7 bg-[#0077B6]'
                        : isDark
                        ? 'w-2.5 bg-slate-700 hover:bg-slate-500'
                        : 'w-2.5 bg-slate-300 hover:bg-slate-400'
                    }`}
                    title={`Ir para slide ${idx + 1}: ${SLIDES[idx].category}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Right: Clean View Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* View Mode Toggle */}
            <div
              className={`flex rounded-xl border p-1 text-xs sm:text-sm font-semibold ${
                isDark ? 'border-white/10 bg-slate-800/80' : 'border-slate-300 bg-slate-100'
              }`}
            >
              <button
                type="button"
                onClick={() => setViewMode('slides')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                  viewMode === 'slides'
                    ? 'bg-[#0077B6] text-white shadow-sm font-bold'
                    : isDark
                    ? 'text-slate-300 hover:text-white'
                    : 'text-slate-700 hover:text-[#102F46]'
                }`}
                title="Modo Apresentação Slide a Slide"
              >
                <Tv className="h-4 w-4" />
                <span className="hidden sm:inline">Apresentação</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('scroll')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                  viewMode === 'scroll'
                    ? 'bg-[#0077B6] text-white shadow-sm font-bold'
                    : isDark
                    ? 'text-slate-300 hover:text-white'
                    : 'text-slate-700 hover:text-[#102F46]'
                }`}
                title="Modo Leitura Contínua"
              >
                <ScrollText className="h-4 w-4" />
                <span className="hidden sm:inline">Documento</span>
              </button>
            </div>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Alternar tema"
              className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                isDark
                  ? 'border-white/10 bg-slate-800/80 text-slate-300 hover:text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-xs'
              }`}
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-[#123B56]" />}
            </button>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label="Tela cheia"
              className={`hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                isDark
                  ? 'border-white/10 bg-slate-800/80 text-slate-300 hover:text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-xs'
              }`}
              title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Presentation progress bar */}
        {viewMode === 'slides' && (
          <div className={`h-1.5 w-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
            <div
              className="h-full bg-gradient-to-r from-[#0077B6] via-[#0284C7] to-[#FF6B35] transition-all duration-300"
              style={{ width: `${((currentSlide + 1) / SLIDES.length) * 100}%` }}
            />
          </div>
        )}
      </header>

      {/* Main Content Area - Expansive Desktop Layout */}
      {viewMode === 'slides' ? (
        /* =================== SLIDE-BY-SLIDE PRESENTATION MODE =================== */
        <main className="relative flex flex-1 flex-col justify-between overflow-hidden px-3 sm:px-6 lg:px-8 xl:px-12 py-3 sm:py-5">
          {/* Active Slide Canvas - Widescreen Full Width Container */}
          <div className="mx-auto flex w-full max-w-[1720px] flex-1 flex-col justify-center">
            <div
              className={`relative overflow-hidden rounded-3xl border ${
                isDark
                  ? 'border-white/15 bg-gradient-to-b from-[#0E2235] to-[#07131F] text-white shadow-2xl'
                  : 'border-slate-300 bg-white text-[#102F46] shadow-xl'
              } p-6 sm:p-10 lg:p-12 xl:p-14 transition-all duration-300 min-h-[620px] xl:min-h-[700px] flex flex-col justify-between`}
            >
              {/* Background ambient glow */}
              <div
                className={`pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full blur-3xl ${
                  isDark ? 'bg-[#0077B6]/20' : 'bg-[#0077B6]/10'
                }`}
              />
              <div
                className={`pointer-events-none absolute -bottom-20 -left-20 h-96 w-96 rounded-full blur-3xl ${
                  isDark ? 'bg-[#FF6B35]/20' : 'bg-[#FF6B35]/10'
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
                className={`relative z-10 mt-8 flex flex-wrap items-center justify-between border-t pt-4 text-xs sm:text-sm ${
                  isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
                    BoraRio
                  </span>
                  <span>•</span>
                  <span>Apresentação Executiva</span>
                  <span>•</span>
                  <span className="hidden sm:inline">Confidencial · Novembro 2026</span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-lg px-2.5 py-1 font-mono text-xs font-bold ${
                      isDark
                        ? 'bg-slate-800 text-slate-200 border border-white/10'
                        : 'bg-slate-100 text-[#102F46] border border-slate-300'
                    }`}
                  >
                    Slide {currentSlide + 1} de {SLIDES.length}
                  </span>
                  <span className={`hidden sm:inline font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    (Navegue com ← e → ou barra de espaço)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Presentation Bottom Navigation Controls */}
          <div className="mx-auto mt-4 flex w-full max-w-[1720px] items-center justify-between px-2">
            <button
              type="button"
              onClick={prevSlide}
              disabled={currentSlide === 0}
              className={`flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm sm:text-base font-bold transition ${
                currentSlide === 0
                  ? 'cursor-not-allowed opacity-30 text-slate-400 border-transparent'
                  : isDark
                  ? 'border-white/10 bg-slate-800/80 text-white hover:bg-slate-700 hover:border-slate-500'
                  : 'border-slate-300 bg-white text-[#102F46] hover:bg-slate-50 shadow-xs'
              }`}
            >
              <ChevronLeft className="h-5 w-5" />
              <span>Anterior</span>
            </button>

            {/* Quick jump carousel pills */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
              {SLIDES.map((slide, idx) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => setCurrentSlide(idx)}
                  className={`group relative flex items-center justify-center rounded-xl px-3 py-1.5 text-xs sm:text-sm font-bold transition ${
                    idx === currentSlide
                      ? 'bg-[#0077B6] text-white shadow-md scale-105'
                      : isDark
                      ? 'bg-slate-800/60 text-slate-300 hover:bg-slate-700 hover:text-white'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-[#102F46]'
                  }`}
                  title={`${slide.id}. ${slide.category}`}
                >
                  <span>{idx + 1}</span>
                  <span className="ml-1.5 hidden md:inline font-semibold opacity-90">
                    · {slide.category}
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={nextSlide}
              disabled={currentSlide === SLIDES.length - 1}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm sm:text-base font-bold transition ${
                currentSlide === SLIDES.length - 1
                  ? 'cursor-not-allowed opacity-30 text-slate-400'
                  : 'bg-[#0077B6] text-white hover:bg-[#0284C7] hover:shadow-lg'
              }`}
            >
              <span>Próximo</span>
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </main>
      ) : (
        /* =================== DOCUMENT / CONTINUOUS SCROLL MODE =================== */
        <main className="mx-auto w-full max-w-[1500px] px-4 py-10 sm:px-8 lg:px-12 space-y-12">
          {/* Executive Overview Banner */}
          <div
            className={`rounded-3xl border p-8 shadow-xl backdrop-blur-md ${
              isDark
                ? 'border-[#0077B6]/40 bg-gradient-to-r from-[#0E2235] via-[#102F46] to-[#07131F] text-white'
                : 'border-[#0077B6]/30 bg-gradient-to-r from-[#0077B6]/10 via-white to-white text-[#102F46]'
            }`}
          >
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs sm:text-sm font-bold ${
                    isDark
                      ? 'border-[#0077B6]/50 bg-[#0077B6]/25 text-[#38BDF8]'
                      : 'border-[#0077B6]/40 bg-[#0077B6]/15 text-[#005B8C]'
                  }`}
                >
                  Documento Completo · 8 Slides
                </span>
                <h1 className={`mt-3 text-3xl font-black sm:text-4xl xl:text-5xl ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
                  BoraRio — Deck para Investidores Familiares
                </h1>
                <p className={`mt-2 text-base sm:text-lg ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  Visualização linear executiva do plano de negócios, oportunidade de mercado e modelo de receita.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={downloadPptxUrl}
                  download="BoraRio_Pitch_Deck_Investidores_Familiares.pptx"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0077B6] px-5 py-3 text-sm sm:text-base font-bold text-white transition hover:bg-[#0284C7] shadow-md"
                >
                  <Download className="h-4 w-4" />
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
              className={`relative overflow-hidden rounded-3xl border ${
                isDark
                  ? 'border-white/15 bg-[#0E2235]/95 text-white shadow-2xl'
                  : 'border-slate-300 bg-white text-[#102F46] shadow-md'
              } p-8 sm:p-12 xl:p-14 transition-all`}
            >
              <div
                className={`mb-8 flex items-center justify-between border-b pb-4 ${
                  isDark ? 'border-white/10' : 'border-slate-200'
                }`}
              >
                <span
                  className={`inline-block rounded-full border px-3.5 py-1 text-xs sm:text-sm font-bold ${
                    isDark ? slide.tagColor.dark : slide.tagColor.light
                  }`}
                >
                  {slide.tag}
                </span>
                <span className={`font-mono text-sm font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
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
            className={`rounded-3xl border p-10 text-center shadow-2xl ${
              isDark
                ? 'border-white/15 bg-gradient-to-b from-[#0E2235] to-[#07131F] text-white'
                : 'border-slate-300 bg-gradient-to-b from-white to-[#F8F5EF] text-[#102F46]'
            }`}
          >
            <h2 className="text-2xl sm:text-3xl font-black">Interessado em fazer parte do BoraRio?</h2>
            <p className={`mx-auto mt-3 max-w-2xl text-base sm:text-lg ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
              Estamos estruturando a rodada inicial com parceiros e investidores familiares que compartilham nossa paixão pelo Rio.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <a
                href="mailto:contato@borario.com.br?subject=Conversa%20de%20Investimento%20-%20BoraRio"
                className="flex items-center gap-2 rounded-xl bg-[#0077B6] px-6 py-3.5 text-base font-bold text-white shadow-lg transition hover:bg-[#0284C7]"
              >
                <Mail className="h-5 w-5" />
                <span>Falar com os Fundadores</span>
              </a>
              <button
                type="button"
                onClick={() => onNavigate('/app')}
                className={`flex items-center gap-2 rounded-xl border px-6 py-3.5 text-base font-bold transition ${
                  isDark
                    ? 'border-white/25 bg-white/5 text-white hover:bg-white/10'
                    : 'border-slate-300 bg-white text-[#102F46] hover:bg-slate-50 shadow-xs'
                }`}
              >
                <ExternalLink className="h-5 w-5" />
                <span>Explorar Superapp ao Vivo</span>
              </button>
            </div>
          </div>
        </main>
      )}

      {/* Footer bar */}
      <footer
        className={`border-t py-6 text-center text-sm ${
          isDark
            ? 'border-white/10 bg-[#07131F] text-slate-400'
            : 'border-[#E5DDD0] bg-white text-slate-700'
        }`}
      >
        <div className="mx-auto flex w-full max-w-[1720px] flex-wrap items-center justify-between px-4 sm:px-8 gap-4">
          <p>© 2026 BoraRio Tecnologia e Experiências Cariocas. Todos os direitos reservados.</p>
          <div className="flex items-center gap-6 font-semibold">
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
   INDIVIDUAL SLIDE COMPONENTS (Large Typography, High Contrast & Widescreen)
   ========================================================================= */

// Slide 1: Capa & Proposta (Widescreen + Grande Destaque Visual)
function Slide1Cover({ isDark }: { isDark: boolean }) {
  const heroImage = isDark ? rioHeroNight : rioHeroDay;

  return (
    <div className="flex flex-col gap-8 py-2">
      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 xl:gap-12">
        {/* Left Column: Headline and Pillars */}
        <div className="flex flex-col text-left lg:col-span-7 xl:col-span-7">
          <div
            className={`inline-flex w-fit items-center gap-2 rounded-full border px-4 py-1.5 text-xs sm:text-sm font-bold ${
              isDark
                ? 'border-[#0077B6]/50 bg-[#0077B6]/25 text-[#38BDF8]'
                : 'border-[#0077B6]/40 bg-[#0077B6]/15 text-[#005B8C]'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>BoraRio · Apresentação para Potenciais Investidores Familiares</span>
          </div>

          <h1
            className={`mt-6 text-4xl sm:text-6xl xl:text-7xl font-black tracking-tight leading-tight ${
              isDark ? 'text-white' : 'text-[#102F46]'
            }`}
          >
            A cidade acontece.{' '}
            <span className="bg-gradient-to-r from-[#0077B6] via-[#0284C7] to-[#FF6B35] bg-clip-text text-transparent">
              Você aproveita.
            </span>
          </h1>

          <p className={`mt-4 text-lg sm:text-xl xl:text-2xl font-medium leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            Plataforma de experiências e vantagens em tempo real para a cidade do Rio de Janeiro.
          </p>

          {/* 3 Executive Pillars Highlights with generous sizing */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div
              className={`rounded-2xl border p-5 ${
                isDark ? 'border-white/15 bg-white/[0.04]' : 'border-slate-300 bg-slate-50 shadow-sm'
              }`}
            >
              <div className="flex items-center gap-2 text-[#0077B6]">
                <Compass className="h-5 w-5" />
                <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider">O que é</span>
              </div>
              <p className={`mt-2.5 text-sm sm:text-base leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                Superapp que conecta cariocas e visitantes aos melhores bares, restaurantes e atrações.
              </p>
            </div>

            <div
              className={`rounded-2xl border p-5 ${
                isDark ? 'border-white/15 bg-white/[0.04]' : 'border-slate-300 bg-slate-50 shadow-sm'
              }`}
            >
              <div className="flex items-center gap-2 text-[#FF6B35]">
                <Flame className="h-5 w-5" />
                <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider">Diferencial</span>
              </div>
              <p className={`mt-2.5 text-sm sm:text-base leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                Oportunidades dinâmicas em horários de vale e fidelidade unificada Rio Points.
              </p>
            </div>

            <div
              className={`rounded-2xl border p-5 ${
                isDark ? 'border-white/15 bg-white/[0.04]' : 'border-slate-300 bg-slate-50 shadow-sm'
              }`}
            >
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <Wallet className="h-5 w-5" />
                <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider">Modelo</span>
              </div>
              <p className={`mt-2.5 text-sm sm:text-base leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                Presença real no salão: R$ 10 padrão / R$ 5 condição especial de lançamento.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Expansive Rio Hero Visual Card */}
        <div className="relative overflow-hidden rounded-3xl border border-white/20 shadow-2xl lg:col-span-5 xl:col-span-5 h-[340px] sm:h-[400px] xl:h-[460px]">
          <img
            src={heroImage}
            alt="Rio de Janeiro - BoraRio"
            className="h-full w-full object-cover object-center transition duration-700 hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

          {/* Floating Pill: Rio Ao Vivo */}
          <div className="absolute top-4 left-4 flex items-center gap-2.5 rounded-full bg-black/60 px-4 py-1.5 text-sm font-bold text-white backdrop-blur-md border border-white/20 shadow-lg">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Rio de Janeiro · Ao Vivo</span>
          </div>

          {/* Bottom Card: Live Pass preview */}
          <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/20 bg-black/75 p-4 text-white backdrop-blur-md shadow-xl">
            <div className="flex items-center justify-between text-sm sm:text-base">
              <span className="font-extrabold text-[#FFB347]">🎟️ Passaporte BoraRio</span>
              <span className="rounded-lg bg-[#0077B6] px-2.5 py-1 text-xs font-black uppercase">Check-in QR Code</span>
            </div>
            <p className="mt-2 text-xs sm:text-sm text-slate-200 font-medium">
              Presença verificada em salão. Validação individual para casais e grupos.
            </p>
          </div>
        </div>
      </div>

      <div
        className={`flex items-center justify-center gap-3 text-xs sm:text-sm font-semibold border-t pt-4 ${
          isDark ? 'border-white/10 text-slate-300' : 'border-slate-300 text-slate-700'
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
      <div className="mb-8">
        <span
          className={`rounded-full border px-3.5 py-1 text-xs sm:text-sm font-bold ${
            isDark
              ? 'border-amber-500/50 bg-amber-500/20 text-amber-300'
              : 'border-amber-600/40 bg-amber-100 text-amber-900'
          }`}
        >
          01 • Oportunidade
        </span>
        <h2 className={`mt-3 text-3xl sm:text-4xl xl:text-5xl font-black tracking-tight ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
          O lazer no Rio ainda é fragmentado
        </h2>
        <p className={`mt-2 text-base sm:text-lg xl:text-xl font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
          A fricção na jornada do consumidor e a ineficiência comercial dos estabelecimentos geram um enorme desperdício econômico na cidade.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Para quem sai */}
        <div
          className={`flex flex-col justify-between rounded-2xl border p-6 sm:p-7 ${
            isDark ? 'border-white/15 bg-white/[0.04]' : 'border-slate-300 bg-white shadow-sm'
          }`}
        >
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0077B6]/15 text-[#0077B6]">
                <Users className="h-6 w-6" />
              </div>
              <h3 className={`text-lg sm:text-xl font-black ${isDark ? 'text-white' : 'text-[#102F46]'}`}>Para quem sai</h3>
            </div>
            <p className="mt-4 text-xs sm:text-sm font-bold uppercase tracking-wider text-[#0077B6]">
              Dificuldade de decisão e incerteza
            </p>
            <ul className={`mt-4 space-y-3 text-sm sm:text-base leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              <li className="flex items-start gap-2.5">
                <span className="mt-1 text-[#0077B6] font-bold">▸</span>
                <span>Decidir onde ir exige abrir múltiplos apps, checar redes sociais e grupos de mensagens.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1 text-[#0077B6] font-bold">▸</span>
                <span>Informações desencontradas sobre horário real de funcionamento, fila e lotação.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1 text-[#0077B6] font-bold">▸</span>
                <span>Pouco reconhecimento: frequenta diversos locais sem nunca ser recompensado pela fidelidade à cidade.</span>
              </li>
            </ul>
          </div>
          <div
            className={`mt-6 rounded-xl p-3 text-xs sm:text-sm border ${
              isDark
                ? 'bg-[#0077B6]/15 text-sky-200 border-[#0077B6]/40 font-semibold'
                : 'bg-[#0077B6]/15 text-[#004C74] border-[#0077B6]/30 font-bold'
            }`}
          >
            Resultado: Decisão por inércia e perda de experiências autênticas.
          </div>
        </div>

        {/* Para quem oferece */}
        <div
          className={`flex flex-col justify-between rounded-2xl border p-6 sm:p-7 ${
            isDark ? 'border-white/15 bg-white/[0.04]' : 'border-slate-300 bg-white shadow-sm'
          }`}
        >
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FF6B35]/15 text-[#FF6B35]">
                <Building2 className="h-6 w-6" />
              </div>
              <h3 className={`text-lg sm:text-xl font-black ${isDark ? 'text-white' : 'text-[#102F46]'}`}>Para quem oferece</h3>
            </div>
            <p className="mt-4 text-xs sm:text-sm font-bold uppercase tracking-wider text-[#FF6B35]">
              Ociosidade e comissões abusivas
            </p>
            <ul className={`mt-4 space-y-3 text-sm sm:text-base leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              <li className="flex items-start gap-2.5">
                <span className="mt-1 text-[#FF6B35] font-bold">▸</span>
                <span>Bares, restaurantes e casas noturnas enfrentam horários ociosos com mesas vazias e custos fixos correndo.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1 text-[#FF6B35] font-bold">▸</span>
                <span>Custos de aquisição altos em plataformas predatórias que cobram 15% a 30% sem fidelizar o cliente.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1 text-[#FF6B35] font-bold">▸</span>
                <span>Dificuldade para comunicar benefícios pontuais no momento exato em que a casa precisa de fluxo.</span>
              </li>
            </ul>
          </div>
          <div
            className={`mt-6 rounded-xl p-3 text-xs sm:text-sm border ${
              isDark
                ? 'bg-orange-950/40 text-orange-200 border-orange-800/40 font-semibold'
                : 'bg-orange-100 text-orange-900 border-orange-300 font-bold'
            }`}
          >
            Resultado: Margem comprimida e dependência de intermediários tradicionais.
          </div>
        </div>

        {/* Para o mercado */}
        <div
          className={`flex flex-col justify-between rounded-2xl border p-6 sm:p-7 ${
            isDark ? 'border-white/15 bg-white/[0.04]' : 'border-slate-300 bg-white shadow-sm'
          }`}
        >
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <BarChart3 className="h-6 w-6" />
              </div>
              <h3 className={`text-lg sm:text-xl font-black ${isDark ? 'text-white' : 'text-[#102F46]'}`}>Para o mercado</h3>
            </div>
            <p className="mt-4 text-xs sm:text-sm font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Potencial econômico subaproveitado
            </p>
            <ul className={`mt-4 space-y-3 text-sm sm:text-base leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              <li className="flex items-start gap-2.5">
                <span className="mt-1 text-amber-500 font-bold">▸</span>
                <span>O Rio tem vocação turística e gastronômica global, mas carece de uma infraestrutura digital unificada.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1 text-amber-500 font-bold">▸</span>
                <span>Falta uma ponte ágil entre o que está acontecendo agora na cidade e quem está pronto para consumir.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1 text-amber-500 font-bold">▸</span>
                <span>Demanda espontânea dispersa em redes sociais que não convertem em visitas reais ao salão.</span>
              </li>
            </ul>
          </div>
          <div
            className={`mt-6 rounded-xl p-3 text-xs sm:text-sm border ${
              isDark
                ? 'bg-amber-950/40 text-amber-200 border-amber-800/40 font-semibold'
                : 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
            }`}
          >
            Resultado: Um mercado multibilionário pronto para um player nativo focado em presença.
          </div>
        </div>
      </div>
    </div>
  );
}

// Slide 3: Solução (BoraRio: da descoberta à experiência + Jornada do Parceiro em 3 Etapas)
function Slide3Solution({ isDark }: { isDark: boolean }) {
  return (
    <div>
      <div className="mb-8">
        <span
          className={`rounded-full border px-3.5 py-1 text-xs sm:text-sm font-bold ${
            isDark
              ? 'border-[#0077B6]/50 bg-[#0077B6]/20 text-[#38BDF8]'
              : 'border-[#0077B6]/40 bg-[#0077B6]/15 text-[#005B8C]'
          }`}
        >
          02 • Solução &amp; Entrada sem Fricção
        </span>
        <h2 className={`mt-3 text-3xl sm:text-4xl xl:text-5xl font-black tracking-tight ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
          Uma oferta, várias possibilidades. Zero fricção.
        </h2>
        <p className={`mt-2 text-base sm:text-lg xl:text-xl font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
          O estabelecimento entra em <strong className="text-[#0077B6]">3 etapas simples</strong> (com opção de <strong className="text-[#FF6B35]">Cadastro Assistido</strong> pela equipe BoraRio) e evolui no seu ritmo conforme percebe resultado.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Etapa 1. Começar */}
        <div
          className={`group rounded-2xl border p-6 sm:p-8 transition ${
            isDark
              ? 'border-white/15 bg-white/[0.04] hover:border-[#0077B6]'
              : 'border-slate-300 bg-white hover:border-[#0077B6] shadow-sm'
          }`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0077B6]/15 text-[#0077B6] text-xl font-black">
            1
          </div>
          <h3 className={`mt-4 text-xl font-black ${isDark ? 'text-white' : 'text-[#102F46]'}`}>1. Começar</h3>
          <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#0077B6]">Perfil + 1ª Oferta (Sem Fricção)</p>
          <p className={`mt-3 text-sm sm:text-base leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            Reaproveita os dados já curados no catálogo ou via Cadastro Assistido BoraRio. O parceiro cria sua 1ª oferta sem burocracia e já começa a receber clientes.
          </p>
        </div>

        {/* Etapa 2. Gerar mais demanda */}
        <div
          className={`group rounded-2xl border p-6 sm:p-8 transition ${
            isDark
              ? 'border-white/15 bg-white/[0.04] hover:border-[#FF6B35]'
              : 'border-slate-300 bg-white hover:border-[#FF6B35] shadow-sm'
          }`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FF6B35]/15 text-[#FF6B35] text-xl font-black">
            2
          </div>
          <h3 className={`mt-4 text-xl font-black ${isDark ? 'text-white' : 'text-[#102F46]'}`}>2. Gerar Demanda</h3>
          <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#FF6B35]">Individual ou Missão Coletiva</p>
          <p className={`mt-3 text-sm sm:text-base leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            A mesma oferta pode ser distribuída como Individual ou Missão Coletiva Progressiva: benefício inicial garantido + faixas extras conforme novas adesões.
          </p>
        </div>

        {/* Etapa 3. Fidelizar */}
        <div
          className={`group rounded-2xl border p-6 sm:p-8 transition ${
            isDark
              ? 'border-white/15 bg-white/[0.04] hover:border-[#0077B6]'
              : 'border-slate-300 bg-white hover:border-[#0077B6] shadow-sm'
          }`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0077B6]/15 text-[#0077B6] text-xl font-black">
            3
          </div>
          <h3 className={`mt-4 text-xl font-black ${isDark ? 'text-white' : 'text-[#102F46]'}`}>3. Fidelizar (Opcional)</h3>
          <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#0077B6]">Recompensas Rio Points (0%)</p>
          <p className={`mt-3 text-sm sm:text-base leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            Quando quiser, o parceiro cadastra uma cortesia para troca por pontos, atraindo clientes recorrentes da rede sem pagar comissão nem taxa no resgate.
          </p>
        </div>
      </div>

      <div
        className={`mt-8 rounded-2xl border p-5 text-center ${
          isDark
            ? 'border-[#0077B6]/40 bg-[#0077B6]/15 text-sky-200'
            : 'border-[#0077B6]/30 bg-[#0077B6]/10 text-[#004C74] font-semibold'
        }`}
      >
        <p className="text-sm sm:text-base xl:text-lg">
          💡 <strong>Entrada rápida na rua ou WhatsApp:</strong> Com o Cadastro Assistido, nossa equipe pré-configura o perfil e a 1ª oferta, deixando para o sócio do restaurante apenas revisar e aprovar em 1 clique.
        </p>
      </div>
    </div>
  );
}

// Slide 4: Produto, Jornada do Usuário & Viralização de Mesa
function Slide4ProductJourney({ isDark }: { isDark: boolean }) {
  const steps = [
    {
      num: '1',
      title: 'Descobre & Ativa',
      desc: 'Escolhe uma Oferta Individual ou adere a uma Missão Coletiva Progressiva (com benefício inicial já garantido).',
      icon: Compass,
      color: 'text-[#0077B6] bg-[#0077B6]/15 border-[#0077B6]/30',
    },
    {
      num: '2',
      title: 'Convida Amigos (Viralização)',
      desc: 'Compartilha a missão no WhatsApp para destravar as Faixas 2 e 3 ou envia seu Convite VIP (+300 RP).',
      icon: Target,
      color: 'text-[#FF6B35] bg-[#FF6B35]/15 border-[#FF6B35]/30',
    },
    {
      num: '3',
      title: 'Valida por Participante na Mesa',
      desc: 'Cada participante elegível valida presença via QR Code dinâmico (1 validação por pessoa por visita, zero duplicidade).',
      icon: QrCode,
      color: 'text-[#0077B6] bg-[#0077B6]/15 border-[#0077B6]/30',
    },
    {
      num: '4',
      title: 'Bônus Anfitrião de Mesa (+100 RP)',
      desc: 'O titular da reserva ganha +100 RP extras por cada amigo da mesa que também valida seu próprio check-in (até +300 RP).',
      icon: Award,
      color: 'text-amber-500 bg-amber-500/15 border-amber-500/30',
    },
    {
      num: '5',
      title: 'Resgata em Toda a Rede',
      desc: 'Troca Rio Points por drinks, sobremesas e experiências nos parceiros da cidade (0% comissão para o restaurante).',
      icon: Wallet,
      color: 'text-purple-500 bg-purple-500/15 border-purple-500/30',
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <span
          className={`rounded-full border px-3.5 py-1 text-xs sm:text-sm font-bold ${
            isDark
              ? 'border-[#0077B6]/50 bg-[#0077B6]/20 text-[#38BDF8]'
              : 'border-[#0077B6]/40 bg-[#0077B6]/15 text-[#005B8C]'
          }`}
        >
          03 • Produto &amp; Loop Viral
        </span>
        <h2 className={`mt-3 text-3xl sm:text-4xl xl:text-5xl font-black tracking-tight ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
          Jornada em 5 passos com viralização nativa na mesa
        </h2>
        <p className={`mt-2 text-base sm:text-lg xl:text-xl font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
          Transformamos cada mesa e cada missão coletiva em um canal orgânico de aquisição de novos usuários com CAC próximo de zero.
        </p>
      </div>

      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 xl:gap-12">
        {/* Left: 5 Steps with generous typography */}
        <div className="space-y-3.5 lg:col-span-7 xl:col-span-7">
          {steps.map((st) => {
            const Icon = st.icon;
            return (
              <div
                key={st.num}
                className={`flex items-start gap-4 rounded-2xl border p-4 transition ${
                  isDark
                    ? 'border-white/15 bg-white/[0.04] hover:border-white/40'
                    : 'border-slate-300 bg-white hover:border-[#0077B6] shadow-xs'
                }`}
              >
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${st.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs sm:text-sm font-black text-[#0077B6]">PASSO 0{st.num}</span>
                    <h3 className={`text-base sm:text-lg xl:text-xl font-bold ${isDark ? 'text-white' : 'text-[#102F46]'}`}>{st.title}</h3>
                  </div>
                  <p className={`mt-1 text-sm sm:text-base leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{st.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Mocked Smartphone UI Frame with readable fonts */}
        <div className="flex justify-center lg:col-span-5 xl:col-span-5">
          <div
            className={`w-full max-w-[340px] sm:max-w-[360px] rounded-3xl border-4 p-4 shadow-2xl ${
              isDark ? 'border-slate-700 bg-slate-900 text-white' : 'border-slate-300 bg-white text-[#102F46]'
            }`}
          >
            {/* Phone Speaker & Camera Notch */}
            <div className="mx-auto mb-3 h-4 w-28 rounded-full bg-slate-800" />

            {/* Mocked Header */}
            <div className="flex items-center justify-between border-b pb-2.5 text-sm">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#FF6B35] text-white font-black text-xs">
                  B
                </div>
                <span className="font-extrabold text-sm">BoraRio</span>
              </div>
              <span className="rounded-full bg-[#0077B6]/15 px-2.5 py-1 text-xs font-bold text-[#0077B6]">
                ⭐ 1.550 RP
              </span>
            </div>

            {/* Mocked Progressive Collective Mission Card */}
            <div className="mt-3 rounded-2xl border border-[#FF6B35]/40 bg-gradient-to-br from-[#FF6B35]/15 to-transparent p-3.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#FF6B35]">🎯 MISSÃO COLETIVA</span>
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-500">Faixa 2 Ativa</span>
              </div>
              <div className="mt-1.5 font-black text-sm sm:text-base">Gero Ipanema · Menu + Taça</div>
              <p className="mt-1 text-xs text-slate-500">Garantido: Menu R$ 195 · Faixa 2 (6/10): + Taça Prosecco</p>
              <div className="mt-2.5 flex items-center justify-between rounded-xl bg-white/20 dark:bg-black/40 p-2 text-xs font-bold">
                <span>Sua Mesa (4 lugares):</span>
                <span className="text-[#0077B6]">3 Participantes Validados</span>
              </div>
            </div>

            {/* Mocked QR Code Check-in Status */}
            <div className="mt-3 rounded-2xl border border-[#0077B6]/40 bg-[#0077B6]/15 p-3 text-center">
              <div className="flex items-center justify-center gap-2 text-xs sm:text-sm font-black text-[#0077B6]">
                <CheckCircle2 className="h-4 w-4 text-[#0077B6]" />
                <span>3 Check-ins + Bônus Anfitrião!</span>
              </div>
              <p className="mt-1 text-xs text-slate-500 font-medium">
                +200 RP amigos na mesa · Acompanhante s/ app: R$ 0 cobrado.
              </p>
            </div>

            {/* Bottom Nav pill */}
            <div className="mt-4 flex justify-around border-t pt-2.5 text-xs font-bold text-slate-400">
              <span className="text-[#0077B6]">Explorar</span>
              <span>Missões</span>
              <span>Carteira</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Slide 5: Diferenciais Competitivos & Viralização Orgânica (Baixo CAC)
function Slide5Differentiators({ isDark }: { isDark: boolean }) {
  const items = [
    {
      title: 'Cobrança por Participante Elegível Validado',
      desc: 'Separamos Reserva, Participantes e Visita Faturável. Só gera cobrança quem aderiu pelo BoraRio e validou presença física por QR Code (1x por visita).',
      icon: ShieldCheck,
      color: 'text-[#0077B6]',
    },
    {
      title: 'Missões Coletivas Progressivas (Sem Frustração)',
      desc: 'Toda missão já nasce com Benefício Inicial Garantido. Novas adesões destravam Faixas 2 e 3 para todos, com uso 100% individual e zero risco de cancelamento.',
      icon: Flame,
      color: 'text-[#FF6B35]',
    },
    {
      title: 'Viralização de Mesa Autofinanciada (+100 RP)',
      desc: 'O anfitrião ganha +100 RP por amigo que escaneia o QR Code na mesa. Cada bônus (custo ~R$ 1) é financiado pela visita faturável gerada pelo próprio amigo (R$ 5 a R$ 10).',
      icon: Users,
      color: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      title: 'Indicação Assíncrona (+300 RP no 1º Check-in)',
      desc: 'Usuários ganham +300 RP ao indicar amigos, mesmo que consumam ofertas diferentes em outros dias. O prêmio só libera após a 1ª visita real validada (fraude zero).',
      icon: RotateCcw,
      color: 'text-[#0077B6]',
    },
    {
      title: 'Painel Limpo & Entrada em 3 Etapas',
      desc: 'Sem fricção comercial: o estabelecimento entra apenas com o perfil (próprio ou assistido) e sua primeira oferta, acompanhando resultados em um painel intuitivo.',
      icon: Sparkles,
      color: 'text-amber-600 dark:text-amber-400',
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <span
          className={`rounded-full border px-3.5 py-1 text-xs sm:text-sm font-bold ${
            isDark
              ? 'border-purple-500/50 bg-purple-500/20 text-purple-300'
              : 'border-purple-600/40 bg-purple-100 text-purple-900'
          }`}
        >
          04 • Diferenciais &amp; Baixo CAC
        </span>
        <h2 className={`mt-3 text-3xl sm:text-4xl xl:text-5xl font-black tracking-tight ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
          Crescimento viral autofinanciado e proteção comercial
        </h2>
        <p className={`mt-2 text-base sm:text-lg xl:text-xl font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
          Resolvemos a maior barreira dos marketplaces locais: o Custo de Aquisição de Clientes (CAC) e o atrito de entrada dos estabelecimentos.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={i}
              className={`rounded-2xl border p-6 text-left transition ${
                isDark
                  ? 'border-white/15 bg-white/[0.04] hover:border-white/40'
                  : 'border-slate-300 bg-white hover:border-[#0077B6] shadow-sm'
              } ${i === 4 ? 'sm:col-span-2 lg:col-span-1' : ''}`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`h-6 w-6 ${item.color}`} />
                <h3 className={`text-base sm:text-lg xl:text-xl font-black ${isDark ? 'text-white' : 'text-[#102F46]'}`}>{item.title}</h3>
              </div>
              <p className={`mt-3 text-sm sm:text-base leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                {item.desc}
              </p>
            </div>
          );
        })}
      </div>

      <div
        className={`mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-5 text-sm sm:text-base ${
          isDark
            ? 'border-purple-500/40 bg-purple-950/30 text-purple-200'
            : 'border-purple-300 bg-purple-100 text-purple-950 font-bold'
        }`}
      >
        <span><strong>CAC Orgânico Autofinanciado:</strong> Pontos só são emitidos quando há check-in faturável real.</span>
        <span><strong>Zero Fricção B2B:</strong> 1 perfil + 1 oferta para começar.</span>
        <span className="font-black text-[#0077B6]"><strong>BoraRio:</strong> Economia unitária positiva desde a 1ª visita.</span>
      </div>
    </div>
  );
}

// Slide 6: Modelo de Receita (Cobrança por Participante Elegível Validado)
function Slide6BusinessModel({ isDark }: { isDark: boolean }) {
  return (
    <div>
      <div className="mb-8">
        <span
          className={`rounded-full border px-3.5 py-1 text-xs sm:text-sm font-bold ${
            isDark
              ? 'border-[#FF6B35]/50 bg-[#FF6B35]/20 text-[#FF6B35]'
              : 'border-[#FF6B35]/40 bg-[#FF6B35]/15 text-[#B83E12]'
          }`}
        >
          05 • Modelo de Receita
        </span>
        <h2 className={`mt-3 text-3xl sm:text-4xl xl:text-5xl font-black tracking-tight ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
          Cobrança por participante elegível atendido · Zero % sobre a conta
        </h2>
        <p className={`mt-2 text-base sm:text-lg xl:text-xl font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
          Uma reserva para 4 pessoas não cobra 4 visitas automaticamente: só gera cobrança quem aderiu pelo BoraRio e validou presença física no local.
        </p>
      </div>

      {/* 3 Core Pricing Pillars */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Tarifa por Participante Elegível */}
        <div
          className={`rounded-2xl border p-6 sm:p-8 text-left ${
            isDark ? 'border-white/15 bg-white/[0.04]' : 'border-slate-300 bg-white shadow-sm'
          }`}
        >
          <span className={`text-xs sm:text-sm font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Tarifa Padrão por Participante
          </span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-4xl sm:text-5xl font-black ${isDark ? 'text-white' : 'text-[#102F46]'}`}>R$ 10,00</span>
            <span className={`text-xs sm:text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>/ participante validado</span>
          </div>
          <p className={`mt-4 text-sm sm:text-base leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            Cobrado exclusivamente por participante identificado no BoraRio, com presença validada por QR Code e efetivamente atendido.
          </p>
          <div className={`mt-6 border-t pt-4 text-xs sm:text-sm font-medium ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-700'}`}>
            ✓ 1 validação única por pessoa por visita<br />
            ✓ Acompanhantes sem adesão no app: R$ 0<br />
            ✓ Proteção opcional de teto para grupos
          </div>
        </div>

        {/* Condição de Lançamento */}
        <div
          className={`relative rounded-2xl border-2 p-6 sm:p-8 text-left shadow-xl ${
            isDark
              ? 'border-[#0077B6] bg-[#0077B6]/20'
              : 'border-[#0077B6] bg-[#0077B6]/10 shadow-blue-500/10'
          }`}
        >
          <span className="absolute -top-3 right-6 rounded-full bg-[#0077B6] px-3.5 py-1 text-xs font-black uppercase tracking-wider text-white shadow-md">
            50% OFF · Lançamento Rio
          </span>
          <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#0077B6]">
            Condição Especial de Entrada
          </span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-black text-[#0077B6]">R$ 5,00</span>
            <span className={`text-xs sm:text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>/ participante validado</span>
          </div>
          <p className={`mt-4 text-sm sm:text-base leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            Tarifa promocional de entrada para os primeiros estabelecimentos parceiros, com 0% de comissão sobre a conta e resgates gratuitos.
          </p>
          <div
            className={`mt-6 border-t pt-4 text-xs sm:text-sm font-bold ${
              isDark ? 'border-[#0077B6]/40 text-sky-200' : 'border-[#0077B6]/30 text-[#005B8C]'
            }`}
          >
            ✓ Prévia transparente antes de publicar<br />
            ✓ Recompensas Rio Points com 0% comissão<br />
            ✓ No-show ou cancelamento = R$ 0,00
          </div>
        </div>

        {/* Zero Intermediação & Fidelidade Gratuita */}
        <div
          className={`rounded-2xl border p-6 sm:p-8 text-left ${
            isDark ? 'border-white/15 bg-white/[0.04]' : 'border-slate-300 bg-white shadow-sm'
          }`}
        >
          <span className={`text-xs sm:text-sm font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400`}>
            Zero Taxa sobre o Consumo
          </span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-4xl sm:text-5xl font-black ${isDark ? 'text-white' : 'text-[#102F46]'}`}>0%</span>
            <span className={`text-xs sm:text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>comissão na conta</span>
          </div>
          <p className={`mt-4 text-sm sm:text-base leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            O cliente paga 100% da conta direto na maquininha do estabelecimento. Resgates de cortesias em Rio Points também têm tarifa zero.
          </p>
          <div className={`mt-6 border-t pt-4 text-xs sm:text-sm font-medium ${isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-700'}`}>
            ✓ Fluxo de caixa 100% direto no parceiro<br />
            ✓ Sem mensalidade fixa obrigatória<br />
            ✓ Fechamento mensal simples via PIX ou Boleto
          </div>
        </div>
      </div>

      {/* Practical Example: Reserva de 4 pessoas com 3 participantes validados */}
      <div
        className={`mt-8 overflow-hidden rounded-2xl border ${
          isDark ? 'border-white/15 bg-slate-900/80' : 'border-slate-300 bg-white shadow-sm'
        }`}
      >
        <div
          className={`border-b px-6 py-3.5 text-sm sm:text-base font-black flex flex-wrap items-center justify-between gap-2 ${
            isDark ? 'border-white/10 bg-slate-800/80 text-white' : 'border-slate-200 bg-slate-100 text-[#102F46]'
          }`}
        >
          <span>Exemplo Real de Apuração: Reserva para 4 Pessoas na Mesa</span>
          <span className="text-xs font-bold text-[#0077B6]">Zero Duplicidade · Cobrança Individual Auditável</span>
        </div>
        <div
          className={`grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x p-5 text-center text-sm ${
            isDark ? 'divide-white/10' : 'divide-slate-200'
          }`}
        >
          <div className="p-2">
            <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Pessoa 1 (Titular)</span>
            <div className="mt-1 font-black text-emerald-500">✓ Validada (QR)</div>
            <div className="mt-0.5 text-xs">1 visita faturável</div>
          </div>
          <div className="p-2">
            <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Pessoa 2 (Aderiu)</span>
            <div className="mt-1 font-black text-emerald-500">✓ Validada (QR)</div>
            <div className="mt-0.5 text-xs">1 visita + 100 RP anfitrião</div>
          </div>
          <div className="p-2">
            <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Pessoa 3 (Aderiu)</span>
            <div className="mt-1 font-black text-emerald-500">✓ Validada (QR)</div>
            <div className="mt-0.5 text-xs">1 visita + 100 RP anfitrião</div>
          </div>
          <div className="p-2">
            <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Pessoa 4 (Acompanhante)</span>
            <div className="mt-1 font-bold text-slate-400">Não aderiu no app</div>
            <div className="mt-0.5 text-xs">R$ 0,00 cobrado</div>
          </div>
          <div className="col-span-2 sm:col-span-1 p-2 bg-[#0077B6]/10 rounded-xl sm:rounded-none">
            <span className="text-xs font-bold uppercase text-[#0077B6]">Total Faturável: 3</span>
            <div className={`mt-1 font-black text-base ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
              R$ 15 (Lanç.) / R$ 30 (Padrão)
            </div>
            <div className="mt-0.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
              Apenas quem validou QR
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
      <div className="mb-6">
        <span
          className={`rounded-full border px-3.5 py-1 text-xs sm:text-sm font-bold ${
            isDark
              ? 'border-[#0077B6]/50 bg-[#0077B6]/20 text-[#38BDF8]'
              : 'border-[#0077B6]/40 bg-[#0077B6]/15 text-[#005B8C]'
          }`}
        >
          06 • Estratégia de Entrada
        </span>
        <h2 className={`mt-3 text-3xl sm:text-4xl xl:text-5xl font-black tracking-tight ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
          Foco inicial no Rio de Janeiro
        </h2>
        <p className={`mt-2 text-base sm:text-lg xl:text-xl font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
          Estratégia de expansão hiperlocal em três etapas sequenciais e focadas em densidade territorial.
        </p>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12 xl:gap-8">
        {/* Left: 3 Phases */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-8 xl:col-span-8">
          {/* Fase 1: Piloto */}
          <div
            className={`rounded-2xl border p-5 sm:p-6 text-left flex flex-col justify-between ${
              isDark ? 'border-white/15 bg-white/[0.04]' : 'border-slate-300 bg-white shadow-xs'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-[#0077B6]/20 px-2.5 py-1 text-xs font-black text-[#0077B6]">
                  Meses 1 - 2
                </span>
                <span className="text-xs font-mono font-bold text-slate-500">FASE 1</span>
              </div>
              <h3 className={`mt-3 text-lg sm:text-xl font-black ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
                Piloto Controlado
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-[#0077B6] font-bold">30 a 50 estabelecimentos</p>
              <ul className={`mt-3 space-y-2 text-xs sm:text-sm leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                <li>• Zona Sul (Leblon, Ipanema, Botafogo) e Barra da Tijuca.</li>
                <li>• Treinamento de garçons e hostess no fluxo de QR Code.</li>
                <li>• 1.000 usuários beta ativos.</li>
              </ul>
            </div>
          </div>

          {/* Fase 2: Lançamento */}
          <div
            className={`rounded-2xl border-2 p-5 sm:p-6 text-left flex flex-col justify-between ${
              isDark
                ? 'border-[#0077B6] bg-[#0077B6]/20'
                : 'border-[#0077B6] bg-[#0077B6]/10 shadow-sm'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-[#0077B6] px-2.5 py-1 text-xs font-black text-white">
                  Meses 3 - 6
                </span>
                <span className="text-xs font-mono text-[#0077B6] font-black">FASE 2</span>
              </div>
              <h3 className={`mt-3 text-lg sm:text-xl font-black ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
                Lançamento Oficial
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-[#0077B6] font-bold">150 a 200 estabelecimentos</p>
              <ul className={`mt-3 space-y-2 text-xs sm:text-sm leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                <li>• Tarifa promocional de R$ 5,00 por check-in.</li>
                <li>• 10.000 usuários ativos e 5.000 check-ins/mês.</li>
                <li>• Parcerias com criadores cariocas.</li>
              </ul>
            </div>
          </div>

          {/* Fase 3: Escala */}
          <div
            className={`rounded-2xl border p-5 sm:p-6 text-left flex flex-col justify-between ${
              isDark ? 'border-white/15 bg-white/[0.04]' : 'border-slate-300 bg-white shadow-xs'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-purple-500/20 px-2.5 py-1 text-xs font-black text-purple-600 dark:text-purple-400">
                  Meses 7 - 12
                </span>
                <span className="text-xs font-mono font-bold text-slate-500">FASE 3</span>
              </div>
              <h3 className={`mt-3 text-lg sm:text-xl font-black ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
                Escala Carioca
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-purple-600 dark:text-purple-400 font-bold">300+ estabelecimentos</p>
              <ul className={`mt-3 space-y-2 text-xs sm:text-sm leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                <li>• Expansão para Tijuca, Centro/Lapa e Niterói.</li>
                <li>• Integração com hotelaria e turismo.</li>
                <li>• Rio Points como moeda de lazer da cidade.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right: Rio Map & Territory Visual Card */}
        <div className="relative overflow-hidden rounded-2xl border border-white/20 shadow-xl lg:col-span-4 xl:col-span-4 min-h-[220px] xl:min-h-[280px]">
          <img
            src={heroImage}
            alt="Expansão Rio de Janeiro"
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/25" />
          <div className="absolute inset-0 p-5 flex flex-col justify-between text-white">
            <div className="flex items-center gap-2 text-sm sm:text-base font-extrabold text-[#FFB347]">
              <MapPin className="h-5 w-5" />
              <span>Polos de Densidade Rio</span>
            </div>
            <div className="space-y-2 text-xs sm:text-sm text-slate-200 font-semibold">
              <div className="flex items-center justify-between">
                <span>Zona Sul (Leblon, Ipanema)</span>
                <span className="font-black text-[#38BDF8]">Fase 1</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Barra da Tijuca & Botafogo</span>
                <span className="font-black text-[#38BDF8]">Fase 1</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Tijuca, Centro, Lapa & Niterói</span>
                <span className="font-black text-[#FFB347]">Fases 2-3</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5 KPIs with larger, legible typography */}
      <div
        className={`mt-6 rounded-2xl border p-5 ${
          isDark ? 'border-white/15 bg-slate-900/80' : 'border-slate-300 bg-white shadow-xs'
        }`}
      >
        <span className={`text-xs sm:text-sm font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          Indicadores-Chave de Sucesso (KPIs de Acompanhamento)
        </span>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5 text-center text-xs sm:text-sm">
          <div className={`rounded-xl p-3 ${isDark ? 'bg-slate-800/80' : 'bg-slate-50 border border-slate-300'}`}>
            <span className={`block text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Transacional</span>
            <strong className={`text-sm sm:text-base ${isDark ? 'text-white' : 'text-[#102F46]'}`}>Check-ins / mês</strong>
          </div>
          <div className={`rounded-xl p-3 ${isDark ? 'bg-slate-800/80' : 'bg-slate-50 border border-slate-300'}`}>
            <span className={`block text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Saúde B2B</span>
            <strong className={`text-sm sm:text-base ${isDark ? 'text-white' : 'text-[#102F46]'}`}>Retenção Parceiros</strong>
          </div>
          <div className={`rounded-xl p-3 ${isDark ? 'bg-slate-800/80' : 'bg-slate-50 border border-slate-300'}`}>
            <span className={`block text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Eficiência</span>
            <strong className={`text-sm sm:text-base ${isDark ? 'text-white' : 'text-[#102F46]'}`}>CAC por Usuário</strong>
          </div>
          <div className={`rounded-xl p-3 ${isDark ? 'bg-slate-800/80' : 'bg-slate-50 border border-slate-300'}`}>
            <span className={`block text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Engajamento</span>
            <strong className={`text-sm sm:text-base ${isDark ? 'text-white' : 'text-[#102F46]'}`}>Giro Rio Points</strong>
          </div>
          <div className={`rounded-xl p-3 ${isDark ? 'bg-slate-800/80' : 'bg-slate-50 border border-slate-300'}`}>
            <span className={`block text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Qualidade</span>
            <strong className={`text-sm sm:text-base ${isDark ? 'text-white' : 'text-[#102F46]'}`}>NPS B2B & B2C</strong>
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
      <div className="mb-8">
        <span
          className={`rounded-full border px-3.5 py-1 text-xs sm:text-sm font-bold ${
            isDark
              ? 'border-[#0077B6]/50 bg-[#0077B6]/20 text-[#38BDF8]'
              : 'border-[#0077B6]/40 bg-[#0077B6]/15 text-[#005B8C]'
          }`}
        >
          07 • Conversa de Investimento
        </span>
        <h2 className={`mt-3 text-3xl sm:text-4xl xl:text-5xl font-black tracking-tight ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
          Próximos passos e uso de recursos
        </h2>
        <p className={`mt-2 text-base sm:text-lg xl:text-xl font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
          Estrutura enxuta voltada para comprovar unit economics e criar uma máquina de tração sustentável.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Destinação do Capital */}
        <div
          className={`rounded-2xl border p-6 sm:p-8 text-left ${
            isDark ? 'border-white/15 bg-white/[0.04]' : 'border-slate-300 bg-white shadow-sm'
          }`}
        >
          <div className="flex items-center gap-2.5 text-[#0077B6]">
            <Target className="h-6 w-6" />
            <h3 className={`text-lg sm:text-xl font-black ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
              O capital será direcionado para:
            </h3>
          </div>
          <ul className={`mt-5 space-y-3.5 text-sm sm:text-base leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#0077B6] shrink-0 mt-0.5" />
              <span><strong>Finalização técnica e segurança:</strong> estabilidade de infraestrutura, QR Code anti-fraude e geolocalização precisa.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#0077B6] shrink-0 mt-0.5" />
              <span><strong>Aquisição e onboarding de parceiros:</strong> equipe de campo dedicada aos primeiros 50 estabelecimentos chave.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#0077B6] shrink-0 mt-0.5" />
              <span><strong>Marketing de lançamento:</strong> campanhas focadas em comunidades locais, embaixadores e microinfluenciadores no Rio.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#0077B6] shrink-0 mt-0.5" />
              <span><strong>Capital de giro operacional:</strong> sustentação dos primeiros 6 meses até atingimento do breakeven do piloto.</span>
            </li>
          </ul>
        </div>

        {/* Marco de Validação e Proposta */}
        <div
          className={`flex flex-col justify-between rounded-2xl border p-6 sm:p-8 text-left ${
            isDark ? 'border-white/15 bg-white/[0.04]' : 'border-slate-300 bg-white shadow-sm'
          }`}
        >
          <div>
            <div
              className={`rounded-2xl border p-5 ${
                isDark
                  ? 'border-amber-500/40 bg-amber-500/15'
                  : 'border-amber-300 bg-amber-50 shadow-xs'
              }`}
            >
              <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Marco de Validação Inicial (90 dias)
              </span>
              <p className={`mt-2 text-base sm:text-lg font-black ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
                5.000 check-ins validados e 50 estabelecimentos ativos com recorrência comprovada no Rio.
              </p>
            </div>

            <div className="mt-6">
              <h4 className={`text-base sm:text-lg font-bold ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
                Proposta para a conversa:
              </h4>
              <p className={`mt-2 text-sm sm:text-base leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                Rodada inicial com investidores familiares e anjos estratégicos para viabilizar o piloto e a tração inicial. Termos abertos para diálogo amigável e alinhado aos interesses de longo prazo.
              </p>
            </div>
          </div>

          {/* Founder contact and CTAs */}
          <div
            className={`mt-6 rounded-2xl border p-5 ${
              isDark ? 'border-white/15 bg-slate-800/80' : 'border-slate-300 bg-slate-50'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className={`text-sm sm:text-base font-black ${isDark ? 'text-white' : 'text-[#102F46]'}`}>
                  Contato dos Fundadores
                </span>
                <p className={`text-xs sm:text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  contato@borario.com.br · Rio de Janeiro, RJ
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <a
                  href={downloadPptxUrl}
                  download="BoraRio_Pitch_Deck_Investidores_Familiares.pptx"
                  className={`rounded-xl border px-3.5 py-2 text-xs sm:text-sm font-bold transition flex items-center gap-1.5 ${
                    isDark
                      ? 'border-white/20 text-slate-200 hover:bg-white/10'
                      : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100 shadow-xs'
                  }`}
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>PPTX</span>
                </a>
                <a
                  href="mailto:contato@borario.com.br?subject=Conversa%20de%20Investimento%20-%20BoraRio"
                  className="rounded-xl bg-[#0077B6] px-4 py-2 text-xs sm:text-sm font-bold text-white transition hover:bg-[#0284C7] shadow-md flex items-center gap-1.5"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span>Iniciar Conversa</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`mt-8 text-center text-sm sm:text-base font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
        “Vamos construir juntos a próxima referência em experiências e gastronomia no Rio de Janeiro?”
      </div>
    </div>
  );
}
