import {
  ArrowRight,
  Compass,
  Crown,
  Heart,
  MapPin,
  Sparkles,
} from 'lucide-react';
import type { Restaurant } from '../types/restaurant';
import { SmartImage } from './SmartImage';

interface DiscoverEditorialSectionsProps {
  experiences: Restaurant[];
  locationConsent: boolean;
  onSelectExperience: (item: Restaurant) => void;
  onGoToExploreMap: () => void;
  onGoToClub: () => void;
  onGoToPlanner: () => void;
}

export function DiscoverEditorialSections({
  experiences,
  locationConsent,
  onSelectExperience,
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
          <h2 className="font-sans text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl">
            O Rio que vale a saída
          </h2>
          <button
            type="button"
            onClick={() => onSelectExperience(spotlight)}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#FF6B35] hover:underline"
          >
            Ver mais <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div
          onClick={() => onSelectExperience(spotlight)}
          className="group relative cursor-pointer overflow-hidden rounded-3xl border border-[var(--border-hairline)] bg-[#0E2235] shadow-md"
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
            <div className="absolute inset-0 bg-gradient-to-t from-[#07111C] via-[#07111C]/45 to-transparent" />
          </div>

          <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-3 py-1 text-[11px] font-bold text-white shadow-sm">
                <Compass className="h-3.5 w-3.5" />
                Experiência em destaque
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#397B68]/90 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-md">
                <Heart className="h-3 w-3 fill-current" />
                98% Match
              </span>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-end sm:p-6">
            <div>
              <h3 className="font-sans text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                {spotlight.name}
              </h3>
              <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-[#F1E8D8]">
                <MapPin className="h-3.5 w-3.5 text-[#FF6B35]" />
                {spotlight.neighborhood} · {spotlight.category}
              </p>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectExperience(spotlight);
              }}
              className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-5 py-2.5 text-xs font-bold text-white shadow-lg transition hover:opacity-95 sm:self-auto"
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
            <h2 className="font-sans text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl">
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
            className="inline-flex items-center gap-1 text-xs font-bold text-[#FF6B35] hover:underline"
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
              className="group relative overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-left shadow-xs transition hover:border-[#FF6B35]/60"
            >
              <div className="relative h-32 w-full overflow-hidden">
                <SmartImage
                  src={item.cover_image}
                  alt={item.name}
                  name={item.name}
                  category={item.category}
                  hasRealPhoto={item.has_real_photo}
                  imageOrigin={item.image_origin}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#07111C]/90 via-transparent to-transparent" />
                <div className="absolute bottom-2.5 left-2.5 right-2.5">
                  <p className="truncate text-xs font-bold text-white">{item.name}</p>
                  <p className="truncate text-[10px] text-[#F1E8D8]">{item.neighborhood}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Bora Club VIP + Roteiros com IA */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex items-center justify-between gap-4 rounded-3xl bg-borario-night p-5 text-white shadow-md">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#D49B27]/20 text-[#E5B342]">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-sans text-lg font-bold tracking-tight">Bora Club VIP</h3>
              <p className="text-xs text-[#F1E8D8]/85">
                Descontos exclusivos e experiências únicas no Rio.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onGoToClub}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-4 py-2 text-xs font-bold text-white shadow-sm hover:opacity-95"
          >
            Entrar <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-3xl bg-borario-day p-5 text-white shadow-md">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-[#F7931E]">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-sans text-lg font-bold tracking-tight">Planeje seu Dia com IA</h3>
              <p className="text-xs text-[#F1E8D8]/90">
                Monte roteiros com orçamento, modo chuva e votação em grupo.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onGoToPlanner}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-4 py-2 text-xs font-bold text-white shadow-sm hover:opacity-95"
          >
            Roteiros <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
