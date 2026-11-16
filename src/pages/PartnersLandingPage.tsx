import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  ChevronRight,
  Gift,
  Moon,
  QrCode,
  ShieldCheck,
  Sparkles,
  Sun,
  TrendingUp,
  Users2,
  Wallet,
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
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] selection:bg-[#FF6B35] selection:text-white">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => onNavigate('/')} className="text-left">
              <BrandLogo variant="horizontal" size="md" onDark={isDark} />
            </button>
            <span className="hidden rounded-full bg-[#123B56]/10 px-3 py-1 text-xs font-bold text-[#0077B6] dark:bg-[#0077B6]/15 dark:text-[#90E0EF] sm:inline-block">
              BoraRio Partners
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Alternar tema"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-primary)] transition hover:border-[#FF6B35]"
            >
              {isDark ? <Sun className="h-4 w-4 text-[#F7931E]" /> : <Moon className="h-4 w-4 text-[#123B56]" />}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/app')}
              className="rounded-full border border-[var(--border-hairline)] px-4 py-2 text-xs font-bold text-[var(--text-primary)] transition hover:border-[#FF6B35]"
            >
              Ver Aplicativo
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/parceiros/painel')}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-[#FF4B2B]/20 transition hover:brightness-105"
            >
              Painel do Parceiro
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Premium */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#07111C] via-[#0A1828] to-[#0E2235] py-20 text-white sm:py-28">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-[#FF6B35]/15 blur-3xl" />
          <div className="absolute right-10 top-1/2 h-80 w-80 rounded-full bg-[#0077B6]/20 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-[#FFB347] backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5" />
            Parceiros Comerciais · Rio de Janeiro
          </div>

          <h1 className="mt-6 font-sans text-4xl font-extrabold tracking-tight text-white sm:text-6xl sm:leading-tight">
            Mais clientes qualificados na sua casa.{' '}
            <span className="bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] bg-clip-text text-transparent">
              Sem comissão sobre a conta.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[#F1E8D8]/90 sm:text-lg">
            Preencha seus salões nos dias certos, atraia clientes que consomem e receba 100% do faturamento diretamente no seu caixa.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => onNavigate('/parceiros/painel')}
              className="inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-8 py-4 text-base font-bold text-white shadow-xl shadow-[#FF4B2B]/30 transition hover:scale-[1.02] hover:brightness-105"
            >
              <span>Acessar Painel B2B</span>
              <ArrowRight className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/app')}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-6 py-4 text-base font-bold text-white backdrop-blur-md transition hover:bg-white/20"
            >
              Conhecer a Experiência
            </button>
          </div>

          {/* 3 Pillars Highlight Bar */}
          <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-6 backdrop-blur-md">
              <div className="font-sans text-3xl font-extrabold text-[#FF6B35]">0%</div>
              <div className="mt-1 text-sm font-bold text-white">Comissão sobre a Conta</div>
              <p className="mt-1.5 text-xs text-white/70">100% do consumo pago direto no seu balcão.</p>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/5 p-6 backdrop-blur-md">
              <div className="font-sans text-3xl font-extrabold text-[#4CA188]">100%</div>
              <div className="mt-1 text-sm font-bold text-white">Autonomia de Regras</div>
              <p className="mt-1.5 text-xs text-white/70">Você define capacidade, horários e dias.</p>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/5 p-6 backdrop-blur-md">
              <div className="font-sans text-3xl font-extrabold text-[#90E0EF]">Zero</div>
              <div className="mt-1 text-sm font-bold text-white">Desconto Obrigatório</div>
              <p className="mt-1.5 text-xs text-white/70">Participe com reservas normais do cardápio.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Modalidades de Ocupação */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-[#FF6B35]">
            Flexibilidade Total
          </span>
          <h2 className="mt-2 font-sans text-3xl font-extrabold tracking-tight sm:text-4xl">
            Escolha como a sua casa quer participar
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-[var(--text-secondary)]">
            Diferentes estratégias para dias de pico, almoço executivo ou noites de baixa ocupação.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: CalendarCheck2,
              title: 'Reserva Tradicional',
              badge: 'Preço cheio',
              desc: 'Disponibilize mesas e turnos com seu cardápio regular, sem qualquer desconto obrigatório.',
            },
            {
              icon: Gift,
              title: 'Ofertas & Cortesias',
              badge: 'Atração imediata',
              desc: 'Crie uma cortesia ou menu degustação exclusivo para atrair clientes em horários estratégicos.',
            },
            {
              icon: Users2,
              title: 'Demanda por Meta',
              badge: 'Ocupação garantida',
              desc: 'Abra janelas especiais que só se confirmam se atingirem o número mínimo de reservas definido por você.',
            },
            {
              icon: TrendingUp,
              title: 'Última Hora',
              badge: 'Anti-ociosidade',
              desc: 'Preencha cancelamentos de última hora com condições pontuais para o mesmo dia.',
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="group flex flex-col justify-between rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-7 shadow-xs transition hover:-translate-y-1 hover:border-[#FF6B35]/50 hover:shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FF6B35]/10 text-[#FF6B35]">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="rounded-full bg-[var(--bg-canvas)] px-3 py-1 text-xs font-bold text-[var(--text-secondary)]">
                      {item.badge}
                    </span>
                  </div>
                  <h3 className="mt-5 font-sans text-lg font-bold text-[var(--text-primary)]">
                    {item.title}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Garantias Operacionais (Clean & Direto) */}
      <section className="border-t border-[var(--border-hairline)] bg-[var(--bg-surface)]/60 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-[#397B68]">
              Segurança & Transparência
            </span>
            <h2 className="mt-2 font-sans text-3xl font-extrabold tracking-tight sm:text-4xl">
              Como funciona o dia a dia na sua operação
            </h2>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#397B68]/15 text-[#397B68]">
                <Wallet className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-sans text-xl font-bold text-[var(--text-primary)]">
                Pagamento direto no seu caixa
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                O BoraRio não intermedeia o pagamento da conta. O cliente consome e paga normalmente no seu estabelecimento pela sua maquininha.
              </p>
            </div>

            <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FF6B35]/15 text-[#FF6B35]">
                <QrCode className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-sans text-xl font-bold text-[var(--text-primary)]">
                Check-in antifraude
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                Validação simples por QR Code temporário ou PIN de 4 dígitos no balcão. Sem cupons impressos nem códigos reaproveitáveis.
              </p>
            </div>

            <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0077B6]/15 text-[#0077B6]">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-sans text-xl font-bold text-[var(--text-primary)]">
                Fidelidade sem comissão
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                Clientes acumulam Rio Points na rede BoraRio e trocam por benefícios na sua casa com comissão zero sobre os resgates.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final de Alto Impacto */}
      <section className="bg-gradient-to-r from-[#0E2235] via-[#123B56] to-[#0A1828] py-16 text-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-8 px-4 text-center sm:px-6 md:flex-row md:text-left lg:px-8">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1 text-xs font-bold text-[#FFB347]">
              <BadgeCheck className="h-4 w-4" />
              Acesso Imediato
            </span>
            <h2 className="mt-3 font-sans text-3xl font-extrabold tracking-tight sm:text-4xl">
              Comece a receber reservas do BoraRio
            </h2>
            <p className="mt-2 text-base text-[#F1E8D8]/80">
              Acesse o painel para gerenciar suas modalidades ou cadastrar sua casa.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('/parceiros/painel')}
            className="inline-flex shrink-0 items-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-8 py-4 text-base font-bold text-white shadow-xl shadow-[#FF4B2B]/30 transition hover:scale-105"
          >
            <span>Entrar no Painel B2B</span>
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </section>
    </div>
  );
}
