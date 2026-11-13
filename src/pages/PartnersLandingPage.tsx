import {
  ArrowRight,
  Building2,
  CalendarCheck,
  Camera,
  CheckCircle2,
  Crown,
  Moon,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import type { AppRoute } from '../services/router';

interface PartnersLandingPageProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onNavigate: (route: AppRoute) => void;
}

export function PartnersLandingPage({
  isDark,
  onToggleTheme,
  onNavigate,
}: PartnersLandingPageProps) {
  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => onNavigate('/')} className="text-left">
              <BrandLogo variant="horizontal" size="sm" onDark={isDark} />
            </button>
            <span className="hidden rounded-full bg-[#397B68]/15 px-2.5 py-0.5 text-[11px] font-bold text-[#397B68] sm:inline-block">
              Para Estabelecimentos
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
            >
              {isDark ? <Sun className="h-4 w-4 text-[#FF765E]" /> : <Moon className="h-4 w-4 text-[#123B56]" />}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/app')}
              className="rounded-full border border-[var(--border-hairline)] px-3.5 py-1.5 text-xs font-semibold hover:border-[#FF765E]"
            >
              Ver App
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/parceiros/painel')}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#123B56] px-4 py-2 text-xs font-bold text-white hover:bg-[#102F46]"
            >
              Painel do Parceiro
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-borario-day py-16 text-white sm:py-20">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3.5 py-1 text-xs font-semibold text-[#F1E8D8]">
            <Building2 className="h-3.5 w-3.5 text-[#FF765E]" />
            BoraRio para Negócios &amp; Cultura
          </span>
          <h1 className="font-editorial mt-4 text-4xl font-bold leading-tight sm:text-5xl">
            Conecte seu estabelecimento ao público que realmente sai no Rio.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-[#F1E8D8]/90 sm:text-base">
            Gerencie suas informações oficiais, publique fotografias autorizadas, receba
            solicitações de reserva e ative benefícios no Rio Gastro Club sem perder o controle da
            sua marca.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/parceiros/painel')}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#FF765E] px-6 py-3.5 text-sm font-bold text-white shadow-lg hover:bg-[#e8634c]"
            >
              Entrar no Painel do Parceiro
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/app')}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-6 py-3.5 text-sm font-bold text-white hover:bg-white/20"
            >
              Reivindicar meu Perfil no App
            </button>
          </div>
        </div>
      </section>

      {/* Benefits Grid */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
            <ShieldCheck className="h-7 w-7 text-[#397B68]" />
            <h3 className="font-editorial mt-4 text-lg font-bold">Perfil Verificado</h3>
            <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
              Substitua dados genéricos por informações confirmadas pelo próprio estabelecimento,
              com selo de confiança no guia.
            </p>
          </div>

          <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
            <Camera className="h-7 w-7 text-[#FF765E]" />
            <h3 className="font-editorial mt-4 text-lg font-bold">Fotos Oficiais Reais</h3>
            <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
              Nunca usamos fotos genéricas para enganar o cliente. Envie suas fotos reais para
              destaque imediato no feed.
            </p>
          </div>

          <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
            <CalendarCheck className="h-7 w-7 text-[#123B56] dark:text-[#FF765E]" />
            <h3 className="font-editorial mt-4 text-lg font-bold">Solicitações de Reserva</h3>
            <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
              Receba pedidos de reserva com data, horário e tamanho do grupo no seu painel
              exclusivo de parceiro.
            </p>
          </div>

          <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
            <Crown className="h-7 w-7 text-[#D49B27]" />
            <h3 className="font-editorial mt-4 text-lg font-bold">Rio Gastro Club</h3>
            <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
              Crie benefícios em horários estratégicos (ex: terça a quinta) para atrair novos
              clientes qualificados.
            </p>
          </div>
        </div>

        <div className="mt-12 rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8">
          <h2 className="font-editorial text-2xl font-bold">Como funciona a adesão</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {[
              {
                step: '1. Localize ou reivindique',
                text: 'Encontre seu estabelecimento no BoraRio e clique em "É dono deste local?" para solicitar verificação.',
              },
              {
                step: '2. Acesse seu Painel Isolado',
                text: 'Cada parceiro acessa exclusivamente os dados, reservas e campanhas do seu próprio estabelecimento.',
              },
              {
                step: '3. Ative presença & Club',
                text: 'Atualize horários, fotos e benefícios em tempo real para aparecer nos roteiros inteligentes.',
              },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#397B68]" />
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">{item.step}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                    {item.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
