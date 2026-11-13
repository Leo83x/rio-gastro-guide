import {
  ArrowRight,
  Award,
  Building2,
  CalendarDays,
  CheckCircle2,
  CloudRain,
  Compass,
  Crown,
  MapPin,
  Moon,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  Users,
  UtensilsCrossed,
  Vote,
} from 'lucide-react';
import { useEffect, useState } from 'react';
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

const MOMENT_PILLS = [
  { label: 'Família & Kids', desc: 'Parques, museus interativos e restaurantes com espaço kids' },
  { label: 'Modo Casal', desc: 'Rooftops ao pôr do sol, bistrôs intimistas e jazz' },
  { label: 'Galera & Votação', desc: 'Botecos clássicos, mesas grandes e votação em grupo' },
  { label: 'Turista', desc: 'Ícones cariocas, praias e roteiros otimizados por região' },
  { label: 'Modo Chuva', desc: 'Locais cobertos, teatros, centros culturais e cafés' },
  { label: 'Econômico / Gratuito', desc: 'Passeios gratuitos, trilhas e achados com ótimo custo-benefício' },
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

  useEffect(() => {
    fetchRioWeatherLive().then(setWeather).catch(() => undefined);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="flex items-center gap-2 text-left"
          >
            <BrandLogo variant="horizontal" size="md" onDark={isDark} />
          </button>

          <nav className="hidden items-center gap-6 text-sm font-semibold text-[var(--text-secondary)] md:flex">
            <a href="#descubra" className="hover:text-[var(--text-primary)]">
              Descubra
            </a>
            <a href="#inteligencia" className="hover:text-[var(--text-primary)]">
              Seu Rio, agora
            </a>
            <a href="#planeje" className="hover:text-[var(--text-primary)]">
              Planejador IA
            </a>
            <a href="#club" className="hover:text-[var(--text-primary)]">
              Rio Gastro Club
            </a>
            <button
              type="button"
              onClick={() => onNavigate('/parceiros')}
              className="hover:text-[var(--text-primary)]"
            >
              Para Estabelecimentos
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleTheme}
              title={isDark ? 'Mudar para Rio de dia' : 'Mudar para Rio à noite'}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[#FF765E]"
            >
              {isDark ? <Sun className="h-3.5 w-3.5 text-[#FF765E]" /> : <Moon className="h-3.5 w-3.5 text-[#123B56]" />}
              <span className="hidden sm:inline">{isDark ? 'Rio de dia' : 'Rio à noite'}</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/app')}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#FF765E] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#e8634c]"
            >
              Abrir App
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* 1. HERO CINEMATOGRÁFICO */}
      <section className="relative overflow-hidden bg-borario-night text-white">
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 25%, #FF765E 0%, transparent 45%), radial-gradient(circle at 80% 70%, #397B68 0%, transparent 45%)',
          }}
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:px-8 lg:py-24">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-[#F1E8D8] backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-[#FF765E]" />
              Superapp de Experiências & Concierge do Rio de Janeiro
            </div>

            <h1 className="font-editorial mt-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              A cidade acontece.{' '}
              <span className="text-[#FF765E]">Você aproveita.</span>
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#F1E8D8]/90 sm:text-lg">
              Do almoço de família em Santa Teresa ao rooftop no Leblon, passando por shows,
              museus e roteiros inteligentes que se adaptam ao clima do Rio em tempo real.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('/app')}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#FF765E] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#FF765E]/25 transition hover:bg-[#eb634b]"
              >
                <Compass className="h-4 w-4" />
                Explorar o App Agora
              </button>

              <button
                type="button"
                onClick={() => onNavigate('/parceiros')}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-6 py-3.5 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                <Building2 className="h-4 w-4" />
                Para Estabelecimentos
              </button>

              {canInstallPwa && (
                <button
                  type="button"
                  onClick={onInstallPwa}
                  className="inline-flex items-center gap-2 rounded-2xl border border-[#397B68] bg-[#397B68]/30 px-4 py-3.5 text-xs font-bold text-white transition hover:bg-[#397B68]/50"
                >
                  <Smartphone className="h-4 w-4" />
                  Instalar PWA
                </button>
              )}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-6 text-xs text-[#F1E8D8]/80">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-[#397B68]" />
                {totalExperiences}+ locais e experiências no catálogo
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-[#FF765E]" />
                Curadoria com origem de dados transparente
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Sun className="h-4 w-4 text-[#F1E8D8]" />
                Modos Rio de dia &amp; Rio à noite
              </span>
            </div>
          </div>

          {/* Visual App Preview Card */}
          <div className="lg:col-span-5">
            <div className="rounded-3xl border border-white/15 bg-[#123B56]/80 p-5 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <BrandLogo variant="horizontal" size="sm" onDark />
                <span className="rounded-full bg-[#397B68]/30 px-2.5 py-1 text-[11px] font-semibold text-[#A7E3CE]">
                  {weather ? `${weather.temperatureC}°C · ${weather.weatherLabel}` : 'Rio ao vivo'}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div className="rounded-2xl bg-white/10 p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#FF765E]">
                    Seu Rio, agora
                  </p>
                  <p className="mt-1 text-sm font-medium text-white">
                    {weather
                      ? `${weather.isRaining ? 'Dia chuvoso — Modo Chuva ativado com locais cobertos.' : 'Tempo firme para rooftops, praias e passeios ao ar livre.'}`
                      : 'Clima em tempo real integrado via Open-Meteo.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-[#102F46] p-3.5">
                    <UtensilsCrossed className="h-5 w-5 text-[#FF765E]" />
                    <p className="mt-2 text-xs font-bold text-white">Gastronomia</p>
                    <p className="mt-0.5 text-[11px] text-[#B4C2CB]">Botecos, bistrôs &amp; alta cozinha</p>
                  </div>
                  <div className="rounded-2xl bg-[#102F46] p-3.5">
                    <Vote className="h-5 w-5 text-[#397B68]" />
                    <p className="mt-2 text-xs font-bold text-white">Onde Vamos?</p>
                    <p className="mt-0.5 text-[11px] text-[#B4C2CB]">Votação em grupo + dividir conta</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate('/app')}
                  className="flex w-full items-center justify-between rounded-2xl bg-[#FF765E] px-4 py-3 text-xs font-bold text-white hover:bg-[#e8634c]"
                >
                  <span>Entrar no Superapp BoraRio</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. DESCUBRA O RIO DO SEU JEITO */}
      <section id="descubra" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-widest text-[#FF765E]">
            Descoberta Inteligente
          </span>
          <h2 className="font-editorial mt-2 text-3xl font-bold text-[var(--text-primary)] sm:text-4xl">
            Descubra o Rio do seu jeito
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
            Escolha o seu momento em 1 clique e filtre gastronomia, eventos, cultura, praias,
            atrações infantis e vida noturna sem perder tempo.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MOMENT_PILLS.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 shadow-sm transition hover:border-[#FF765E]/60"
            >
              <h3 className="font-editorial text-lg font-bold text-[var(--text-primary)]">
                {item.label}
              </h3>
              <p className="mt-1.5 text-sm text-[var(--text-secondary)]">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. INTELIGÊNCIA EM TEMPO REAL */}
      <section id="inteligencia" className="border-y border-[var(--border-hairline)] bg-[var(--bg-subtle)]/60 py-16">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-[#397B68]">
              Seu Rio, Agora
            </span>
            <h2 className="font-editorial mt-2 text-3xl font-bold text-[var(--text-primary)] sm:text-4xl">
              Contexto real da cidade, sem promessas falsas
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
              O BoraRio cruza clima ao vivo (Open-Meteo), horário do dia e características de cada
              local. Quando um dado é uma estimativa da plataforma (como mobilidade ou faixa de
              movimento), exibimos isso com total transparência.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-3 text-xs">
                <p className="font-bold text-[var(--text-primary)]">
                  {weather ? `${weather.temperatureC}°C · ${weather.weatherLabel}` : 'Open-Meteo Ao Vivo'}
                </p>
                <p className="text-[var(--text-secondary)]">Fonte meteorológica confirmada</p>
              </div>
              <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-3 text-xs">
                <p className="font-bold text-[var(--text-primary)]">Modo Chuva Automático</p>
                <p className="text-[var(--text-secondary)]">Prioriza locais cobertos quando chove</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 shadow-md">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#397B68]">
                <CloudRain className="h-4 w-4" />
                Inteligência Contextual
              </span>
              <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                Transparência de Dados
              </span>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-[var(--text-secondary)]">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#397B68]" />
                <span>Clima em tempo real com timestamp da última leitura.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#397B68]" />
                <span>Selo claro separando foto real do estabelecimento, foto editorial e placeholder.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#397B68]" />
                <span>Consentimento LGPD explícito para personalização e geolocalização.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 4. PLANEJE E DECIDA EM GRUPO */}
      <section id="planeje" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
            <Sparkles className="h-7 w-7 text-[#FF765E]" />
            <h3 className="font-editorial mt-4 text-xl font-bold">Roteiro do Dia com IA</h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Monte uma linha do tempo completa com custo estimado por parada e botão{' '}
              <strong>Recalcular se Chover</strong>.
            </p>
          </div>
          <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
            <Users className="h-7 w-7 text-[#123B56] dark:text-[#FF765E]" />
            <h3 className="font-editorial mt-4 text-xl font-bold">Votação "Onde Vamos?"</h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Selecione 3 a 5 opções, gere um link compartilhável para os amigos votarem e decida
              sem discussão no grupo.
            </p>
          </div>
          <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
            <MapPin className="h-7 w-7 text-[#397B68]" />
            <h3 className="font-editorial mt-4 text-xl font-bold">Mapa Interativo do Rio</h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Visualize todos os estabelecimentos e experiências georreferenciados com OpenStreetMap
              &amp; Leaflet.
            </p>
          </div>
        </div>
      </section>

      {/* 5. RIO GASTRO CLUB & 6. AGENDA VIVA & 7. RIO POINTS */}
      <section id="club" className="bg-borario-day py-16 text-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
          <div className="rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-md">
            <Crown className="h-7 w-7 text-[#F1E8D8]" />
            <h3 className="font-editorial mt-4 text-2xl font-bold">Rio Gastro Club</h3>
            <p className="mt-2 text-sm text-[#F1E8D8]/90">
              Benefícios exclusivos em restaurantes parceiros e drops curados, com transparência
              entre ofertas demonstrativas e ofertas confirmadas por parceiros.
            </p>
          </div>

          <div className="rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-md">
            <CalendarDays className="h-7 w-7 text-[#FF765E]" />
            <h3 className="font-editorial mt-4 text-2xl font-bold">Agenda Viva da Cidade</h3>
            <p className="mt-2 text-sm text-[#F1E8D8]/90">
              Shows, exposições, feiras gastronômicas e programação infantil no Rio com solicitação
              de reserva registrada e rastreável.
            </p>
          </div>

          <div className="rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Award className="h-7 w-7 text-[#F1E8D8]" />
              <QrCode className="h-5 w-5 text-[#FF765E]" />
            </div>
            <h3 className="font-editorial mt-4 text-2xl font-bold">Rio Points &amp; Passaporte</h3>
            <p className="mt-2 text-sm text-[#F1E8D8]/90">
              Check-in por QR Code com proteção antifraude (limite diário por local e nonce único)
              para acumular pontos no Passaporte Carioca.
            </p>
          </div>
        </div>
      </section>

      {/* 8. PARA ESTABELECIMENTOS */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-8 rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8 shadow-sm lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-widest text-[#397B68]">
              Área de Parceiros B2B
            </span>
            <h2 className="font-editorial mt-2 text-3xl font-bold text-[var(--text-primary)]">
              Tem um restaurante, bar ou espaço cultural no Rio?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
              Reivindique o perfil do seu estabelecimento, publique fotos oficiais, receba solicitações
              de reserva e crie benefícios no Rio Gastro Club através de um painel exclusivo.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/parceiros')}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#123B56] px-6 py-3.5 text-sm font-bold text-white hover:bg-[#102F46]"
            >
              Conhecer Área de Parceiros
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/parceiros/painel')}
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border-hairline)] px-5 py-3.5 text-sm font-bold text-[var(--text-primary)] hover:border-[#FF765E]"
            >
              Acessar Painel do Parceiro
            </button>
          </div>
        </div>
      </section>

      {/* 9. CTA FINAL */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-borario-coral px-6 py-12 text-center text-white shadow-xl sm:px-12">
          <h2 className="font-editorial text-3xl font-bold sm:text-4xl">
            Pronto para viver o melhor do Rio hoje?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/90 sm:text-base">
            Abra o Superapp BoraRio gratuitamente no navegador ou instale como aplicativo PWA no seu
            celular.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/app')}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#102F46] px-7 py-3.5 text-sm font-bold text-white shadow-md hover:bg-[#0a2132]"
            >
              Abrir Superapp BoraRio
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER INSTITUCIONAL */}
      <footer className="border-t border-[var(--border-hairline)] bg-[var(--bg-surface)] py-12">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 md:grid-cols-4 lg:px-8">
          <div className="md:col-span-2">
            <BrandLogo variant="horizontal" size="md" onDark={isDark} showTagline />
            <p className="mt-3 max-w-md text-xs leading-relaxed text-[var(--text-secondary)]">
              BoraRio — Superapp de Experiências e Concierge Inteligente do Rio de Janeiro. Mapas
              OpenStreetMap &amp; Leaflet · Clima Open-Meteo · Persistência Híbrida.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
              Ecossistema
            </h4>
            <ul className="mt-3 space-y-2 text-xs text-[var(--text-secondary)]">
              <li>
                <button type="button" onClick={() => onNavigate('/app')} className="hover:text-[#FF765E]">
                  Superapp BoraRio (/app)
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('/parceiros')} className="hover:text-[#FF765E]">
                  Seja parceiro (/parceiros)
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('/parceiros/painel')} className="hover:text-[#FF765E]">
                  Painel do Parceiro
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('/admin')} className="hover:text-[#FF765E]">
                  Administração (/admin)
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
                <button type="button" onClick={() => setLegalModal('about')} className="hover:text-[#FF765E]">
                  Sobre o BoraRio
                </button>
              </li>
              <li>
                <a href="mailto:contato@borario.app" className="hover:text-[#FF765E]">
                  Contato: contato@borario.app
                </a>
              </li>
              <li>
                <button type="button" onClick={() => setLegalModal('terms')} className="hover:text-[#FF765E]">
                  Termos de uso
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setLegalModal('privacy')} className="hover:text-[#FF765E]">
                  Política de privacidade (LGPD)
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
            <h3 className="font-editorial text-2xl font-bold text-[var(--text-primary)]">
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
                'As informações de catálogo exibem sua respectiva fonte (OpenStreetMap, Google Places API, importação validada ou dados fornecidos pelo estabelecimento). Reservas enviadas são solicitações sujeitas à confirmação do estabelecimento.'}
              {legalModal === 'privacy' &&
                'Seguimos a LGPD: geolocalização e personalização de feed são opcionais e controladas diretamente por você na aba Perfil do aplicativo, com armazenamento local seguro.'}
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
