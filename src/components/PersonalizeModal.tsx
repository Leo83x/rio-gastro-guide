import { Check, Shield, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import type { MacroCategory, UserPreferences } from '../types/experience';
import type { Restaurant } from '../types/restaurant';

interface PersonalizeModalProps {
  preferences: UserPreferences;
  onSave: (next: UserPreferences) => void;
  onClose: () => void;
}

const MACRO_CATEGORIES: MacroCategory[] = [
  'Gastronomia',
  'Eventos & Shows',
  'Cultura & Museus',
  'Atrações Infantis',
  'Turismo & Praias',
  'Vida Noturna',
];

const FAVORITE_NEIGHBORHOODS = [
  'Leblon',
  'Ipanema',
  'Botafogo',
  'Copacabana',
  'Santa Teresa',
  'Jardim Botânico',
  'Urca',
  'Centro',
  'Lapa',
  'Barra da Tijuca',
];

export function calculateMatchScore(item: Restaurant, prefs: UserPreferences): number | null {
  if (!prefs.lgpd_consents.personalization) return null;

  let score = 62;
  const macro = item.macro_category || 'Gastronomia';
  if (prefs.favorite_macro_categories.includes(macro)) score += 16;
  if (prefs.favorite_neighborhoods.includes(item.neighborhood)) score += 14;
  if (item.price_range === prefs.budget_tier) score += 5;
  if (item.is_featured) score += 2;
  return Math.min(99, score);
}

export function PersonalizeModal({ preferences, onSave, onClose }: PersonalizeModalProps) {
  const [draft, setDraft] = useState<UserPreferences>(preferences);

  const toggleMacro = (cat: MacroCategory) => {
    const exists = draft.favorite_macro_categories.includes(cat);
    const next = exists
      ? draft.favorite_macro_categories.filter((c) => c !== cat)
      : [...draft.favorite_macro_categories, cat];
    setDraft({ ...draft, favorite_macro_categories: next });
  };

  const toggleNeighborhood = (nb: string) => {
    const exists = draft.favorite_neighborhoods.includes(nb);
    const next = exists
      ? draft.favorite_neighborhoods.filter((n) => n !== nb)
      : [...draft.favorite_neighborhoods, nb];
    setDraft({ ...draft, favorite_neighborhoods: next });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#E05A47]">
          <Sparkles className="h-4 w-4" />
          Personalização Inteligente
        </div>
        <h3 className="font-sans tracking-tight mt-1 text-2xl font-bold text-[var(--text-primary)]">
          Personalizar meu Perfil no Rio
        </h3>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          O feed será reordenado imediatamente com base nos seus interesses e faixa de orçamento.
        </p>

        <div className="mt-5 space-y-5">
          <div>
            <p className="mb-2 text-xs font-bold text-[var(--text-primary)]">
              Categorias de Experiência Favoritas
            </p>
            <div className="flex flex-wrap gap-2">
              {MACRO_CATEGORIES.map((cat) => {
                const active = draft.favorite_macro_categories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleMacro(cat)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? 'border-[#E05A47] bg-[#E05A47] text-white'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {active && <Check className="h-3 w-3" />}
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold text-[var(--text-primary)]">
              Bairros Preferidos
            </p>
            <div className="flex flex-wrap gap-1.5">
              {FAVORITE_NEIGHBORHOODS.map((nb) => {
                const active = draft.favorite_neighborhoods.includes(nb);
                return (
                  <button
                    key={nb}
                    type="button"
                    onClick={() => toggleNeighborhood(nb)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? 'border-[#1C1917] bg-[#1C1917] text-white dark:border-[#F5F2EB] dark:bg-[#F5F2EB] dark:text-[#0F1115]'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {nb}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold text-[var(--text-primary)]">
              Faixa de Orçamento Ideal
            </p>
            <div className="flex gap-2">
              {(['$', '$$', '$$$', '$$$$'] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setDraft({ ...draft, budget_tier: tier })}
                  className={`flex-1 rounded-xl border py-2 text-xs font-bold transition-colors ${
                    draft.budget_tier === tier
                      ? 'border-[#E05A47] bg-[#E05A47]/15 text-[#E05A47]'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/60 p-3.5">
            <label className="flex cursor-pointer items-start gap-2.5 text-xs">
              <input
                type="checkbox"
                checked={draft.lgpd_consents.personalization}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    lgpd_consents: {
                      ...draft.lgpd_consents,
                      personalization: e.target.checked,
                    },
                  })
                }
                className="mt-0.5 rounded accent-[#E05A47]"
              />
              <span className="text-[var(--text-secondary)]">
                <strong className="inline-flex items-center gap-1 text-[var(--text-primary)]">
                  <Shield className="h-3.5 w-3.5 text-emerald-500" /> Consentimento LGPD:
                </strong>{' '}
                Autorizo o uso local das minhas preferências para calcular o Match % no feed (nenhum dado pessoal infantil é coletado).
              </span>
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--border-hairline)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
            className="rounded-xl bg-[#E05A47] px-5 py-2 text-xs font-semibold text-white hover:bg-[#c84b39]"
          >
            Aplicar Preferências
          </button>
        </div>
      </div>
    </div>
  );
}
