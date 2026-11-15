import {
  ArrowRight,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Gift,
  Moon,
  QrCode,
  ShieldCheck,
  Store,
  Sun,
  Users,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import type { AppRoute } from '../services/router';

interface PartnersLandingPageProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onNavigate: (route: AppRoute) => void;
}

const MODALITIES = [
  {
    icon: CalendarCheck,
    title: 'A. Reserva Tradicional',
    badge: 'Sem desconto obrigatório',
    text: 'Disponibilize horários, capacidade e turnos do seu salão para reservas individuais ou de grupos com autonomia total do cardápio.',
  },
  {
    icon: Gift,
    title: 'B. Oferta Individual',
    badge: 'Uso imediato',
    text: 'Crie um benefício, cortesia, menu especial ou preço fechado utilizável por 1 cliente ou mesa sem depender de outros participantes.',
  },
  {
    icon: Users,
    title: 'C. Reserva Inteligente por Demanda',
    badge: 'Demanda agregada',
    text: 'Agregue manifestações de interesse individuais em uma mesma janela de data e horário. Participantes não dividem mesa e você só confirma após atingir a meta.',
  },
  {
    icon: Clock3,
    title: 'D. Oportunidade de Última Hora',
    badge: 'Baixa ocupação e vagas extras',
    text: 'Divulgue mesas remanescentes, cancelamentos recentes ou horários ociosos com limite de vagas, prazo e condição definidos por você.',
  },
];

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
              Plataforma para Estabelecimentos
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Alternar tema"
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

      {/* Hero B2B Oficial */}
      <section className="bg-borario-day py-16 text-white sm:py-20">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3.5 py-1 text-xs font-semibold text-[#F1E8D8]">
            <Building2 className="h-3.5 w-3.5 text-[#FF765E]" />
            BoraRio — Plataforma inteligente de reservas, experiências e geração de demanda
          </span>
          <h1 className="font-sans tracking-tight mt-4 text-4xl font-bold leading-tight sm:text-5xl">
            Mais reservas. Mais previsibilidade. Mais clientes.
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-sm leading-relaxed text-[#F1E8D8]/95 sm:text-base">
            <strong>Você define as condições comerciais e escolhe como quer participar.</strong> Não é obrigatório oferecer descontos nem aderir a campanhas promocionais para estar no BoraRio.
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
              Explorar Experiência do Cliente
            </button>
          </div>
        </div>
      </section>

      {/* Autonomia Comercial & 4 Modalidades Independentes */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <span className="text-xs font-bold uppercase tracking-widest text-[#397B68]">
            4 Modalidades Independentes
          </span>
          <h2 className="font-sans tracking-tight mt-2 text-3xl font-bold">
            Autonomia total de preço, capacidade, datas e regras
          </h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Utilize apenas reservas tradicionais e presença verificada, ou combine ofertas individuais, oportunidades de última hora e reserva inteligente por demanda conforme a estratégia da sua casa.
          </p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {MODALITIES.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 shadow-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <Icon className="h-6 w-6 text-[#FF6B35]" />
                  <span className="rounded-full bg-[var(--bg-canvas)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--text-secondary)]">
                    {item.badge}
                  </span>
                </div>
                <h3 className="font-sans tracking-tight mt-4 text-base font-bold text-[var(--text-primary)]">
                  {item.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                  {item.text}
                </p>
              </div>
            );
          })}
        </div>

        {/* Garantias Operacionais & Remuneracao Auditavel */}
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
            <Store className="h-6 w-6 text-[#397B68]" />
            <h3 className="font-sans mt-3 text-lg font-bold">Receba 100% direto no seu caixa</h3>
            <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
              O BoraRio não processa pagamentos dos clientes no aplicativo e não retém seu faturamento. O acerto do consumo acontece diretamente no estabelecimento pelos seus próprios meios de pagamento.
            </p>
          </div>

          <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
            <QrCode className="h-6 w-6 text-[#FF6B35]" />
            <h3 className="font-sans mt-3 text-lg font-bold">Check-in dinâmico antifraude</h3>
            <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
              Tokens QR temporários e PIN operacional de balcão vinculados à reserva impedem uso duplicado, expiração ou autovalidação. Também conta com conciliação para casos offline ou sem câmera.
            </p>
          </div>

          <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
            <ShieldCheck className="h-6 w-6 text-[#123B56] dark:text-[#F7931E]" />
            <h3 className="font-sans mt-3 text-lg font-bold">Remuneração fixa configurável</h3>
            <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
              Taxa fixa configurável por plano/contrato vinculada apenas a reservas e check-ins válidos de clientes atendidos. <strong>0% sobre o valor da conta consumida</strong> e zero cobrança por cliques, visualizações ou cancelamentos.
            </p>
          </div>
        </div>

        <div className="mt-10 rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8">
          <h2 className="font-sans tracking-tight text-2xl font-bold">Compromissos de transparência com o parceiro</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {[
              {
                title: 'Sem desconto obrigatório',
                text: 'Você nunca precisa reduzir preços para entrar na plataforma ou receber reservas tradicionais.',
              },
              {
                title: 'Controle para ativar e pausar',
                text: 'Ative, pause ou crie novas condições a qualquer momento, respeitando apenas reservas já confirmadas com clientes.',
              },
              {
                title: 'Auditoria e contestação clara',
                text: 'Cada check-in e apuração de taxa fixa exibe origem, horário, hóspedes e botão para contestação direta no painel.',
              },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#397B68]" />
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">{item.title}</h3>
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
