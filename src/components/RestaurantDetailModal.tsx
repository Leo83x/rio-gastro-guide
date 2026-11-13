import {
  BadgeCheck,
  Camera,
  Clock,
  ExternalLink,
  Globe,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type { Restaurant } from '../types/restaurant';
import { ClaimModal } from './ClaimModal';
import { LeafletMap } from './LeafletMap';
import { SmartImage } from './SmartImage';

interface RestaurantDetailModalProps {
  restaurant: Restaurant;
  onClose: () => void;
  onRestaurantClaimed: (restaurantId: string) => void;
}

export function RestaurantDetailModal({
  restaurant,
  onClose,
  onRestaurantClaimed,
}: RestaurantDetailModalProps) {
  const photos =
    restaurant.gallery && restaurant.gallery.length > 0
      ? restaurant.gallery
      : [restaurant.cover_image];
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [showClaimModal, setShowClaimModal] = useState(false);

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${restaurant.name} ${restaurant.address}`
  )}`;

  const whatsappUrl = restaurant.whatsapp
    ? `https://wa.me/${restaurant.whatsapp.replace(/\D/g, '')}`
    : null;

  const instagramUrl = restaurant.instagram
    ? `https://instagram.com/${restaurant.instagram.replace(/^@/, '')}`
    : null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/75 p-0 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative my-auto max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-none border border-[var(--border-hairline)] bg-[var(--bg-surface)] shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar detalhes"
          className="fixed right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-md transition-colors hover:bg-[#E05A47] sm:absolute"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Gallery Hero */}
        <div className="relative aspect-[16/9] max-h-[380px] w-full overflow-hidden bg-[var(--bg-subtle)]">
          <SmartImage
            src={photos[activePhotoIdx] || restaurant.cover_image}
            alt={restaurant.name}
            category={restaurant.category}
            fallbackIndex={activePhotoIdx}
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          <div className="absolute bottom-5 left-5 right-5 flex flex-col gap-2 sm:bottom-6 sm:left-8 sm:right-8">
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

            <h2 className="font-editorial text-2xl font-bold text-white sm:text-4xl">
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
                className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                  activePhotoIdx === idx
                    ? 'border-[#E05A47] ring-2 ring-[#E05A47]/30'
                    : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <SmartImage
                  src={photo}
                  alt={`${restaurant.name} foto ${idx + 1}`}
                  category={restaurant.category}
                  fallbackIndex={idx}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        )}

        {/* Content Grid */}
        <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-5">
          {/* Left Column */}
          <div className="space-y-6 lg:col-span-3">
            <div className="flex flex-wrap items-center gap-4 border-b border-[var(--border-hairline)] pb-4">
              <div className="flex items-center gap-1.5">
                <Star className="h-5 w-5 fill-[#E5B342] text-[#E5B342]" />
                <span className="text-lg font-bold text-[var(--text-primary)]">
                  {restaurant.rating.toFixed(1)}
                </span>
                <span className="text-sm text-[var(--text-secondary)]">
                  ({restaurant.reviews_count.toLocaleString('pt-BR')} avaliações)
                </span>
              </div>

              {restaurant.opening_hours && (
                <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                  <Clock className="h-4 w-4 text-[#E05A47]" />
                  <span>{restaurant.opening_hours}</span>
                </div>
              )}
            </div>

            <div>
              <h3 className="font-editorial text-xl font-bold text-[var(--text-primary)]">
                Nota do Curador
              </h3>
              <p className="mt-2.5 text-base leading-relaxed text-[var(--text-secondary)]">
                {restaurant.description}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2.5">
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-[#1C1917] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#E05A47] dark:bg-[#F5F2EB] dark:text-[#0F1115] dark:hover:bg-[#E05A47] dark:hover:text-white sm:text-sm"
              >
                <Navigation className="h-4 w-4" />
                Abrir no Google Maps
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </a>

              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400 sm:text-sm"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
              )}

              {instagramUrl && (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:border-[#E05A47]/50 sm:text-sm"
                >
                  <Camera className="h-4 w-4 text-[#E05A47]" />
                  @{restaurant.instagram?.replace(/^@/, '')}
                </a>
              )}

              {restaurant.website && (
                <a
                  href={restaurant.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:border-[#E05A47]/50 sm:text-sm"
                >
                  <Globe className="h-4 w-4 text-[var(--text-secondary)]" />
                  Site Oficial
                </a>
              )}

              {restaurant.phone && (
                <a
                  href={`tel:${restaurant.phone}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)] sm:text-sm"
                >
                  <Phone className="h-4 w-4 text-[var(--text-secondary)]" />
                  {restaurant.phone}
                </a>
              )}
            </div>

            {/* Claim Owner Card */}
            <div className="rounded-2xl border border-[#E05A47]/25 bg-gradient-to-br from-[#E05A47]/8 to-transparent p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                    <ShieldCheck className="h-4 w-4 text-[#E05A47]" />
                    É proprietário deste estabelecimento?
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                    {restaurant.is_claimed
                      ? 'Este perfil já foi reivindicado e verificado pelo restaurante.'
                      : 'Assuma o controle gratuito do perfil para atualizar cardápio, fotos e receber reservas.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowClaimModal(true)}
                  className="shrink-0 rounded-xl bg-[#E05A47] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#c84b39]"
                >
                  {restaurant.is_claimed ? 'Atualizar Dados' : 'Reivindicar Perfil Gratuitamente'}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Map */}
          <div className="space-y-3 lg:col-span-2">
            <h3 className="font-editorial text-lg font-bold text-[var(--text-primary)]">
              Localização no Mapa
            </h3>
            <LeafletMap
              latitude={restaurant.latitude}
              longitude={restaurant.longitude}
              name={restaurant.name}
              address={restaurant.address}
            />
            <p className="flex items-start gap-2 text-xs leading-relaxed text-[var(--text-secondary)]">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#E05A47]" />
              <span>{restaurant.address}</span>
            </p>
          </div>
        </div>
      </div>

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
