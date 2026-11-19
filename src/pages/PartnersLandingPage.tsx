import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  CheckCircle2,
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

      {/* Modelo Comercial & Condição Especial de Lançamento */}
      <section className="border-t border-[var(--border-hairline)] bg-[var(--bg-canvas)] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-amber-500">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Modelo Comercial Transparente
            </span>
            <h2 className="mt-3 font-sans text-3xl font-extrabold tracking-tight sm:text-4xl text-[var(--text-primary)]">
              Traga mais clientes. Pague apenas pelas visitas realizadas.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base text-[var(--text-secondary)]">
              Cobrança por pessoa com check-in individual autenticado no local. Sem mensalidade obrigatória, sem comissão sobre a conta e sem cobrança por no-show.
            </p>
          </div>

          <div className="mt-14 grid gap-8 lg:grid-cols-2 max-w-5xl mx-auto">
            {/* Card 1: Condição Especial de Lançamento */}
            <div className="relative flex flex-col justify-between rounded-3xl border-2 border-[#FF6B35] bg-[var(--bg-surface)] p-8 shadow-xl">
              <div className="absolute -top-3.5 right-8 rounded-full bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-4 py-1 text-xs font-black text-white shadow-md">
                50% DE DESCONTO
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#FF6B35]">
                  Condição Especial de Lançamento
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-sans text-5xl font-black text-[var(--text-primary)]">R$ 5,00</span>
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">/ pessoa com visita validada</span>
                </div>
                <p className="mt-3 text-xs text-[var(--text-secondary)] leading-relaxed">
                  Condição exclusiva para parceiros fundadores durante o período promocional de lançamento (primeiros 30 dias após adesão).
                </p>

                <div className="mt-6 space-y-2.5 border-t border-[var(--border-hairline)] pt-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                    Exemplos práticos de fechamento:
                  </p>
                  <div className="space-y-1.5 text-xs text-[var(--text-secondary)]">
                    <div className="flex justify-between py-1 border-b border-[var(--border-hairline)]">
                      <span>1 pessoa atendida</span>
                      <strong className="text-[var(--text-primary)]">R$ 5,00</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[var(--border-hairline)]">
                      <span>Casal (2 pessoas validadas)</span>
                      <strong className="text-[var(--text-primary)]">R$ 10,00</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[var(--border-hairline)]">
                      <span>Grupo (4 pessoas validadas)</span>
                      <strong className="text-[var(--text-primary)]">R$ 20,00</strong>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>Mesa de amigos (6 pessoas validadas)</span>
                      <strong className="text-[var(--text-primary)]">R$ 30,00</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-5 border-t border-[var(--border-hairline)]">
                <button
                  type="button"
                  onClick={() => onNavigate('/parceiros/painel')}
                  className="w-full rounded-2xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] py-3.5 text-center text-sm font-bold text-white shadow-lg hover:brightness-105 transition"
                >
                  Garantir Condição de Lançamento
                </button>
              </div>
            </div>

            {/* Card 2: Tarifa Padrão */}
            <div className="flex flex-col justify-between rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Tarifa Regular Pós-Promoção
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-sans text-5xl font-black text-[var(--text-primary)]">R$ 10,00</span>
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">/ pessoa com visita validada</span>
                </div>
                <p className="mt-3 text-xs text-[var(--text-secondary)] leading-relaxed">
                  Tarifa definitiva e transparente após o período promocional. Cobrança alinhada ao resultado real da sua casa.
                </p>

                <div className="mt-6 space-y-2.5 border-t border-[var(--border-hairline)] pt-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                    Exemplos práticos de fechamento:
                  </p>
                  <div className="space-y-1.5 text-xs text-[var(--text-secondary)]">
                    <div className="flex justify-between py-1 border-b border-[var(--border-hairline)]">
                      <span>1 pessoa atendida</span>
                      <strong className="text-[var(--text-primary)]">R$ 10,00</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[var(--border-hairline)]">
                      <span>Casal (2 pessoas validadas)</span>
                      <strong className="text-[var(--text-primary)]">R$ 20,00</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-[var(--border-hairline)]">
                      <span>Grupo (4 pessoas validadas)</span>
                      <strong className="text-[var(--text-primary)]">R$ 40,00</strong>
                    </div>
                    <div className="flex justify-between py-1">
                      <span>Mesa de amigos (6 pessoas validadas)</span>
                      <strong className="text-[var(--text-primary)]">R$ 60,00</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-5 border-t border-[var(--border-hairline)]">
                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Fatura mensal consolidada com pagamento via Pix ou Boleto.</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4 Compromissos Oficiais */}
          <div className="mt-12 rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 sm:p-8 max-w-5xl mx-auto">
            <h4 className="text-center font-sans text-base font-bold text-[var(--text-primary)] mb-6">
              Compromissos do Contrato com o Parceiro
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
              <div className="p-3">
                <span className="text-xl">💳</span>
                <p className="font-bold text-xs mt-1 text-[var(--text-primary)]">Sem Comissão</p>
                <p className="text-[11px] text-[var(--text-secondary)]">100% da conta é paga diretamente no seu caixa.</p>
              </div>
              <div className="p-3">
                <span className="text-xl">🚫</span>
                <p className="font-bold text-xs mt-1 text-[var(--text-primary)]">Sem Taxa em No-Show</p>
                <p className="text-[11px] text-[var(--text-secondary)]">Reserva não comparecida ou cancelada = R$ 0,00.</p>
              </div>
              <div className="p-3">
                <span className="text-xl">👥</span>
                <p className="font-bold text-xs mt-1 text-[var(--text-primary)]">Check-in Individual</p>
                <p className="text-[11px] text-[var(--text-secondary)]">Acompanhantes só contam se validarem pelo app.</p>
              </div>
              <div className="p-3">
                <span className="text-xl">⚖️</span>
                <p className="font-bold text-xs mt-1 text-[var(--text-primary)]">Auditoria e Contestação</p>
                <p className="text-[11px] text-[var(--text-secondary)]">Prazo de até 7 dias para reportar divergências.</p>
              </div>
            </div>
          </div>
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

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-7">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#397B68]/15 text-[#397B68]">
                <Wallet className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-sans text-lg font-bold text-[var(--text-primary)]">
                Pagamento direto no caixa
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                O BoraRio não intermedeia a conta. O cliente consome e paga normalmente no seu estabelecimento pela sua maquininha.
              </p>
            </div>

            <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-7">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FF6B35]/15 text-[#FF6B35]">
                <QrCode className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-sans text-lg font-bold text-[var(--text-primary)]">
                Check-in antifraude no servidor
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                Validação server-side por QR Code dinâmico ou PIN de 4 dígitos no balcão. Sem cupons impressos nem códigos reaproveitáveis.
              </p>
            </div>

            <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-7">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0077B6]/15 text-[#0077B6]">
                <Gift className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-sans text-lg font-bold text-[var(--text-primary)]">
                Convites VIP &amp; Fidelidade 0%
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                Autorize cotas de Convites VIP pós-check-in no painel e atraia resgates de Rio Points com comissão zero para sua casa.
              </p>
            </div>

            <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-7">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-sans text-lg font-bold text-[var(--text-primary)]">
                Integridade &amp; Contestação
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                Proteção contra abuso de reservas, no-shows recorrentes e contestação com preservação de evidências direto no Painel B2B.
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

      {/* Footer */}
      <footer className="border-t border-[var(--border-hairline)] bg-[var(--bg-surface)] py-6 text-xs text-[var(--text-secondary)]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div>© 2026 BoraRio Partners · Plataforma B2B de Experiências Cariocas</div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => onNavigate('/pitch')}
              className="text-emerald-500 font-semibold hover:text-emerald-400"
            >
              Deck de Investidores Familiares
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="hover:text-[var(--text-primary)]"
            >
              Página Principal
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => onNavigate('/app')}
              className="hover:text-[var(--text-primary)]"
            >
              Superapp
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
