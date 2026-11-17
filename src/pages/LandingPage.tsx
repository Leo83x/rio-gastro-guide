import {
  ArrowRight,
  Award,
  Bookmark,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Compass,
  Crown,
  Moon,
  Music,
  QrCode,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  UtensilsCrossed,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import rioHeroDay from '../assets/brand/rio-hero-day.jpg';
import rioHeroNight from '../assets/brand/rio-hero-night.jpg';
import { BrandLogo } from '../components/BrandLogo';
import { fetchRioWeatherLive, type RioWeatherSnapshot } from '../services/integrations/registry';
import type { AppRoute } from '../services/router';

interface LandingPageProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onNavigate: (route: AppRoute) => void;
  totalExperiences: number;
  canInstallPwa: boolean;
  onInstallPwa: () => void;
}

const PILLARS = [
  {
    id: 'comer',
    title: 'Comer',
    subtitle: 'Gastronomia Carioca',
    icon: UtensilsCrossed,
    color: 'from-[#FF4B2B] to-[#FF6B35]',
    badge: 'Botecos a Estrelados',
    description:
      'Da feijoada autêntica e botecos premiados da Tijuca à alta gastronomia contemporânea no Leblon e Ipanema. Filtro instantâneo por momento: Casal, Família, Galera ou Econômico.',
    highlights: ['Bistrôs & Rooftops', 'Botecos Tradicionais', 'Cafés de Charme', 'Frutos do Mar'],
  },
  {
    id: 'noite',
    title: 'Noite & Eventos',
    subtitle: 'A Noite Carioca em Tempo Real',
    icon: Moon,
    color: 'from-[#0A1D30] to-[#123B56]',
    badge: 'Radar Ao Vivo',
    description:
      'Curadoria unificada da cena noturna do Rio: rodas de samba históricas na Lapa, shows, festas conceituadas e rooftops ao pôr do sol. Com links de ingressos verificados e sem duplicidades.',
    highlights: ['Samba da Lapa e Saúde', 'Festas & Eletrônico', 'Shows e Festivais', 'Bares com Música'],
  },
  {
    id: 'passeios',
    title: 'Passeios',
    subtitle: 'Cultura, Praias & Natureza',
    icon: Compass,
    color: 'from-[#0077B6] to-[#0096C7]',
    badge: 'Adaptável ao Clima',
    description:
      'Parques, mirantes, praias icônicas e centros culturais integrados com a previsão do tempo ao vivo. Se a chuva vier, o app ativa automaticamente o Modo Chuva com atrações cobertas.',
    highlights: ['Mirantes & Floresta', 'Museus & Teatros', 'Praias Cariocas', 'Roteiros Históricos'],
  },
];

const MOMENT_PILLS = [
  { label: 'Família & Kids', desc: 'Parques, museus interativos e restaurantes com estrutura para crianças' },
  { label: 'Modo Casal', desc: 'Rooftops ao pôr do sol, bistrôs intimistas e luz de velas' },
  { label: 'Galera & Votação', desc: 'Botecos clássicos, mesas grandes e divisão fácil da conta' },
  { label: 'Turista & Roteiros', desc: 'Ícones cariocas, praias e roteiros otimizados por bairro' },
  { label: 'Modo Chuva', desc: 'Locais 100% cobertos, centros culturais, teatros e cafés acolhedores' },
  { label: 'Econômico / Gratuito', desc: 'Passeios abertos, trilhas e achados com alto custo-benefício' },
];

export function LandingPage({
  isDark,
  onToggleTheme,
  onNavigate,
  totalExperiences,
  canInstallPwa,
  onInstallPwa,
}: LandingPageProps) {
  const [weather, setWeather] = useState<RioWeatherSnapshot | null>(null);
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | 'about' | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    fetchRioWeatherLive().then(setWeather).catch(() => undefined);
  }, []);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 36);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isOverHero = !isScrolled;
  const isOverLightHero = isOverHero && !isDark;
  const isOverDarkHero = isOverHero && isDark;

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Top Header */}
      <header
        className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
          isOverLightHero
            ? 'border-b border-transparent bg-transparent'
            : isOverDarkHero
              ? 'border-b border-transparent bg-gradient-to-b from-[#061524]/40 via-[#061524]/10 to-transparent'
              : 'border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]/90 shadow-xs backdrop-blur-xl'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className={`flex items-center gap-2 text-left rounded-2xl transition-all ${
              isOverLightHero
                ? 'bg-white/90 border border-white/60 shadow-[0_4px_16px_rgba(0,0,0,0.08)] backdrop-blur-md px-3.5 py-1.5'
                : isOverDarkHero
                  ? 'bg-black/40 border border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.25)] backdrop-blur-md px-3.5 py-1.5'
                  : 'p-1'
            }`}
          >
            <BrandLogo variant="horizontal" size="md" onDark={isOverDarkHero || (isScrolled && isDark)} />
          </button>

          <nav
            className={`hidden items-center gap-6 text-sm font-semibold transition-all md:flex ${
              isOverLightHero
                ? 'rounded-full border border-[#123B56]/15 bg-white/85 px-5 py-1.5 text-[#123B56] shadow-[0_4px_18px_rgba(16,47,70,0.08)] backdrop-blur-md'
                : isOverDarkHero
                  ? 'rounded-full border border-white/30 bg-white/14 px-5 py-1.5 text-white/95 shadow-[0_4px_18px_rgba(0,0,0,0.12)] backdrop-blur-md'
                  : 'text-[var(--text-secondary)]'
            }`}
          >
            <a
              href="#pilares"
              className={
                isOverLightHero
                  ? 'hover:text-[#FF6B35]'
                  : isOverDarkHero
                    ? 'hover:text-white'
                    : 'hover:text-[var(--text-primary)]'
              }
            >
              3 Pilares
            </a>
            <a
              href="#desejos"
              className={
                isOverLightHero
                  ? 'hover:text-[#FF6B35]'
                  : isOverDarkHero
                    ? 'hover:text-white'
                    : 'hover:text-[var(--text-primary)]'
              }
            >
              Meus Desejos &amp; IA
            </a>
            <a
              href="#noite"
              className={
                isOverLightHero
                  ? 'hover:text-[#FF6B35]'
                  : isOverDarkHero
                    ? 'hover:text-white'
                    : 'hover:text-[var(--text-primary)]'
              }
            >
              A Noite Carioca
            </a>
            <a
              href="#club"
              className={
                isOverLightHero
                  ? 'hover:text-[#FF6B35]'
                  : isOverDarkHero
                    ? 'hover:text-white'
                    : 'hover:text-[var(--text-primary)]'
              }
            >
              Bora Club
            </a>
            <button
              type="button"
              onClick={() => onNavigate('/parceiros')}
              className={
                isOverLightHero
                  ? 'hover:text-[#FF6B35]'
                  : isOverDarkHero
                    ? 'hover:text-white'
                    : 'hover:text-[var(--text-primary)]'
              }
            >
              Para Estabelecimentos
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleTheme}
              title={isDark ? 'Mudar para Rio de dia' : 'Mudar para Rio à noite'}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                isOverLightHero
                  ? 'border-[#123B56]/15 bg-white/85 text-[#123B56] shadow-[0_4px_14px_rgba(16,47,70,0.08)] backdrop-blur-md hover:border-[#FF6B35]/50 hover:bg-white'
                  : isOverDarkHero
                    ? 'border-white/30 bg-white/14 text-white backdrop-blur-md hover:border-white/50 hover:bg-white/24'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-[var(--text-primary)] hover:border-[#FF765E]'
              }`}
            >
              {isDark ? (
                <Sun className="h-3.5 w-3.5 text-[#F7931E]" />
              ) : (
                <Moon className="h-3.5 w-3.5 text-[#123B56]" />
              )}
              <span className="hidden sm:inline">{isDark ? 'Rio de dia' : 'Rio à noite'}</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/app')}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-95"
            >
              Abrir App
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* 1. HERO CINEMATOGRÁFICO */}
      <section className="relative overflow-hidden text-white">
        <img
          src={isDark ? rioHeroNight : rioHeroDay}
          alt="Rio de Janeiro"
          className="absolute inset-0 h-full w-full object-cover object-[80%_center] sm:object-center"
        />
        {isDark ? (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#06101B]/55 via-[#06101B]/25 to-[#06101B]/90"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#06101B]/60 via-[#06101B]/20 to-transparent sm:from-transparent"
            />
          </>
        ) : (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0A1826]/70 via-[#0A1826]/35 to-[#0A1826]/90"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0A1826]/75 via-[#0A1826]/30 to-transparent sm:from-transparent"
            />
          </>
        )}
        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:grid-cols-12 lg:px-8 lg:pb-24 lg:pt-36">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/35 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-[#FFB347]" />
              Superapp de Experiências, Noite &amp; Concierge do Rio de Janeiro
            </div>

            <h1 className="font-sans mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl text-white">
              <span className="drop-shadow-[0_2px_14px_rgba(0,0,0,0.9)]">A cidade acontece.</span>{' '}
              <span className="bg-gradient-to-r from-[#FF5E36] via-[#FFA048] to-[#FFD166] bg-clip-text text-transparent drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
                Você aproveita.
              </span>
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-relaxed text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] font-medium sm:text-lg">
              Comer, curtir a noite ou passear: o BoraRio reúne gastronomia premiada, radar de festas e shows em tempo real, passeios adaptáveis ao clima e inteligência com IA para você não perder nada.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('/app')}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#FF4B2B]/30 transition hover:opacity-95 hover:scale-[1.02]"
              >
                <Compass className="h-4 w-4" />
                Explorar o Superapp
              </button>

              <button
                type="button"
                onClick={() => onNavigate('/parceiros')}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/30 bg-white/15 px-6 py-3.5 text-sm font-bold text-white shadow-[0_4px_16px_rgba(0,0,0,0.12)] backdrop-blur-md transition [text-shadow:0_1px_2px_rgba(0,0,0,0.35)] hover:border-white/50 hover:bg-white/25"
              >
                <Building2 className="h-4 w-4" />
                Área de Parceiros
              </button>

              {canInstallPwa && (
                <button
                  type="button"
                  onClick={onInstallPwa}
                  className="inline-flex items-center gap-2 rounded-2xl border border-[#4CA188]/50 bg-[#397B68]/35 px-4 py-3.5 text-xs font-bold text-white backdrop-blur-md transition hover:bg-[#397B68]/55"
                >
                  <Smartphone className="h-4 w-4" />
                  Instalar App
                </button>
              )}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-6 text-xs font-semibold text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-[#4CA188]" />
                {totalExperiences}+ experiências curadas no catálogo
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-[#FF6B35]" />
                Ingressos verificados Sympla &amp; Ingresse
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Sun className="h-4 w-4 text-[#F1E8D8]" />
                Clima em tempo real Open-Meteo
              </span>
            </div>
          </div>

          {/* Visual App Preview Card */}
          <div className="lg:col-span-5">
            <div
              className={`rounded-3xl border p-5 shadow-2xl backdrop-blur-xl ${
                isDark
                  ? 'border-white/25 bg-[#0A1D30]/80 text-white'
                  : 'border-white/80 bg-[#FAF7F2]/95 text-[#102F46]'
              }`}
            >
              <div
                className={`flex items-center justify-between border-b pb-3 ${
                  isDark ? 'border-white/20' : 'border-[#123B56]/12'
                }`}
              >
                <BrandLogo variant="horizontal" size="sm" onDark={isDark} />
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md ${
                    isDark
                      ? 'border-white/25 bg-white/15 text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]'
                      : 'border-[#123B56]/15 bg-white text-[#123B56]'
                  }`}
                >
                  {weather ? `${weather.temperatureC}°C · ${weather.weatherLabel}` : 'Rio ao vivo'}
                </span>
              </div>

              {/* 3 Pillars Quick Preview inside Card */}
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div
                    className={`rounded-xl border p-2.5 text-center backdrop-blur-md ${
                      isDark ? 'border-white/20 bg-white/5' : 'border-[#123B56]/10 bg-white/90'
                    }`}
                  >
                    <UtensilsCrossed className="mx-auto h-4 w-4 text-[#FF6B35]" />
                    <p className="mt-1 text-[11px] font-bold">Comer</p>
                    <p className="text-[9px] text-[var(--text-secondary)]">Gastronomia</p>
                  </div>
                  <div
                    className={`rounded-xl border p-2.5 text-center backdrop-blur-md ${
                      isDark ? 'border-white/20 bg-white/5' : 'border-[#123B56]/10 bg-white/90'
                    }`}
                  >
                    <Moon className="mx-auto h-4 w-4 text-[#FFB347]" />
                    <p className="mt-1 text-[11px] font-bold">Noite</p>
                    <p className="text-[9px] text-[var(--text-secondary)]">Bares &amp; Festas</p>
                  </div>
                  <div
                    className={`rounded-xl border p-2.5 text-center backdrop-blur-md ${
                      isDark ? 'border-white/20 bg-white/5' : 'border-[#123B56]/10 bg-white/90'
                    }`}
                  >
                    <Compass className="mx-auto h-4 w-4 text-[#0077B6]" />
                    <p className="mt-1 text-[11px] font-bold">Passeios</p>
                    <p className="text-[9px] text-[var(--text-secondary)]">Cultura &amp; Lazer</p>
                  </div>
                </div>

                <div
                  className={`rounded-2xl border p-3.5 backdrop-blur-md ${
                    isDark ? 'border-white/20 bg-[#0A1E30]/40' : 'border-[#123B56]/10 bg-white/85'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p
                      className={`text-[11px] font-bold uppercase tracking-wider ${
                        isDark ? 'text-[#F7931E]' : 'text-[#D95B26]'
                      }`}
                    >
                      Bora IA &amp; Radar
                    </p>
                    <span className="flex items-center gap-1 text-[10px] text-[#4CA188] font-bold">
                      <Sparkles className="h-3 w-3" /> Ao vivo
                    </span>
                  </div>
                  <p
                    className={`mt-1.5 text-xs font-medium leading-relaxed ${
                      isDark ? 'text-white/90' : 'text-[#102F46]'
                    }`}
                  >
                    Cole um link de post do Instagram ou foto de cardápio: nossa IA identifica o local, extrai detalhes e guarda em Meus Desejos.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate('/app')}
                  className="flex w-full items-center justify-between rounded-2xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-4 py-3 text-xs font-bold text-white shadow-md hover:opacity-95"
                >
                  <span>Entrar no Superapp BoraRio</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. OS 3 PILARES DO RIO */}
      <section id="pilares" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-[#FF6B35]">
            Experiência Integrada
          </span>
          <h2 className="mt-2 font-sans text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl">
            Os 3 Pilares do Rio de Janeiro
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
            Uma única interface intuitiva que resolve seu programa completo: onde almoçar, o que fazer à tarde e onde a noite carioca vai ferver.
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          {PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-7 shadow-sm transition hover:-translate-y-1 hover:border-[#FF6B35]/40 hover:shadow-xl"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${p.color} text-white shadow-md`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="rounded-full bg-[var(--bg-subtle)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                      {p.badge}
                    </span>
                  </div>

                  <h3 className="mt-5 font-sans text-2xl font-bold text-[var(--text-primary)]">
                    {p.title}
                  </h3>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#FF6B35]">
                    {p.subtitle}
                  </p>

                  <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                    {p.description}
                  </p>
                </div>

                <div className="mt-6 border-t border-[var(--border-hairline)] pt-4">
                  <div className="flex flex-wrap gap-1.5">
                    {p.highlights.map((h) => (
                      <span
                        key={h}
                        className="rounded-lg bg-[var(--bg-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Moment pills showcase */}
        <div className="mt-14 rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/60 p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#FF6B35]">
                Filtros Instantâneos
              </p>
              <h3 className="mt-1 font-sans text-xl font-bold text-[var(--text-primary)]">
                Qual é a sua vibe hoje?
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/app')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FF6B35] hover:underline"
            >
              <span>Ver todos no app</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MOMENT_PILLS.map((m) => (
              <div
                key={m.label}
                className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 transition hover:border-[#FF6B35]/40"
              >
                <p className="text-sm font-bold text-[var(--text-primary)]">{m.label}</p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. MEUS DESEJOS & EXTRAÇÃO POR IA */}
      <section id="desejos" className="border-y border-[var(--border-hairline)] bg-[var(--bg-subtle)]/40 py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FF6B35]/30 bg-[#FF6B35]/10 px-3.5 py-1 text-xs font-bold text-[#FF6B35]">
              <Sparkles className="h-3.5 w-3.5" />
              Inteligência Artificial &amp; Desejos
            </div>
            <h2 className="mt-4 font-sans text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl">
              Meus Desejos: nunca mais perca um lugar que você viu no Instagram
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
              Viu um vídeo de um restaurante incrível ou uma festa no fim de semana? Basta colar o link ou print no app. A Bora IA identifica o estabelecimento, localiza o endereço e salva nos seus Desejos.
            </p>

            <div className="mt-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF6B35]/15 text-[#FF6B35]">
                  <Bookmark className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[var(--text-primary)]">
                    Salvar sem complicação
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Guarde estabelecimentos, festas ou links externos com anotações pessoais de orçamento e data ideal.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#4CA188]/15 text-[#4CA188]">
                  <Share2 className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[var(--text-primary)]">
                    Acompanhar Oportunidades
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Manifeste interesse em uma casa e receba avisos quando o parceiro disponibilizar ofertas ou cortesias compatíveis.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0077B6]/15 text-[#0077B6]">
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[var(--text-primary)]">
                    Transformar Desejo em Plano
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Converta qualquer item salvo em um roteiro completo, convide amigos e divida a programação.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <button
                type="button"
                onClick={() => onNavigate('/app')}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#123B56] px-6 py-3.5 text-sm font-bold text-white shadow-md hover:bg-[#102F46]"
              >
                Experimentar Meus Desejos
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Visual Showcase of Wishes / AI */}
          <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-r from-[#FF4B2B] to-[#FF6B35] text-white">
                  <Bookmark className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--text-primary)]">Meus Desejos</p>
                  <p className="text-[10px] text-[var(--text-secondary)]">Seu cofre de experiências</p>
                </div>
              </div>
              <span className="rounded-full bg-[#4CA188]/15 px-2.5 py-0.5 text-[11px] font-bold text-[#4CA188]">
                IA Ativa
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF6B35]">
                    Link Identificado por IA
                  </span>
                  <span className="text-[10px] text-[var(--text-secondary)]">Instagram Reel</span>
                </div>
                <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">
                  Itacoa Rio · Leblon
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  Gastronomia contemporânea com menu autoral do chef.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="rounded-md bg-white/80 dark:bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-[#4CA188]">
                    Oportunidade Ativa: Cortesia de Sobremesa
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#0077B6]">
                    Festa &amp; Ingressos
                  </span>
                  <span className="text-[10px] text-[var(--text-secondary)]">Sympla Verificado</span>
                </div>
                <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">
                  Roda de Samba do Trabalhador · Andaraí
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  Segunda-feira clássica com Moacyr Luz e convidados.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. A NOITE CARIOCA & RADAR */}
      <section id="noite" className="bg-[#07111C] py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-[#FFB347]">
              <Moon className="h-3.5 w-3.5" />
              Radar Noturno
            </div>
            <h2 className="mt-4 font-sans text-3xl font-extrabold tracking-tight sm:text-4xl">
              A Noite Carioca: festas, shows e sambas sem enrolação
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#F1E8D8]/80 sm:text-base">
              A programação noturna do Rio muda rápido. O BoraRio sincroniza os melhores eventos com curadoria criteriosa, sem eventos passados e sem repetições.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur-md">
              <Music className="h-6 w-6 text-[#FF6B35]" />
              <h3 className="mt-3 text-base font-bold text-white">Rodas de Samba &amp; Pagode</h3>
              <p className="mt-1.5 text-xs text-white/70">
                Pedra do Sal, Beco do Rato, Renascença e os sambas tradicionais da Lapa e Zona Norte.
              </p>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur-md">
              <Crown className="h-6 w-6 text-[#FFB347]" />
              <h3 className="mt-3 text-base font-bold text-white">Festas &amp; Eletrônico</h3>
              <p className="mt-1.5 text-xs text-white/70">
                Hubs no Porto Maravilha, Baixo Gávea, Botafogo e os line-ups das principais noites.
              </p>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur-md">
              <CalendarDays className="h-6 w-6 text-[#90E0EF]" />
              <h3 className="mt-3 text-base font-bold text-white">Ingressos Oficiais</h3>
              <p className="mt-1.5 text-xs text-white/70">
                Integração direta com Sympla e Ingresse para você garantir seu lote sem taxas extras.
              </p>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur-md">
              <Clock className="h-6 w-6 text-[#4CA188]" />
              <h3 className="mt-3 text-base font-bold text-white">Varrer &amp; Expirar</h3>
              <p className="mt-1.5 text-xs text-white/70">
                Eventos encerrados saem automaticamente do ar, garantindo uma agenda sempre viva.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. BORA CLUB & RIO POINTS */}
      <section id="club" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-[#FF6B35]">
            Vantagens Concretas
          </span>
          <h2 className="mt-2 font-sans text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl">
            Bora Club &amp; Rio Points
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-[var(--text-secondary)] sm:text-base">
            Benefícios reais nos melhores estabelecimentos da cidade, sem intermediação invasiva.
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-7 shadow-sm">
            <Crown className="h-8 w-8 text-[#FF6B35]" />
            <h3 className="mt-4 font-sans text-xl font-bold">Reservas &amp; Vantagens</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              Faça reservas diretas, garanta cortesias exclusivas (como welcome drinks ou sobremesas) e participe de demandas especiais.
            </p>
          </div>

          <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-7 shadow-sm">
            <QrCode className="h-8 w-8 text-[#0077B6]" />
            <h3 className="mt-4 font-sans text-xl font-bold">Check-in Dinâmico Antifraude</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              Ao chegar ao local, escaneie o QR Code dinâmico com expiração temporária para validar sua visita real e liberar pontos com segurança.
            </p>
          </div>

          <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-7 shadow-sm">
            <Award className="h-8 w-8 text-[#4CA188]" />
            <h3 className="mt-4 font-sans text-xl font-bold">Rio Points no Passaporte</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              Colecione selos digitais dos bairros do Rio, acumule Rio Points e troque por recompensas e experiências autênticas.
            </p>
          </div>
        </div>
      </section>

      {/* 6. CTA PARA PARCEIROS */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-8 rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8 shadow-sm lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-widest text-[#0077B6]">
              Para Donos de Restaurantes &amp; Bares
            </span>
            <h3 className="mt-2 font-sans text-2xl font-bold sm:text-3xl">
              Atraia clientes qualificados com 0% de comissão sobre a conta.
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              Controle sua capacidade de salão, configure ofertas individuais ou preencha noites de baixa com reservas inteligentes por demanda.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/parceiros')}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#123B56] px-6 py-3.5 text-sm font-bold text-white hover:bg-[#102F46]"
            >
              Conhecer Parcerias
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/parceiros/painel')}
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border-hairline)] px-5 py-3.5 text-sm font-bold hover:border-[#FF6B35]"
            >
              Painel do Parceiro
            </button>
          </div>
        </div>
      </section>

      {/* 7. CTA FINAL */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-6 py-14 text-center text-white shadow-xl sm:px-12">
          <h2 className="font-sans text-3xl font-extrabold sm:text-4xl">
            Pronto para viver o melhor do Rio hoje?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/95 sm:text-base">
            Abra o Superapp BoraRio gratuitamente no navegador ou instale como app no seu celular.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <button
              type="button"
              onClick={() => onNavigate('/app')}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#061524] px-8 py-4 text-sm font-bold text-white shadow-lg transition hover:scale-105"
            >
              <span>Abrir Superapp BoraRio</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER INSTITUCIONAL (SEM LINKS ADMIN PÚBLICOS) */}
      <footer className="border-t border-[var(--border-hairline)] bg-[var(--bg-surface)] py-12">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 md:grid-cols-4 lg:px-8">
          <div className="md:col-span-2">
            <BrandLogo variant="horizontal" size="md" onDark={isDark} showTagline />
            <p className="mt-3 max-w-md text-xs leading-relaxed text-[var(--text-secondary)]">
              BoraRio — Superapp de Experiências, Noite &amp; Concierge do Rio de Janeiro. Mapas
              OpenStreetMap &amp; Leaflet · Clima Open-Meteo · Persistência Segura.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
              Ecossistema
            </h4>
            <ul className="mt-3 space-y-2 text-xs text-[var(--text-secondary)]">
              <li>
                <button type="button" onClick={() => onNavigate('/app')} className="hover:text-[#FF6B35]">
                  Superapp BoraRio
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('/parceiros')} className="hover:text-[#FF6B35]">
                  Área de Parceiros Comerciais
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('/parceiros/painel')} className="hover:text-[#FF6B35]">
                  Painel B2B do Parceiro
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
              Institucional
            </h4>
            <ul className="mt-3 space-y-2 text-xs text-[var(--text-secondary)]">
              <li>
                <button type="button" onClick={() => setLegalModal('about')} className="hover:text-[#FF6B35]">
                  Sobre o BoraRio
                </button>
              </li>
              <li>
                <a href="mailto:contato@borario.app" className="hover:text-[#FF6B35]">
                  Contato: contato@borario.app
                </a>
              </li>
              <li>
                <button type="button" onClick={() => setLegalModal('terms')} className="hover:text-[#FF6B35]">
                  Termos de Uso
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setLegalModal('privacy')} className="hover:text-[#FF6B35]">
                  Política de Privacidade (LGPD)
                </button>
              </li>
            </ul>
          </div>
        </div>
      </footer>

      {/* Institutional Modal */}
      {legalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-w-lg rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 shadow-2xl">
            <h3 className="font-sans text-2xl font-bold text-[var(--text-primary)]">
              {legalModal === 'about'
                ? 'Sobre o BoraRio'
                : legalModal === 'terms'
                ? 'Termos de Uso'
                : 'Política de Privacidade & LGPD'}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
              {legalModal === 'about' &&
                'O BoraRio nasceu da evolução do Rio Gastro Guide para conectar cariocas e visitantes a experiências reais no Rio de Janeiro, com transparência sobre a origem de cada informação.'}
              {legalModal === 'terms' &&
                'As informações de catálogo exibem sua respectiva fonte. Reservas enviadas são solicitações sujeitas à confirmação do estabelecimento parceiro.'}
              {legalModal === 'privacy' &&
                'Seguimos a LGPD: geolocalização e personalização de feed são opcionais e controladas diretamente por você no aplicativo, com armazenamento local seguro.'}
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="rounded-xl bg-[#123B56] px-4 py-2 text-xs font-bold text-white hover:bg-[#102F46]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
