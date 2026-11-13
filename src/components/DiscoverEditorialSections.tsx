import {
  ArrowRight,
  Compass,
  Crown,
  Landmark,
  MapPin,
  Music,
  Palmtree,
  Sparkles,
  Umbrella,
  UtensilsCrossed,
} from 'lucide-react';
import type { MacroCategory } from '../types/experience';
import type { Restaurant } from '../types/restaurant';
import { SmartImage } from './SmartImage';

interface DiscoverEditorialSectionsProps {
  experiences: Restaurant[];
  locationConsent: boolean;
  onSelectExperience: (item: Restaurant) => void;
  onSelectMacroCategory: (cat: MacroCategory) => void;
  onGoToExploreMap: () => void;
  onGoToClub: () => void;
  onGoToPlanner: () => void;
}

const CATEGORY_CIRCLES: Array<{
  label: string;
  value: MacroCategory;
  icon: typeof UtensilsCrossed;
  bg: string;
}> = [
  { label: 'Gastronomia', value: 'Gastronomia', icon: UtensilsCrossed, bg: 'from-[#FF765E] to-[#E05A47]' },
  { label: 'Eventos', value: 'Eventos & Shows', icon: Music, bg: 'from-[#7B4CE2] to-[#562BB8]' },
  { label: 'Cultura', value: 'Cultura & Museus', icon: Landmark, bg: 'from-[#123B56] to-[#1D557A]' },
  { label: 'Praias', value: 'Turismo & Praias', icon: Umbrella, bg: 'from-[#D49B27] to-[#B78114]' },
  { label: 'Infantil', value: 'Atrações Infantis', icon: Palmtree, bg: 'from-[#397B68] to-[#275C4D]' },
];

export function DiscoverEditorialSections({
  experiences,
  locationConsent,
  onSelectExperience,
  onSelectMacroCategory,
  onGoToExploreMap,
  onGoToClub,
  onGoToPlanner,
}: DiscoverEditorialSectionsProps) {
  if (experiences.length === 0) return null;

  const spotlight = experiences.find((e) => e.is_featured) || experiences[0];
  const nearby = experiences.filter((e) => e.id !== spotlight.id).slice(0, 4);

  return (
    <div className="mb-10 space-y-8">
      {/* 1. O Rio que vale a saída */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-editorial text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
            O Rio que vale a saída
          </h2>
          <button
            type="button"
            onClick={() => onSelectExperience(spotlight)}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#FF765E] hover:underline"
          >
            Ver destaque <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div
          onClick={() => onSelectExperience(spotlight)}
          className="group relative cursor-pointer overflow-hidden rounded-3xl border border-[var(--border-hairline)] bg-[#102F46] shadow-md"
        >
          <div className="relative h-64 w-full sm:h-72">
            <SmartImage
              src={spotlight.cover_image}
              alt={spotlight.name}
              name={spotlight.name}
              category={spotlight.category}
              hasRealPhoto={spotlight.has_real_photo}
              imageOrigin={spotlight.image_origin}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A1824] via-[#0A1824]/45 to-transparent" />
          </div>

          <div className="absolute inset-x-0 bottom-0 flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-end sm:p-6">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#397B68] px-3 py-1 text-[11px] font-bold text-white shadow-sm">
                <Compass className="h-3.5 w-3.5" />
                Experiência em destaque
              </span>
              <h3 className="font-editorial mt-2 text-2xl font-bold text-white sm:text-3xl">
                {spotlight.name}
              </h3>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-[#F1E8D8]">
                <MapPin className="h-3.5 w-3.5 text-[#FF765E]" />
                {spotlight.neighborhood} · {spotlight.category}
              </p>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectExperience(spotlight);
              }}
              className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-[#FF765E] px-5 py-2.5 text-xs font-bold text-white shadow-lg transition hover:bg-[#e8634c] sm:self-auto"
            >
              Reservar <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Perto de você */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-editorial text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
              Perto de você
            </h2>
            <p className="text-[11px] text-[var(--text-secondary)]">
              {locationConsent
                ? 'Ordenado com permissão de localização ativa'
                : 'Destaques curados no Rio (ative a localização em Perfil para distância exata)'}
            </p>
          </div>
          <button
            type="button"
            onClick={onGoToExploreMap}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#FF765E] hover:underline"
          >
            Ver no mapa <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {nearby.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectExperience(item)}
              className="group relative overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-left shadow-xs transition hover:border-[#FF765E]/60"
            >
              <div className="relative h-28 w-full overflow-hidden">
                <SmartImage
                  src={item.cover_image}
                  alt={item.name}
                  name={item.name}
                  category={item.category}
                  hasRealPhoto={item.has_real_photo}
                  imageOrigin={item.image_origin}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A1824]/90 via-transparent to-transparent" />
                <div className="absolute bottom-2 left-2.5 right-2.5">
                  <p className="truncate text-xs font-bold text-white">{item.name}</p>
                  <p className="truncate text-[10px] text-[#F1E8D8]">{item.neighborhood}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Descubra por categoria */}
      <div>
        <h2 className="font-editorial mb-3 text-xl font-bold text-[var(--text-primary)]">
          Descubra por categoria
        </h2>
        <div className="flex items-center gap-4 overflow-x-auto pb-2 no-scrollbar sm:gap-6">
          {CATEGORY_CIRCLES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => onSelectMacroCategory(cat.value)}
                className="group flex shrink-0 flex-col items-center gap-2"
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${cat.bg} text-white shadow-md transition-transform group-hover:scale-105`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Rio Gastro Club + Planeje com IA */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex items-center justify-between gap-4 rounded-3xl bg-borario-night p-5 text-white shadow-md">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#D49B27]/20 text-[#E5B342]">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-editorial text-lg font-bold">Rio Gastro Club</h3>
              <p className="text-xs text-[#F1E8D8]/85">
                Benefícios exclusivos e drops curados em estabelecimentos do Rio.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onGoToClub}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#D49B27] px-4 py-2 text-xs font-bold text-[#102F46] hover:bg-[#e5b342]"
          >
            Entrar <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-3xl bg-borario-day p-5 text-white shadow-md">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-[#FF765E]">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-editorial text-lg font-bold">Planeje seu Dia com IA</h3>
              <p className="text-xs text-[#F1E8D8]/90">
                Monte seu roteiro com orçamento, modo chuva e votação em grupo.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onGoToPlanner}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FF765E] px-4 py-2 text-xs font-bold text-white hover:bg-[#e8634c]"
          >
            Planejar <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
