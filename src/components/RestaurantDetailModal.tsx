import {
  BadgeCheck,
  Bookmark,
  Camera,
  Check,
  ChevronDown,
  Clock,
  Copy,
  ExternalLink,
  Flame,
  Gift,
  Globe,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Share2,
  ShieldCheck,
  Star,
  Thermometer,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatOfferingSchedule, getPartnerOfferings } from '../services/opportunityStore';
import { getMyReferralCode, getMyReferralLink } from '../services/referralStore';
import type { ReservationRequest } from '../types/experience';
import type { PartnerOffering } from '../types/marketplace';
import type { Restaurant } from '../types/restaurant';
import { buildGoogleMapsUrl, buildUberUrl, launchNineNineRide } from '../utils/mobility';
import { BenefitActivationModal } from './BenefitActivationModal';
import { ClaimModal } from './ClaimModal';
import { LeafletMap } from './LeafletMap';
import { SmartImage } from './SmartImage';

interface RestaurantDetailModalProps {
  restaurant: Restaurant;
  inVault?: boolean;
  locationConsent?: boolean;
  onSaveToVault?: (restaurant: Restaurant) => void;
  onShareToConfia?: (restaurant: Restaurant) => void;
  onClose: () => void;
  onRestaurantClaimed: (restaurantId: string) => void;
  onReservationCreated?: (req: ReservationRequest) => void;
  onRequireAuth?: (reason: string, action: () => void) => void;
}

export function RestaurantDetailModal({
  restaurant,
  inVault = false,
  onSaveToVault,
  onShareToConfia,
  onClose,
  onRestaurantClaimed,
  onReservationCreated,
  onRequireAuth,
}: RestaurantDetailModalProps) {
  const validPhotos = Array.from(
    new Set(
      [restaurant.cover_image, ...(restaurant.gallery || [])]
        .map((p) => (typeof p === 'string' ? p.trim() : ''))
        .filter((p) => p.length > 0)
    )
  );
  const photos = validPhotos.length > 0 ? validPhotos : [''];
  const [photoState, setPhotoState] = useState<{ restaurantId: string; idx: number }>({
    restaurantId: restaurant.id,
    idx: 0,
  });
  const activePhotoIdx =
    photoState.restaurantId === restaurant.id
      ? Math.min(photoState.idx, photos.length - 1)
      : 0;
  const setActivePhotoIdx = (idx: number) =>
    setPhotoState({ restaurantId: restaurant.id, idx });

  const [showClaimModal, setShowClaimModal] = useState(false);
  const [selectedOfferingForActivation, setSelectedOfferingForActivation] =
    useState<PartnerOffering | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Accordion state for expandable sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    hours: false,
    vibe: false,
    mobility: false,
    map: false,
  });

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Buscar ofertas ativas para este estabelecimento
  const venueOfferings = useMemo(() => {
    return getPartnerOfferings({ restaurantId: restaurant.id });
  }, [restaurant.id]);

  const rideCoords = {
    latitude: restaurant.latitude,
    longitude: restaurant.longitude,
    name: restaurant.name,
  };
  const uberUrl = buildUberUrl(rideCoords);
  const googleMapsUrl = buildGoogleMapsUrl(restaurant.latitude, restaurant.longitude);

  const handleShareApp = async () => {
    const venueLink = getMyReferralLink(restaurant.id);
    const myCode = getMyReferralCode();
    const shareText = `Olha esse lugar incrível no BoraRio: *${restaurant.name}* (${restaurant.neighborhood})!\nConfira as vantagens exclusivas e venha comigo:\n${venueLink}\n\nCódigo de indicação: *${myCode}*`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${restaurant.name} · BoraRio`,
          text: shareText,
          url: venueLink,
        });
        onShareToConfia?.(restaurant);
        return;
      } catch {
        // Usuário cancelou ou navegador não suporta compartilhamento direto
      }
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer');
    onShareToConfia?.(restaurant);
  };

  const handleCopyLink = () => {
    const venueLink = getMyReferralLink(restaurant.id);
    navigator.clipboard.writeText(venueLink).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const whatsappUrl = restaurant.whatsapp
    ? `https://wa.me/${restaurant.whatsapp.replace(/\D/g, '')}`
    : null;

  const instagramUrl = restaurant.instagram
    ? `https://instagram.com/${restaurant.instagram.replace(/^@/, '')}`
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/80 p-0 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative my-auto max-h-[96vh] w-full max-w-4xl overflow-y-auto rounded-none border border-[var(--border-hairline)] bg-[var(--bg-surface)] shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Top Controls (Desaglomerado: Apenas Favorito e Fechar) */}
        <div className="absolute right-4 top-4 z-30 flex items-center gap-2">
          {onSaveToVault && (
            <button
              type="button"
              onClick={() => onSaveToVault(restaurant)}
              aria-label={inVault ? 'Remover dos Desejos' : 'Salvar em Desejos'}
              className={`flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md transition-all shadow-md ${
                inVault
                  ? 'bg-[#FF6B35] text-white'
                  : 'bg-black/60 text-white hover:bg-black/80 hover:text-[#FF6B35]'
              }`}
            >
              <Bookmark className={`h-4 w-4 ${inVault ? 'fill-current' : ''}`} />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhes"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-all shadow-md hover:bg-[#E05A47]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 1. TOPO: FOTO, NOME, CATEGORIA E LOCALIZAÇÃO */}
        <div className="relative aspect-[16/9] max-h-[360px] w-full overflow-hidden bg-[var(--bg-subtle)]">
          <SmartImage
            src={photos[activePhotoIdx] ?? photos[0] ?? restaurant.cover_image}
            alt={restaurant.name}
            name={restaurant.name}
            category={restaurant.category}
            imageOrigin={restaurant.image_origin}
            hasRealPhoto={restaurant.has_real_photo}
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

          <div className="absolute bottom-5 left-5 right-5 flex flex-col gap-1.5 sm:bottom-6 sm:left-8 sm:right-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#E05A47] px-3 py-1 text-xs font-semibold text-white">
                {restaurant.category}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
                <MapPin className="h-3.5 w-3.5 text-[#E05A47]" />
                {restaurant.neighborhood}
              </span>
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[#1C1917]">
                {restaurant.price_range}
              </span>
              {restaurant.is_claimed && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-semibold text-white">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Perfil Verificado
                </span>
              )}
            </div>

            <h2 className="font-sans text-2xl font-black text-white sm:text-4xl tracking-tight drop-shadow-md">
              {restaurant.name}
            </h2>
          </div>
        </div>

        {/* Thumbnails */}
        {photos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto border-b border-[var(--border-hairline)] bg-[var(--bg-subtle)]/50 px-5 py-3 sm:px-8">
            {photos.map((photo, idx) => (
              <button
                key={`${photo}-${idx}`}
                type="button"
                onClick={() => setActivePhotoIdx(idx)}
                className={`h-14 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition ${
                  activePhotoIdx === idx
                    ? 'border-[#FF6B35] shadow-md'
                    : 'border-transparent opacity-65 hover:opacity-100'
                }`}
              >
                <img src={photo} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Body Content */}
        <div className="p-5 sm:p-8 space-y-6">
          {/* 2. DESTAQUE PRINCIPAL: OFERTAS E JANELAS DISPONÍVEIS */}
          {venueOfferings.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#FF6B35]">
                  <Flame className="h-4 w-4 text-[#FF6B35]" />
                  Ofertas &amp; Benefícios Ativos Hoje
                </span>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  {venueOfferings.length} {venueOfferings.length === 1 ? 'disponível' : 'disponíveis'}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {venueOfferings.map((off) => {
                  const scheduleText = formatOfferingSchedule(off.service_date, off.time_slot_label);
                  return (
                    <div
                      key={off.id}
                      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-stone-900 to-stone-850 p-5 text-white shadow-xl transition hover:border-amber-400/60 hover:-translate-y-0.5"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                            <Gift className="h-3 w-3" />
                            {off.condition_badge || 'Oportunidade VIP'}
                          </span>
                          <span className="text-[11px] font-semibold text-stone-300">
                            {scheduleText}
                          </span>
                        </div>

                        <h4 className="mt-3 text-base font-bold text-white leading-snug">
                          {off.benefit_summary || off.title}
                        </h4>

                        <p className="mt-1 text-xs text-stone-400 line-clamp-2">
                          {off.description}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                        <span className="text-[11px] font-bold text-emerald-400">
                          +250 Rio Points no check-in
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedOfferingForActivation(off)}
                          className="rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-4 py-2 text-xs font-bold text-white shadow-md transition hover:scale-105 active:scale-95"
                        >
                          Quero aproveitar 🎟️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. AÇÃO CONTEXTUAL: RESERVAR MESA TRADICIONAL (SE NÃO ESCOLHEU OFERTA) */}
          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <UtensilsCrossed className="h-4 w-4 text-[#FF6B35]" />
                Prefere apenas reservar uma mesa sem oferta?
              </p>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                Solicitação direta confirmada pelo restaurante. Pagamento 100% no local.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                const defaultOff: PartnerOffering = venueOfferings[0] || {
                  id: `trad-${restaurant.id}`,
                  restaurant_id: restaurant.id,
                  restaurant_name: restaurant.name,
                  neighborhood: restaurant.neighborhood,
                  category: restaurant.category,
                  modality: 'TRADITIONAL_BOOKING',
                  status: 'PUBLISHED',
                  title: `Reserva de Mesa em ${restaurant.name}`,
                  benefit_summary: 'Reserva Tradicional de Mesa com Prioridade',
                  rules_summary: 'Mesa confirmada pela casa. Pagamento 100% no local.',
                  service_date: new Date().toISOString().slice(0, 10),
                  time_slot_label: '20:00',
                  starts_at: new Date().toISOString(),
                  ends_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
                  capacity_total: 10,
                  reserved_count: 2,
                  offer_category: 'Gastronomia',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                };
                setSelectedOfferingForActivation({
                  ...defaultOff,
                  modality: 'TRADITIONAL_BOOKING',
                  title: `Reserva de Mesa em ${restaurant.name}`,
                });
              }}
              className="shrink-0 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-2.5 text-xs font-bold text-[var(--text-primary)] shadow-xs transition hover:border-[#FF6B35] hover:text-[#FF6B35]"
            >
              Solicitar Reserva de Mesa
            </button>
          </div>

          {/* 4. AVALIAÇÕES E INFORMAÇÕES ESSENCIAIS (COMPACTO) */}
          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-3">
              <div className="flex items-center gap-2">
                {restaurant.rating > 0 ? (
                  <>
                    <Star className="h-5 w-5 fill-[#E5B342] text-[#E5B342]" />
                    <span className="text-lg font-bold text-[var(--text-primary)]">
                      {restaurant.rating.toFixed(1)}
                    </span>
                    {restaurant.reviews_count > 0 && (
                      <span className="text-xs text-[var(--text-secondary)]">
                        ({restaurant.reviews_count.toLocaleString('pt-BR')} avaliações)
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-[var(--text-secondary)]">Curadoria BoraRio</span>
                )}
              </div>

              {restaurant.opening_hours && (
                <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                  <Clock className="h-3.5 w-3.5 text-[#E05A47]" />
                  <span>{restaurant.opening_hours}</span>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Nota do Curador
              </p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)] line-clamp-3">
                {restaurant.description}
              </p>
            </div>
          </div>

          {/* AÇÃO DEDICADA: ENVIAR PARA UM AMIGO / COMPARTILHAR LINK DO APP */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-[#397B68]/30 bg-[#397B68]/10 p-4">
            <div className="space-y-0.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#397B68] dark:text-[#4CA188] flex items-center gap-1.5">
                <Share2 className="h-3.5 w-3.5" />
                Enviar para um amigo
              </span>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Compartilhe este lugar pelo link oficial do BoraRio. O envio em si não gera pontos; recompensas seguem as regras ativas após ação válida.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleShareApp}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
              >
                <span>Enviar para um amigo</span>
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-[#FF6B35] transition"
                title="Copiar link direto do app"
              >
                {copiedLink ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">Link Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                    <span>Copiar Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 5. SEÇÕES EXPANSÍVEIS (ACCORDION LIMPO) */}
          <div className="space-y-2 border-t border-[var(--border-hairline)] pt-4">
            {/* Seção A: Horários, Cardápio e Canais */}
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('hours')}
                className="w-full flex items-center justify-between p-4 text-left font-bold text-sm text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]/50 transition"
              >
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#FF6B35]" />
                  Horários, Cardápio &amp; Canais de Contato
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${
                    expandedSections.hours ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {expandedSections.hours && (
                <div className="p-4 pt-0 border-t border-[var(--border-hairline)] space-y-3 text-xs">
                  {restaurant.opening_hours && (
                    <div>
                      <span className="font-semibold text-[var(--text-secondary)]">Funcionamento:</span>
                      <p className="mt-0.5 text-[var(--text-primary)] font-medium">
                        {restaurant.opening_hours}
                      </p>
                    </div>
                  )}

                  <div>
                    <span className="font-semibold text-[var(--text-secondary)]">Canais Oficiais:</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {whatsappUrl && (
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 py-1.5 font-semibold text-emerald-600 hover:border-emerald-500"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      )}
                      {instagramUrl && (
                        <a
                          href={instagramUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 py-1.5 font-semibold text-[var(--text-primary)] hover:border-[#FF6B35]"
                        >
                          <Camera className="h-3.5 w-3.5 text-[#FF6B35]" />
                          <span>@{restaurant.instagram?.replace(/^@/, '')}</span>
                        </a>
                      )}
                      {restaurant.phone && (
                        <a
                          href={`tel:${restaurant.phone}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 py-1.5 font-semibold text-[var(--text-primary)] hover:border-[#FF6B35]"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          <span>{restaurant.phone}</span>
                        </a>
                      )}
                      {restaurant.website && (
                        <a
                          href={restaurant.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3 py-1.5 font-semibold text-[var(--text-primary)] hover:border-[#FF6B35]"
                        >
                          <Globe className="h-3.5 w-3.5" />
                          <span>Site Oficial</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Seção B: Termômetro de Experiência */}
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('vibe')}
                className="w-full flex items-center justify-between p-4 text-left font-bold text-sm text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]/50 transition"
              >
                <span className="flex items-center gap-2">
                  <Thermometer className="h-4 w-4 text-[#0077B6]" />
                  Termômetro de Experiência &amp; Vibe
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${
                    expandedSections.vibe ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {expandedSections.vibe && (
                <div className="p-4 pt-0 border-t border-[var(--border-hairline)] grid sm:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-xl bg-[var(--bg-subtle)] p-3">
                    <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)]">Melhor Horário</span>
                    <p className="mt-1 font-bold text-[var(--text-primary)]">19h30 às 21h00</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">Atmosfera mais viva</p>
                  </div>
                  <div className="rounded-xl bg-[var(--bg-subtle)] p-3">
                    <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)]">Tempo de Espera</span>
                    <p className="mt-1 font-bold text-[var(--text-primary)]">15 a 30 min</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">Em fins de semana</p>
                  </div>
                  <div className="rounded-xl bg-[var(--bg-subtle)] p-3">
                    <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)]">Ambiente</span>
                    <p className="mt-1 font-bold text-[var(--text-primary)]">Descontraído &amp; Carioca</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">Mesa externa agradável</p>
                  </div>
                </div>
              )}
            </div>

            {/* Seção C: Mobilidade & Rotas */}
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('mobility')}
                className="w-full flex items-center justify-between p-4 text-left font-bold text-sm text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]/50 transition"
              >
                <span className="flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-emerald-600" />
                  Como Chegar (Uber, 99 &amp; Maps)
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${
                    expandedSections.mobility ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {expandedSections.mobility && (
                <div className="p-4 pt-0 border-t border-[var(--border-hairline)] space-y-3">
                  <p className="text-xs text-[var(--text-secondary)]">
                    Abra o trajeto direto nos aplicativos instalados com destino pré-configurado:
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <a
                      href={uberUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] py-2 text-xs font-bold text-[var(--text-primary)] hover:border-[#FF6B35]"
                    >
                      <span>🚗 Uber</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <button
                      type="button"
                      onClick={() => launchNineNineRide(rideCoords)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] py-2 text-xs font-bold text-[var(--text-primary)] hover:border-[#FF6B35]"
                    >
                      <span>🟡 99</span>
                      <ExternalLink className="h-3 w-3" />
                    </button>
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] py-2 text-xs font-bold text-[var(--text-primary)] hover:border-[#FF6B35]"
                    >
                      <span>🗺️ Maps</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Seção D: Mapa & Endereço Completo */}
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('map')}
                className="w-full flex items-center justify-between p-4 text-left font-bold text-sm text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]/50 transition"
              >
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#E05A47]" />
                  Localização no Mapa &amp; Endereço
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform duration-200 ${
                    expandedSections.map ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {expandedSections.map && (
                <div className="p-4 pt-0 border-t border-[var(--border-hairline)] space-y-3">
                  <LeafletMap
                    latitude={restaurant.latitude}
                    longitude={restaurant.longitude}
                    name={restaurant.name}
                    address={restaurant.address}
                  />
                  <p className="flex items-start gap-1.5 text-xs text-[var(--text-secondary)]">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#E05A47]" />
                    <span>{restaurant.address}</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 6. RODAPÉ DISCRETO: REIVINDICAR ESTABELECIMENTO */}
          <div className="border-t border-[var(--border-hairline)] pt-5 text-center text-xs text-[var(--text-secondary)]">
            <span>É proprietário ou gerente deste local? </span>
            <button
              type="button"
              onClick={() => setShowClaimModal(true)}
              className="font-bold text-[#FF6B35] hover:underline inline-flex items-center gap-1"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Reivindique o estabelecimento
            </button>
          </div>
        </div>
      </div>

      {/* Tela B Modal de Confirmação & Ativação */}
      {selectedOfferingForActivation && (
        <BenefitActivationModal
          offering={selectedOfferingForActivation}
          restaurant={restaurant}
          onRequireAuth={onRequireAuth}
          onClose={() => setSelectedOfferingForActivation(null)}
          onActivated={(newRes) => {
            setSelectedOfferingForActivation(null);
            onReservationCreated?.(newRes);
          }}
        />
      )}

      {showClaimModal && (
        <ClaimModal
          restaurant={restaurant}
          onClose={() => setShowClaimModal(false)}
          onClaimed={onRestaurantClaimed}
        />
      )}
    </div>
  );
}
