import {
  Calculator,
  Check,
  CloudRain,
  Copy,
  MapPin,
  Sparkles,
  Sun,
  ThumbsDown,
  ThumbsUp,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchRioWeatherLive, type RioWeatherSnapshot } from '../services/integrations/registry';
import { getGroupVoteSession, saveGroupVoteSession } from '../services/superappStore';
import type { GroupVoteSession } from '../types/experience';
import type { Restaurant } from '../types/restaurant';
import { MultiPinMap } from './MultiPinMap';

interface PlannerViewProps {
  experiences: Restaurant[];
  onSelectExperience: (item: Restaurant) => void;
}

interface ItineraryStep {
  time: string;
  label: string;
  item: Restaurant;
  estimatedCostBrl: number;
}

export function PlannerView({ experiences, onSelectExperience }: PlannerViewProps) {
  const [prompt, setPrompt] = useState(
    'Sábado com esposa e 2 crianças, orçamento R$ 500, Zona Sul / Centro'
  );
  const [rainMode, setRainMode] = useState(false);
  const [weather, setWeather] = useState<RioWeatherSnapshot | null>(null);
  const [itinerary, setItinerary] = useState<ItineraryStep[]>([]);

  // Group Voting
  const [voteTitle, setVoteTitle] = useState('Sexta-feira da Galera no Rio');
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    experiences.slice(0, 4).map((e) => e.id)
  );
  const [voteSession, setVoteSession] = useState<GroupVoteSession | null>(() =>
    getGroupVoteSession()
  );
  const [copiedLink, setCopiedLink] = useState(false);

  // Split Bill Calculator
  const [billTotal, setBillTotal] = useState<number>(380);
  const [tipPercent, setTipPercent] = useState<number>(10);
  const [peopleCount, setPeopleCount] = useState<number>(4);

  useEffect(() => {
    void fetchRioWeatherLive().then((w) => {
      setWeather(w);
      if (w.isRaining) setRainMode(true);
    });
  }, []);

  const buildItinerary = (forceRain: boolean) => {
    const lower = prompt.toLowerCase();
    const isFamily = lower.includes('crianç') || lower.includes('famíl') || lower.includes('filh');
    const isBudget = lower.includes('barat') || lower.includes('gratuit') || lower.includes('econôm');

    const pool = experiences.filter((e) => {
      if (forceRain && e.attributes?.is_covered === false) return false;
      if (isBudget && (e.price_range === '$$$' || e.price_range === '$$$$')) return false;
      return true;
    });

    const pick = (predicate: (e: Restaurant) => boolean, fallbackIdx: number): Restaurant | undefined =>
      pool.find(predicate) || experiences[fallbackIdx % experiences.length];

    const morning = pick(
      (e) =>
        (e.macro_category === 'Cultura & Museus' || e.macro_category === 'Turismo & Praias') &&
        (!forceRain || e.attributes?.is_covered !== false),
      0
    );
    const lunch = pick(
      (e) =>
        (e.macro_category || 'Gastronomia') === 'Gastronomia' &&
        (!isFamily || e.attributes?.is_kid_friendly !== false),
      1
    );
    const afternoon = pick(
      (e) =>
        e.id !== morning?.id &&
        e.id !== lunch?.id &&
        (isFamily
          ? e.macro_category === 'Atrações Infantis' || e.attributes?.is_kid_friendly === true
          : e.macro_category === 'Turismo & Praias' || e.macro_category === 'Cultura & Museus'),
      2
    );
    const sunset = pick(
      (e) =>
        e.id !== morning?.id &&
        e.id !== lunch?.id &&
        e.id !== afternoon?.id &&
        ((e.macro_category || 'Gastronomia') === 'Gastronomia' ||
          e.macro_category === 'Vida Noturna'),
      5
    );

    const rawSteps = [
      { time: '10:00', label: 'Manhã Cultural / Passeio', item: morning },
      { time: '12:30', label: 'Almoço Próximo', item: lunch },
      { time: '15:30', label: isFamily ? 'Lazer Infantil / Família' : 'Exploração da Tarde', item: afternoon },
      { time: '17:30', label: 'Pôr do Sol / Happy Hour', item: sunset },
    ].filter((s): s is { time: string; label: string; item: Restaurant } => Boolean(s.item));

    setItinerary(
      rawSteps.map((s) => ({
        ...s,
        estimatedCostBrl: s.item.attributes?.avg_ticket_brl ?? 100,
      }))
    );
  };

  useEffect(() => {
    if (experiences.length > 0 && itinerary.length === 0) {
      buildItinerary(rainMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experiences.length]);

  const totalCost = itinerary.reduce((sum, s) => sum + s.estimatedCostBrl, 0);

  const createVote = () => {
    if (selectedIds.length < 2) return;
    const session: GroupVoteSession = {
      id: `vote-${Date.now()}`,
      title: voteTitle.trim() || 'Onde Vamos?',
      options: selectedIds.map((id) => ({ experience_id: id, likes: 0, dislikes: 0 })),
      created_at: new Date().toISOString(),
    };
    saveGroupVoteSession(session);
    setVoteSession(session);
  };

  const castVote = (expId: string, kind: 'like' | 'dislike') => {
    if (!voteSession) return;
    const next: GroupVoteSession = {
      ...voteSession,
      options: voteSession.options.map((o) =>
        o.experience_id === expId
          ? {
              ...o,
              likes: kind === 'like' ? o.likes + 1 : o.likes,
              dislikes: kind === 'dislike' ? o.dislikes + 1 : o.dislikes,
            }
          : o
      ),
    };
    saveGroupVoteSession(next);
    setVoteSession(next);
  };

  const totalWithTip = billTotal * (1 + tipPercent / 100);
  const perPerson = peopleCount > 0 ? totalWithTip / peopleCount : totalWithTip;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Section 0: Interactive Rio Map */}
      <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 shadow-xs">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#397B68]">
              <MapPin className="h-3.5 w-3.5" />
              Mapa Interativo do Rio
            </p>
            <h2 className="font-editorial mt-1 text-2xl font-bold text-[var(--text-primary)]">
              Explore experiências geolocalizadas
            </h2>
          </div>
          <span className="text-xs text-[var(--text-secondary)]">
            OpenStreetMap &amp; Leaflet · Clique em um pino para abrir detalhes
          </span>
        </div>
        <MultiPinMap experiences={experiences} onSelectExperience={onSelectExperience} />
      </section>

      {/* Section 1: AI Day Itinerary Generator */}
      <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 shadow-xs">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#E05A47]">
              <Sparkles className="h-3.5 w-3.5" />
              Roteiro Inteligente do Dia
            </p>
            <h2 className="font-editorial mt-1 text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
              Planeje seu dia perfeito no Rio
            </h2>
          </div>

          {weather && (
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3.5 py-1.5 text-xs">
              {weather.isRaining ? (
                <CloudRain className="h-4 w-4 text-sky-500" />
              ) : (
                <Sun className="h-4 w-4 text-amber-500" />
              )}
              <span className="font-semibold text-[var(--text-primary)]">
                {weather.temperatureC}°C · {weather.weatherLabel}
              </span>
              <span className="text-[10px] text-[var(--text-secondary)]">
                ({weather.source === 'open-meteo-live' ? 'Open-Meteo ao vivo' : 'Offline'})
              </span>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ex: Sábado com esposa e 2 crianças, orçamento R$ 500, Zona Sul/Centro"
            className="flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3 text-sm text-[var(--text-primary)] focus:border-[#E05A47] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => buildItinerary(rainMode)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E05A47] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#c84b39]"
          >
            <Sparkles className="h-4 w-4" />
            Gerar Roteiro
          </button>
          <button
            type="button"
            onClick={() => {
              const nextRain = !rainMode;
              setRainMode(nextRain);
              buildItinerary(nextRain);
            }}
            className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-semibold transition-colors ${
              rainMode
                ? 'border-sky-500 bg-sky-500/15 text-sky-600 dark:text-sky-300'
                : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <CloudRain className="h-4 w-4" />
            {rainMode ? 'Modo Chuva Ativo (Cobertos)' : 'Recalcular se Chover'}
          </button>
        </div>

        {/* Timeline */}
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {itinerary.map((step) => (
            <div
              key={`${step.time}-${step.item.id}`}
              onClick={() => onSelectExperience(step.item)}
              className="group cursor-pointer rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4 transition-all hover:border-[#E05A47]/50 hover:shadow-md"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="rounded-lg bg-[#E05A47]/15 px-2 py-0.5 font-bold text-[#E05A47]">
                  {step.time}
                </span>
                <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                  {step.estimatedCostBrl === 0
                    ? 'Gratuito'
                    : `~R$ ${step.estimatedCostBrl}`}
                </span>
              </div>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                {step.label}
              </p>
              <h3 className="font-editorial mt-1 text-lg font-bold text-[var(--text-primary)] group-hover:text-[#E05A47]">
                {step.item.name}
              </h3>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {step.item.neighborhood} · {step.item.macro_category || step.item.category}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-hairline)] pt-4 text-xs text-[var(--text-secondary)]">
          <span>
            Custo total estimado por pessoa:{' '}
            <strong className="text-sm text-[var(--text-primary)]">
              R$ {totalCost.toLocaleString('pt-BR')}
            </strong>{' '}
            <span className="ml-1 rounded bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px]">
              Estimativa calculada pela plataforma
            </span>
          </span>
          <span>Baseado exclusivamente nas experiências cadastradas no guia.</span>
        </div>
      </section>

      {/* Section 2: Group Decision ("Onde Vamos?") + Split Bill */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 lg:col-span-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#E05A47]">
            <Users className="h-4 w-4" />
            Decisão em Grupo · Onde Vamos?
          </div>
          <h3 className="font-editorial mt-1 text-2xl font-bold text-[var(--text-primary)]">
            Votação Rápida com Amigos
          </h3>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={voteTitle}
              onChange={(e) => setVoteTitle(e.target.value)}
              className="flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2 text-sm text-[var(--text-primary)]"
            />
            <button
              type="button"
              onClick={createVote}
              className="rounded-xl bg-[#1C1917] px-4 py-2 text-xs font-semibold text-white hover:bg-[#E05A47] dark:bg-[#F5F2EB] dark:text-[#0F1115] dark:hover:bg-[#E05A47] dark:hover:text-white"
            >
              Gerar Enquete ({selectedIds.length} opções)
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {experiences.slice(0, 10).map((exp) => {
              const active = selectedIds.includes(exp.id);
              return (
                <button
                  key={exp.id}
                  type="button"
                  onClick={() =>
                    setSelectedIds((prev) =>
                      active
                        ? prev.filter((id) => id !== exp.id)
                        : prev.length < 5
                          ? [...prev, exp.id]
                          : prev
                    )
                  }
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    active
                      ? 'border-[#E05A47] bg-[#E05A47]/15 text-[#E05A47]'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]'
                  }`}
                >
                  {exp.name}
                </button>
              );
            })}
          </div>

          {voteSession && (
            <div className="mt-5 space-y-2.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
              <div className="flex items-center justify-between gap-2">
                <strong className="text-sm text-[var(--text-primary)]">{voteSession.title}</strong>
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/?vote=${voteSession.id}`;
                    void navigator.clipboard?.writeText(url);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2500);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-primary)] hover:border-[#E05A47]"
                >
                  {copiedLink ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  {copiedLink ? 'Link copiado!' : 'Copiar link para grupo'}
                </button>
              </div>

              {voteSession.options.map((opt) => {
                const exp = experiences.find((e) => e.id === opt.experience_id);
                if (!exp) return null;
                return (
                  <div
                    key={opt.experience_id}
                    className="flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2.5"
                  >
                    <div>
                      <p className="text-xs font-bold text-[var(--text-primary)]">{exp.name}</p>
                      <p className="text-[11px] text-[var(--text-secondary)]">{exp.neighborhood}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => castVote(exp.id, 'like')}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                        {opt.likes}
                      </button>
                      <button
                        type="button"
                        onClick={() => castVote(exp.id, 'dislike')}
                        className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-500/20 dark:text-red-300"
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                        {opt.dislikes}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Split Bill Calculator */}
        <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#E05A47]">
            <Calculator className="h-4 w-4" />
            Dividir Conta
          </div>
          <h3 className="font-editorial mt-1 text-2xl font-bold text-[var(--text-primary)]">
            Calculadora do Rolê
          </h3>

          <div className="mt-4 space-y-3 text-xs">
            <div>
              <label className="mb-1 block font-semibold text-[var(--text-secondary)]">
                Total da Conta (R$)
              </label>
              <input
                type="number"
                min={0}
                value={billTotal}
                onChange={(e) => setBillTotal(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-semibold text-[var(--text-secondary)]">
                  Serviço (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={tipPercent}
                  onChange={(e) => setTipPercent(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)]"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-[var(--text-secondary)]">
                  Pessoas
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={peopleCount}
                  onChange={(e) => setPeopleCount(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)]"
                />
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[#E05A47]/25 bg-[#E05A47]/10 p-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Valor por pessoa
              </p>
              <p className="font-editorial mt-1 text-3xl font-bold text-[#E05A47]">
                R$ {perPerson.toFixed(2).replace('.', ',')}
              </p>
              <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                Total com {tipPercent}%: R$ {totalWithTip.toFixed(2).replace('.', ',')}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
