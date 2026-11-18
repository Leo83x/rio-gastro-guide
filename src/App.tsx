import { Bookmark, CheckCircle2, SlidersHorizontal, UtensilsCrossed, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminPanel, type AdminTab } from './components/AdminPanel';
import { AdminGatekeeper } from './components/admin/AdminGatekeeper';
import { BrandLogo } from './components/BrandLogo';
import { ClubView } from './components/ClubView';
import { ConciergeWidget } from './components/ConciergeWidget';
import { IntentCaptureModal } from './components/confia/IntentCaptureModal';
import { MeusDesejosView } from './components/wishes/MeusDesejosView';
import { DiscoverEditorialSections } from './components/DiscoverEditorialSections';
import { BenefitActivationModal } from './components/BenefitActivationModal';
import { ExperiencePassModal } from './components/ExperiencePassModal';
import type { PartnerOffering } from './types/marketplace';
import { HeroSection, type FilterState } from './components/HeroSection';
import { Navbar, type AppTab } from './components/Navbar';
import { NightlifeEventModal } from './components/NightlifeEventModal';
import { NightlifeSection } from './components/NightlifeSection';
import { PersonalizeModal } from './components/PersonalizeModal';
import { PlannerView } from './components/PlannerView';
import { PwaInstallModal } from './components/PwaInstallModal';
import {
  ProfileWalletView,
  type ProfileFocusTarget,
  type ProfileSectionTab,
} from './components/ProfileWalletView';
import { RestaurantCard } from './components/RestaurantCard';
import { RestaurantDetailModal } from './components/RestaurantDetailModal';
import { LandingPage } from './pages/LandingPage';
import { PartnerDashboard } from './pages/PartnerDashboard';
import { PartnersLandingPage } from './pages/PartnersLandingPage';
import { PitchDeckPage } from './pages/PitchDeckPage';
import { getUserProfileIdentity, subscribeToAuthChanges, syncSupabaseSessionIdentity } from './services/authService';
import {
  getTrustConnections,
  getVisibleConfiaRecommendations,
} from './services/confiaStore';
import { getAllRestaurants, getClaimRequests } from './services/database';
import { addIntentVaultItem, getIntentVaultItems } from './services/intentVaultStore';
import { calculateMatchScore, getMatchReasonLabel } from './services/matchService';
import { getAllNightlifeEvents } from './services/nightlife/nightlifeStore';
import { usePwaStatus } from './services/pwa';
import { useAppRoute } from './services/router';
import { captureReferralCodeFromUrl, getMyReferralLink } from './services/referralStore';
import {
  getNotifications,
  getPointsBalance,
  getReservations,
  getUserPreferences,
  markAllNotificationsRead,
  saveUserPreferences,
} from './services/superappStore';
import type { ConfiaRecommendation, TrustConnection } from './types/confia';
import type { NotificationItem, ReservationRequest, UserPreferences } from './types/experience';
import type { IntentVaultItem } from './types/intention';
import {
  NIGHTLIFE_SUBAREA_META,
  type NightlifeDateFilter,
  type NightlifeEvent,
  type NightlifeSubArea,
} from './types/nightlife';
import type { CommercialModality } from './types/partnerCommercial';
import type { ClaimRequest, Restaurant, RestaurantCategory } from './types/restaurant';
import type { GeoCoords } from './utils/geo';

const CATALOG_PREVIEW_LIMIT = 6;

export function App() {
  const [route, navigate] = useAppRoute();
  const { isOnline, canInstall, promptInstall } = usePwaStatus();

  const [activeTab, setActiveTab] = useState<AppTab>('discover');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [claims, setClaims] = useState<ClaimRequest[]>([]);
  const [nightlifeEvents, setNightlifeEvents] = useState<NightlifeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [selectedNightlifeEvent, setSelectedNightlifeEvent] = useState<NightlifeEvent | null>(null);
  const [showPersonalize, setShowPersonalize] = useState(false);

  // Nightlife Sub-filters
  const [nightlifeSubAreaFilter, setNightlifeSubAreaFilter] = useState<NightlifeSubArea | 'ALL'>('ALL');
  const [nightlifeDateFilter, setNightlifeDateFilter] = useState<NightlifeDateFilter>('ALL');

  // Superapp State
  const [preferences, setPreferences] = useState<UserPreferences>(() => getUserPreferences());
  const [pointsBalance, setPointsBalance] = useState<number>(() => getPointsBalance());
  const [reservations, setReservations] = useState<ReservationRequest[]>(() => getReservations());
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => getNotifications());
  const [activePassReservation, setActivePassReservation] = useState<ReservationRequest | null>(null);
  const [activeOfferingForActivation, setActiveOfferingForActivation] = useState<PartnerOffering | null>(null);
  const [vipPassBarHidden, setVipPassBarHidden] = useState(false);

  const latestActiveReservation = useMemo(() => {
    return reservations.find(
      (r) =>
        r.stage !== 'CANCELLED' &&
        r.stage !== 'NO_SHOW' &&
        r.stage !== 'ENDED_WITHOUT_GOAL'
    );
  }, [reservations]);

  const activePassRestaurant = useMemo(() => {
    if (!activePassReservation) return null;
    return (
      restaurants.find(
        (r) =>
          r.id === activePassReservation.experience_id ||
          r.name.toLowerCase() === activePassReservation.experience_name.toLowerCase()
      ) || null
    );
  }, [activePassReservation, restaurants]);

  // Optional Location & Home Catalog Controls
  const [userCoords, setUserCoords] = useState<GeoCoords | null>(null);
  const [locationState, setLocationState] = useState<'idle' | 'requesting' | 'granted' | 'denied'>(
    'idle'
  );
  const [catalogExpanded, setCatalogExpanded] = useState(false);
  const [filterDrawerSignal, setFilterDrawerSignal] = useState(0);
  const [adminInitialTab, setAdminInitialTab] = useState<AdminTab>('overpass');
  const [adminDeepLinkNonce, setAdminDeepLinkNonce] = useState(0);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('borario_admin_authenticated') === 'true';
    } catch {
      return false;
    }
  });
  const [clubDeepLink, setClubDeepLink] = useState<{
    section: 'offerings' | 'rewards';
    modality: CommercialModality | 'ALL';
    nonce: number;
  }>({ section: 'offerings', modality: 'ALL', nonce: 0 });
  const [profileDeepLink, setProfileDeepLink] = useState<{
    section: ProfileSectionTab;
    focus: ProfileFocusTarget;
    nonce: number;
  }>({ section: 'passport', focus: null, nonce: 0 });

  // Meus Desejos & Conexões State
  const [vaultItems, setVaultItems] = useState<IntentVaultItem[]>(() => getIntentVaultItems());
  const [connections] = useState<TrustConnection[]>(() => getTrustConnections());
  const [confiaPosts, setConfiaPosts] = useState<ConfiaRecommendation[]>(() =>
    getVisibleConfiaRecommendations()
  );

  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [captureInitialVenue, setCaptureInitialVenue] = useState<Restaurant | null>(null);
  const [captureInitialUrl, setCaptureInitialUrl] = useState<string>('');
  const [pendingBoraIaPrompt, setPendingBoraIaPrompt] = useState<string | null>(null);
  const [pendingPlannerPrompt, setPendingPlannerPrompt] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; showVaultAction?: boolean } | null>(null);
  const [showPwaInstallModal, setShowPwaInstallModal] = useState(false);

  // Garante que qualquer troca de aba ou rota inicie sempre no topo da página
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const resetScroll = () => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      };
      resetScroll();
      requestAnimationFrame(resetScroll);
      const timer = setTimeout(resetScroll, 50);
      return () => clearTimeout(timer);
    }
  }, [activeTab, route]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as unknown as { standalone?: boolean }).standalone);
    if (isStandalone) return;

    try {
      const dismissedUntil = localStorage.getItem('borario_pwa_install_dismissed_until');
      if (dismissedUntil && Number(dismissedUntil) > Date.now()) return;
    } catch {
      // ignore
    }

    const timer = setTimeout(() => {
      setShowPwaInstallModal(true);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  const handleClosePwaModal = useCallback(() => {
    setShowPwaInstallModal(false);
    try {
      localStorage.setItem(
        'borario_pwa_install_dismissed_until',
        String(Date.now() + 48 * 60 * 60 * 1000)
      );
    } catch {
      // ignore
    }
  }, []);

  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('rio_gastro_theme');
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    neighborhood: '',
    category: '',
    macroCategory: '',
    momentMode: 'all',
    priceRange: '',
    minRating: 0,
    onlyFeatured: false,
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('rio_gastro_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('rio_gastro_theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const reloadNightlife = useCallback(async () => {
    const nl = await getAllNightlifeEvents({ runSweep: true });
    setNightlifeEvents(nl);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rests, claimList, nlEvents] = await Promise.all([
        getAllRestaurants(),
        getClaimRequests(),
        getAllNightlifeEvents({ runSweep: true }),
      ]);
      setRestaurants(rests);
      setClaims(claimList);
      setNightlifeEvents(nlEvents);

      // Deep link para abrir automaticamente o estabelecimento compartilhado (?venue=ID ou SLUG)
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const venueParam = params.get('venue');
        if (venueParam) {
          const found = rests.find((r) => r.id === venueParam || r.slug === venueParam);
          if (found) {
            setSelectedRestaurant(found);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    captureReferralCodeFromUrl();
    void loadData();
    void syncSupabaseSessionIdentity();
    const unsub = subscribeToAuthChanges(() => {
      setConfiaPosts(getVisibleConfiaRecommendations());
    });
    return unsub;
  }, [loadData]);

  const availableCategories = useMemo(() => {
    const set = new Set<RestaurantCategory>();
    restaurants.forEach((r) => set.add(r.category));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [restaurants]);

  const activeVaultCount = useMemo(
    () => vaultItems.filter((i) => i.status !== 'ARCHIVED').length,
    [vaultItems]
  );

  const acceptedConnectionsCount = useMemo(
    () => connections.filter((c) => c.status === 'ACCEPTED').length,
    [connections]
  );

  const confiaBadgeCount = useMemo(() => {
    const needsReviewVault = vaultItems.filter(
      (i) =>
        i.status !== 'ARCHIVED' &&
        (i.processing_status === 'NEEDS_CONFIRMATION' || i.processing_status === 'UNIDENTIFIED')
    ).length;
    const pendingFriends = connections.filter((c) => c.status === 'PENDING').length;
    return needsReviewVault + pendingFriends;
  }, [vaultItems, connections]);

  const vaultVenueIds = useMemo(() => {
    const set = new Set<string>();
    for (const item of vaultItems) {
      if (item.status !== 'ARCHIVED' && item.linked_venue_id) {
        set.add(item.linked_venue_id);
      }
    }
    return set;
  }, [vaultItems]);

  const confiaCountsByVenue = useMemo(() => {
    const map = new Map<string, number>();
    for (const post of confiaPosts) {
      map.set(post.venue_id, (map.get(post.venue_id) || 0) + 1);
    }
    return map;
  }, [confiaPosts]);

  const filteredRestaurants = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const list = restaurants.filter((r) => {
      if (filters.macroCategory) {
        if (filters.macroCategory === 'Turismo & Praias') {
          const isPasseio =
            r.macro_category === 'Turismo & Praias' ||
            r.macro_category === 'Cultura & Museus' ||
            r.macro_category === 'Atrações Infantis';
          if (!isPasseio) return false;
        } else if (filters.macroCategory === 'Vida Noturna') {
          const isNight =
            r.macro_category === 'Vida Noturna' ||
            r.macro_category === 'Eventos & Shows' ||
            (r.category || '').toLowerCase().includes('bar') ||
            (r.category || '').toLowerCase().includes('boteco') ||
            (r.category || '').toLowerCase().includes('rooftop');
          if (!isNight) return false;

          if (nightlifeSubAreaFilter !== 'ALL') {
            const cat = (r.category || '').toLowerCase();
            const name = (r.name || '').toLowerCase();
            const desc = (r.description || '').toLowerCase();
            const tags = (r.moment_tags || []).join(' ').toLowerCase();
            const fullText = `${name} ${cat} ${desc} ${tags}`;

            if (nightlifeSubAreaFilter === 'ROOFTOPS_EXPERIENCIAS') {
              const isRooftop =
                cat.includes('rooftop') ||
                name.includes('rooftop') ||
                desc.includes('rooftop') ||
                fullText.includes('vista panorâmica') ||
                fullText.includes('lounge');
              if (!isRooftop) return false;
            } else if (nightlifeSubAreaFilter === 'SAMBA_PAGODE') {
              const isSamba =
                cat.includes('samba') ||
                cat.includes('pagode') ||
                fullText.includes('samba') ||
                fullText.includes('pagode') ||
                fullText.includes('roda de samba') ||
                name.includes('rato') ||
                name.includes('scenarium');
              if (!isSamba) return false;
            } else if (nightlifeSubAreaFilter === 'FESTAS_BALADAS') {
              const isParty =
                cat.includes('balada') ||
                cat.includes('festa') ||
                fullText.includes('balada') ||
                fullText.includes('festa') ||
                fullText.includes('dj') ||
                fullText.includes('eletrônica') ||
                name.includes('bosque');
              if (!isParty) return false;
            } else if (nightlifeSubAreaFilter === 'SHOWS') {
              const isShow =
                cat.includes('show') ||
                cat.includes('teatro') ||
                fullText.includes('show') ||
                fullText.includes('ao vivo') ||
                fullText.includes('concerto') ||
                name.includes('circo') ||
                name.includes('fundição') ||
                name.includes('theatro');
              if (!isShow) return false;
            }
          }
        } else if ((r.macro_category || 'Gastronomia') !== filters.macroCategory) {
          return false;
        }
      }
      if (filters.momentMode !== 'all') {
        const tags = r.moment_tags || [];
        if (filters.momentMode === 'rainy') {
          if (r.attributes?.is_covered === false) return false;
          if (!tags.includes('rainy') && r.attributes?.is_covered !== true) return false;
        } else if (filters.momentMode === 'budget') {
          const isBudget =
            r.attributes?.is_free || r.price_range === '$' || r.price_range === '$$' || tags.includes('budget');
          if (!isBudget) return false;
        } else if (!tags.includes(filters.momentMode)) {
          return false;
        }
      }
      if (filters.neighborhood && r.neighborhood.toLowerCase() !== filters.neighborhood.toLowerCase()) {
        return false;
      }
      if (filters.category && r.category !== filters.category) {
        return false;
      }
      if (filters.priceRange && r.price_range !== filters.priceRange) {
        return false;
      }
      if (filters.minRating > 0 && r.rating < filters.minRating) {
        return false;
      }
      if (filters.onlyFeatured && !r.is_featured) {
        return false;
      }
      if (q) {
        const haystack = `${r.name} ${r.category} ${r.macro_category || ''} ${r.neighborhood} ${r.address} ${r.description}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    if (preferences.lgpd_consents.personalization) {
      return [...list].sort(
        (a, b) =>
          (calculateMatchScore(b, preferences) ?? 0) -
          (calculateMatchScore(a, preferences) ?? 0)
      );
    }

    return list;
  }, [restaurants, filters, preferences, nightlifeSubAreaFilter]);

  const handleRestaurantClaimed = (restaurantId: string) => {
    setRestaurants((prev) =>
      prev.map((r) => (r.id === restaurantId ? { ...r, is_claimed: true } : r))
    );
    setSelectedRestaurant((prev) =>
      prev && prev.id === restaurantId ? { ...prev, is_claimed: true } : prev
    );
    void getClaimRequests().then(setClaims);
  };

  const handleSavePreferences = useCallback((next: UserPreferences) => {
    saveUserPreferences(next);
    setPreferences(next);
    if (!next.lgpd_consents.location) {
      setUserCoords(null);
      setLocationState('idle');
    }
  }, []);

  const handleRequestLocation = useCallback(() => {
    if (!preferences.lgpd_consents.location) {
      const next: UserPreferences = {
        ...preferences,
        lgpd_consents: {
          ...preferences.lgpd_consents,
          location: true,
        },
      };
      saveUserPreferences(next);
      setPreferences(next);
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationState('denied');
      setToast({
        text: 'Localização indisponível neste dispositivo; explorando todo o catálogo normalmente.',
      });
      return;
    }

    setLocationState('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocationState('granted');
        setToast({
          text: 'Localização ativada! Exibindo experiências próximas a você.',
        });
      },
      () => {
        setUserCoords(null);
        setLocationState('denied');
        setToast({
          text: 'Não foi possível ler sua localização agora; catálogo completo liberado normalmente.',
        });
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 }
    );
  }, [preferences]);

  useEffect(() => {
    if (!preferences.lgpd_consents.location || typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!cancelled) {
          setUserCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          setLocationState('granted');
        }
      },
      () => {
        if (!cancelled) {
          setLocationState('denied');
        }
      },
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 300000 }
    );
    return () => {
      cancelled = true;
    };
  }, [preferences.lgpd_consents.location]);

  const handleSaveVenueToVault = (venue: Restaurant) => {
    if (vaultVenueIds.has(venue.id)) {
      setToast({
        text: `"${venue.name}" já está salvo em Meus Desejos.`,
        showVaultAction: true,
      });
      return;
    }

    const next = addIntentVaultItem({
      title: venue.name,
      source_type: 'catalog_bookmark',
      category_tag: venue.macro_category || 'Gastronomia',
      neighborhood_tag: venue.neighborhood,
      linked_venue_id: venue.id,
      linked_venue_name: venue.name,
      status: 'SAVED',
      processing_status: 'COMPLETED',
      processing_message: 'Adicionado diretamente do catálogo BoraRio.',
    });
    setVaultItems(next);
    setToast({
      text: `"${venue.name}" guardado em Meus Desejos!`,
      showVaultAction: true,
    });
  };

  const handleShareVenueToConfia = (venue: Restaurant) => {
    const venueLink = getMyReferralLink(venue.id);
    const text = `Olha esse lugar no BoraRio: *${venue.name}* (${venue.neighborhood})!\nConfira as vantagens exclusivas e venha comigo:\n${venueLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    setToast({
      text: `Link de indicação com vantagens gerado para ${venue.name}!`,
    });
  };

  const openVaultHub = () => {
    setActiveTab('wishes');
  };

  const savedNightlifeKeys = useMemo(() => {
    const set = new Set<string>();
    for (const item of vaultItems) {
      if (item.status !== 'ARCHIVED') {
        if (item.title) set.add(item.title);
        if (item.source_url) set.add(item.source_url);
      }
    }
    return set;
  }, [vaultItems]);

  const handleSaveNightlifeToVault = (ev: NightlifeEvent) => {
    if (savedNightlifeKeys.has(ev.title) || (ev.ticket_url && savedNightlifeKeys.has(ev.ticket_url))) {
      setToast({
        text: `"${ev.title}" já está salvo em Meus Desejos.`,
        showVaultAction: true,
      });
      return;
    }

    const next = addIntentVaultItem({
      title: ev.title,
      source_type: 'web_link',
      source_url: ev.ticket_url || ev.source_url,
      category_tag: 'Vida Noturna',
      neighborhood_tag: ev.neighborhood,
      linked_venue_id: ev.venue_id,
      linked_venue_name: ev.venue_name,
      notes: `${NIGHTLIFE_SUBAREA_META[ev.sub_area].label} · ${ev.event_date} às ${ev.start_time} · ${ev.price_display_label}`,
      status: 'SAVED',
      processing_status: 'COMPLETED',
      processing_message: 'Evento curado de A Noite Carioca salvo em Meus Desejos.',
    });
    setVaultItems(next);
    setToast({
      text: `"${ev.title}" guardado em Meus Desejos!`,
      showVaultAction: true,
    });
  };

  const handleFilterPermanentNightlife = () => {
    setFilters((prev) => ({ ...prev, macroCategory: 'Vida Noturna' }));
    setTimeout(() => {
      document
        .getElementById('home-block-catalog')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const navigateToAdminNightlife = () => {
    setAdminInitialTab('nightlife');
    setAdminDeepLinkNonce((n) => n + 1);
    navigate('/admin');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 1. Public Landing Page (/)
  if (route === '/') {
    return (
      <>
        <LandingPage
          isDark={isDark}
          onToggleTheme={() => setIsDark((prev) => !prev)}
          onNavigate={navigate}
          totalExperiences={restaurants.length}
          canInstallPwa={canInstall}
          onInstallPwa={() => setShowPwaInstallModal(true)}
        />
        <PwaInstallModal
          isOpen={showPwaInstallModal}
          canInstall={canInstall}
          onInstall={promptInstall}
          onClose={handleClosePwaModal}
        />
      </>
    );
  }

  // 2. Partners Commercial Landing (/parceiros)
  if (route === '/parceiros') {
    return (
      <PartnersLandingPage
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        onNavigate={navigate}
      />
    );
  }

  // 3. Independent Partner Dashboard (/parceiros/painel)
  if (route === '/parceiros/painel') {
    return (
      <PartnerDashboard
        restaurants={restaurants}
        reservations={reservations}
        nightlifeEvents={nightlifeEvents}
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        onNavigate={navigate}
        onDatabaseUpdated={loadData}
        onNightlifeUpdated={reloadNightlife}
        onReservationsUpdated={setReservations}
        onSyncAppState={() => {
          setPointsBalance(getPointsBalance());
          setNotifications(getNotifications());
        }}
      />
    );
  }

  // 4. Pitch Deck Executivo (/pitch, /deck, /investidores)
  if (route === '/pitch') {
    return (
      <PitchDeckPage
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        onNavigate={navigate}
      />
    );
  }

  const effectiveTab: AppTab = route === '/admin' ? 'admin' : activeTab;
  const showEditorialDiscover =
    effectiveTab === 'discover' &&
    !filters.search &&
    !filters.neighborhood &&
    !filters.category &&
    !filters.macroCategory &&
    filters.momentMode === 'all' &&
    !filters.priceRange &&
    filters.minRating === 0;

  const isCatalogTruncated =
    showEditorialDiscover && !catalogExpanded && filteredRestaurants.length > CATALOG_PREVIEW_LIMIT;
  const visibleCatalogRestaurants = isCatalogTruncated
    ? filteredRestaurants.slice(0, CATALOG_PREVIEW_LIMIT)
    : filteredRestaurants;

  const navigateToClub = (opts?: {
    section?: 'offerings' | 'rewards';
    modality?: CommercialModality | 'ALL';
  }) => {
    setClubDeepLink((prev) => ({
      section: opts?.section || 'offerings',
      modality: opts?.modality || 'ALL',
      nonce: prev.nonce + 1,
    }));
    setActiveTab('club');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToProfile = (opts?: {
    section?: ProfileSectionTab;
    focus?: ProfileFocusTarget;
  }) => {
    setProfileDeepLink((prev) => ({
      section: opts?.section || 'passport',
      focus: opts?.focus ?? null,
      nonce: prev.nonce + 1,
    }));
    setActiveTab('profile');
    if (!opts?.focus) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-[var(--bg-canvas)] pb-28 text-[var(--text-primary)] lg:pb-0">
      <Navbar
        activeTab={effectiveTab}
        onSelectTab={(tab) => {
          if (route === '/admin') navigate('/app');
          setActiveTab(tab);
        }}
        onNavigateRoute={navigate}
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        totalCount={restaurants.length}
        pointsBalance={pointsBalance}
        confiaBadgeCount={confiaBadgeCount}
        notifications={notifications}
        onMarkNotificationsRead={() => setNotifications(markAllNotificationsRead())}
        isOnline={isOnline}
        canInstallPwa={canInstall}
        onInstallPwa={() => void promptInstall()}
        overlayHero={effectiveTab === 'discover'}
      />

      {effectiveTab === 'admin' &&
        (!isAdminAuthenticated ? (
          <AdminGatekeeper
            onAuthenticated={() => setIsAdminAuthenticated(true)}
            onExit={() => navigate('/app')}
            isDark={isDark}
          />
        ) : (
          <AdminPanel
            key={`admin-${adminInitialTab}-${adminDeepLinkNonce}`}
            restaurants={restaurants}
            claims={claims}
            reservations={reservations}
            nightlifeEvents={nightlifeEvents}
            initialTab={adminInitialTab}
            onDatabaseUpdated={loadData}
            onNightlifeUpdated={reloadNightlife}
            onLogout={() => {
              try {
                sessionStorage.removeItem('borario_admin_authenticated');
              } catch {
                // ignore
              }
              setIsAdminAuthenticated(false);
              navigate('/app');
            }}
          />
        ))}

      {effectiveTab === 'discover' && (
        <>
          <HeroSection
            filters={filters}
            onChange={setFilters}
            availableCategories={availableCategories}
            resultCount={filteredRestaurants.length}
            onOpenPersonalize={() => setShowPersonalize(true)}
            onOpenProfile={() => navigateToProfile({ section: 'privacy' })}
            personalizationActive={preferences.lgpd_consents.personalization}
            locationConsent={preferences.lgpd_consents.location}
            userCoords={userCoords}
            locationState={locationState}
            onRequestLocation={handleRequestLocation}
            homeNeighborhood={getUserProfileIdentity().home_neighborhood}
            vaultCount={activeVaultCount}
            onAskBoraIa={(intentText) => setPendingBoraIaPrompt(intentText)}
            onOpenVault={openVaultHub}
            onOpenVaultCapture={(url) => {
              setCaptureInitialVenue(null);
              setCaptureInitialUrl(url || '');
              setShowCaptureModal(true);
            }}
            externalOpenFiltersSignal={filterDrawerSignal}
            isDark={isDark}
          />

          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {showEditorialDiscover && !loading && (
              <DiscoverEditorialSections
                experiences={restaurants}
                nightlifeEvents={nightlifeEvents}
                savedNightlifeKeys={savedNightlifeKeys}
                preferences={preferences}
                userCoords={userCoords}
                vaultCount={activeVaultCount}
                vaultVenueIds={vaultVenueIds}
                confiaConnectionsCount={acceptedConnectionsCount}
                confiaPosts={confiaPosts}
                confiaCountsByVenue={confiaCountsByVenue}
                pointsBalance={pointsBalance}
                onSelectExperience={setSelectedRestaurant}
                onOpenOfferingActivation={setActiveOfferingForActivation}
                onFilterPermanentNightlife={handleFilterPermanentNightlife}
                onSaveNightlifeToVault={handleSaveNightlifeToVault}
                onAskBoraIa={(intentText) => setPendingBoraIaPrompt(intentText)}
                onGoToAdminNightlife={isAdminAuthenticated ? navigateToAdminNightlife : undefined}
                onRequestLocation={handleRequestLocation}
                onScrollToCatalog={() =>
                  document
                    .getElementById('home-block-catalog')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
                onGoToExploreMap={() => setActiveTab('planner')}
                onGoToClub={navigateToClub}
                onGoToPlanner={() => setActiveTab('planner')}
                onGoToConfia={() => {
                  setActiveTab('wishes');
                }}
                onGoToProfile={navigateToProfile}
                onOpenPersonalize={() => setShowPersonalize(true)}
                activeNightlifeSubArea={nightlifeSubAreaFilter}
                onNightlifeSubAreaChange={(sub) => {
                  setNightlifeSubAreaFilter(sub);
                  if (sub !== 'ALL') {
                    setFilters((prev) => ({ ...prev, macroCategory: 'Vida Noturna' }));
                  }
                }}
                activeNightlifeDateFilter={nightlifeDateFilter}
                onNightlifeDateFilterChange={setNightlifeDateFilter}
              />
            )}

            {!showEditorialDiscover && !loading && filters.macroCategory === 'Vida Noturna' && (
              <div className="mb-10">
                <NightlifeSection
                  events={nightlifeEvents}
                  permanentVenues={restaurants}
                  savedEventTitlesOrUrls={savedNightlifeKeys}
                  onSelectPermanentVenue={setSelectedRestaurant}
                  onSaveEventToVault={handleSaveNightlifeToVault}
                  onAskBoraIa={(intentText) => setPendingBoraIaPrompt(intentText)}
                  onGoToAdminNightlife={isAdminAuthenticated ? navigateToAdminNightlife : undefined}
                  activeSubArea={nightlifeSubAreaFilter}
                  onSubAreaChange={setNightlifeSubAreaFilter}
                  activeDateFilter={nightlifeDateFilter}
                  onDateFilterChange={setNightlifeDateFilter}
                />
              </div>
            )}

            {loading ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-80 animate-pulse rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
                  />
                ))}
              </div>
            ) : filteredRestaurants.length === 0 ? (
              <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-6 py-16 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FF765E]/15 text-[#FF765E]">
                  <UtensilsCrossed className="h-6 w-6" />
                </div>
                <h2 className="font-sans tracking-tight mt-4 text-2xl font-bold text-[var(--text-primary)]">
                  Nenhuma experiência encontrada
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-secondary)]">
                  {restaurants.length === 0
                    ? 'Nenhum resultado carregado no momento. Recarregue a página para atualizar o catálogo.'
                    : 'Tente ajustar sua busca ou remover alguns filtros de momento, categoria ou bairro.'}
                </p>
                <div className="mt-6 flex justify-center gap-3">
                  {restaurants.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="rounded-xl bg-[#FF765E] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#e8634c]"
                    >
                      Recarregar Catálogo
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setFilters({
                          search: '',
                          neighborhood: '',
                          category: '',
                          macroCategory: '',
                          momentMode: 'all',
                          priceRange: '',
                          minRating: 0,
                          onlyFeatured: false,
                        })
                      }
                      className="rounded-xl bg-[#FF765E] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#e8634c]"
                    >
                      Ver todas as experiências
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <section aria-labelledby="home-block-catalog">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2
                      id="home-block-catalog"
                      className="scroll-mt-20 font-sans text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl"
                    >
                      {showEditorialDiscover
                        ? 'Catálogo Completo do Rio'
                        : filters.macroCategory === 'Vida Noturna'
                          ? nightlifeSubAreaFilter === 'ROOFTOPS_EXPERIENCIAS'
                            ? `Rooftops & Bares Panorâmicos (${filteredRestaurants.length})`
                            : nightlifeSubAreaFilter === 'SAMBA_PAGODE'
                              ? `Rodas de Samba & Botecos Tradicionais (${filteredRestaurants.length})`
                              : nightlifeSubAreaFilter === 'FESTAS_BALADAS'
                                ? `Festas & Baladas no Rio (${filteredRestaurants.length})`
                                : nightlifeSubAreaFilter === 'SHOWS'
                                  ? `Casas de Shows & Palcos no Rio (${filteredRestaurants.length})`
                                  : `Opções da Noite Carioca (${filteredRestaurants.length})`
                          : `Resultados para você (${filteredRestaurants.length})`}
                    </h2>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {showEditorialDiscover
                        ? isCatalogTruncated
                          ? `Amostra inicial com ${visibleCatalogRestaurants.length} de ${filteredRestaurants.length} experiências no Rio.`
                          : `Exibindo todas as ${filteredRestaurants.length} experiências do catálogo.`
                        : filters.macroCategory === 'Vida Noturna'
                          ? 'Estabelecimentos e programações noturnas filtrados no Rio.'
                          : 'Filtros aplicados sobre o catálogo completo do Rio.'}
                    </p>
                    {filters.macroCategory === 'Vida Noturna' &&
                      (nightlifeSubAreaFilter !== 'ALL' || nightlifeDateFilter !== 'ALL') && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {nightlifeSubAreaFilter !== 'ALL' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#123B56]/10 px-2.5 py-0.5 text-xs font-semibold text-[#123B56] dark:bg-sky-900/30 dark:text-sky-300">
                              {nightlifeSubAreaFilter === 'ROOFTOPS_EXPERIENCIAS' && 'Rooftops e experiências'}
                              {nightlifeSubAreaFilter === 'SAMBA_PAGODE' && 'Samba e pagode'}
                              {nightlifeSubAreaFilter === 'FESTAS_BALADAS' && 'Festas e baladas'}
                              {nightlifeSubAreaFilter === 'SHOWS' && 'Shows'}
                              <button
                                type="button"
                                onClick={() => setNightlifeSubAreaFilter('ALL')}
                                className="ml-1 hover:opacity-75"
                                title="Remover filtro de subárea"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          )}
                          {nightlifeDateFilter !== 'ALL' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#FF765E]/15 px-2.5 py-0.5 text-xs font-semibold text-[#FF765E]">
                              {nightlifeDateFilter === 'TODAY' && 'Dia: Hoje'}
                              {nightlifeDateFilter === 'TOMORROW' && 'Dia: Amanhã'}
                              {nightlifeDateFilter === 'FRIDAY' && 'Dia: Sexta-feira'}
                              {nightlifeDateFilter === 'SATURDAY' && 'Dia: Sábado'}
                              {nightlifeDateFilter === 'SUNDAY' && 'Dia: Domingo'}
                              {nightlifeDateFilter === 'FREE' && 'Entrada Franca'}
                              <button
                                type="button"
                                onClick={() => setNightlifeDateFilter('ALL')}
                                className="ml-1 hover:opacity-75"
                                title="Remover filtro de data"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setNightlifeSubAreaFilter('ALL');
                              setNightlifeDateFilter('ALL');
                            }}
                            className="text-xs text-[var(--text-secondary)] underline hover:text-[var(--text-primary)]"
                          >
                            Limpar filtros da noite
                          </button>
                        </div>
                      )}
                  </div>

                  {showEditorialDiscover && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                          setFilterDrawerSignal((n) => n + 1);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-1.5 text-xs font-bold text-[var(--text-primary)] hover:border-[#FF6B35]"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5 text-[#FF6B35]" />
                        Filtrar catálogo
                      </button>
                      {filteredRestaurants.length > CATALOG_PREVIEW_LIMIT && (
                        <button
                          type="button"
                          onClick={() => setCatalogExpanded((prev) => !prev)}
                          className="rounded-full bg-[#123B56] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#102F46]"
                        >
                          {catalogExpanded
                            ? 'Mostrar amostra inicial (6)'
                            : `Ver todos (${filteredRestaurants.length})`}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleCatalogRestaurants.map((restaurant, idx) => {
                    const match = calculateMatchScore(restaurant, preferences);
                    const inVault = vaultVenueIds.has(restaurant.id);
                    const confiaCount = confiaCountsByVenue.get(restaurant.id) || 0;
                    const reason =
                      match !== null || inVault || confiaCount > 0
                        ? getMatchReasonLabel({
                            item: restaurant,
                            prefs: preferences,
                            inVault,
                            confiaCount,
                          })
                        : undefined;
                    return (
                      <RestaurantCard
                        key={restaurant.id}
                        restaurant={restaurant}
                        index={idx}
                        matchScore={match}
                        matchReason={reason}
                        inVault={inVault}
                        confiaCount={confiaCount}
                        onSaveToVault={handleSaveVenueToVault}
                        onSelect={setSelectedRestaurant}
                      />
                    );
                  })}
                </div>

                {showEditorialDiscover && filteredRestaurants.length > CATALOG_PREVIEW_LIMIT && (
                  <div className="mt-6 flex flex-col items-center justify-between gap-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-5 py-4 text-xs sm:flex-row">
                    <p className="text-[var(--text-secondary)]">
                      {catalogExpanded
                        ? `Exibindo todas as ${filteredRestaurants.length} experiências disponíveis na cidade.`
                        : `Quer explorar além destes ${visibleCatalogRestaurants.length} destaques? O catálogo completo reúne ${filteredRestaurants.length} lugares e eventos no Rio.`}
                    </p>
                    <button
                      type="button"
                      onClick={() => setCatalogExpanded((prev) => !prev)}
                      className="shrink-0 rounded-full bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:opacity-95"
                    >
                      {catalogExpanded
                        ? 'Recolher amostra do catálogo'
                        : `Explorar catálogo completo (${filteredRestaurants.length} locais)`}
                    </button>
                  </div>
                )}
              </section>
            )}
          </main>
        </>
      )}

      {effectiveTab === 'planner' && (
        <PlannerView
          experiences={restaurants}
          vaultItems={vaultItems}
          confiaPosts={confiaPosts}
          initialPrompt={pendingPlannerPrompt}
          onConsumeInitialPrompt={() => setPendingPlannerPrompt(null)}
          onItinerarySaved={() =>
            setToast({ text: 'Roteiro salvo em Perfil › Minha Agenda & Roteiros!' })
          }
          onReservationCreated={(req) => {
            setReservations((prev) => [req, ...prev]);
            setNotifications(getNotifications());
            setActivePassReservation(req);
            setToast({
              text: `Passe VIP gerado para ${req.experience_name}!`,
            });
          }}
          onConfiaPostCreated={() => {
            setConfiaPosts(getVisibleConfiaRecommendations());
            setToast({ text: 'Roteiro compartilhado com segurança na Rede Confia!' });
          }}
          onGoToConfia={() => {
            setActiveTab('wishes');
          }}
          onSelectExperience={setSelectedRestaurant}
        />
      )}

      {(effectiveTab === 'wishes' || effectiveTab === 'confia') && (
        <MeusDesejosView
          catalog={restaurants}
          items={vaultItems}
          onItemsChanged={setVaultItems}
          onOpenCaptureModal={() => {
            setCaptureInitialVenue(null);
            setShowCaptureModal(true);
          }}
          onPlanWithBoraIa={(promptText) => setPendingBoraIaPrompt(promptText)}
          onSelectVenue={setSelectedRestaurant}
          onGoToPlanner={() => setActiveTab('planner')}
        />
      )}

      {effectiveTab === 'club' && (
        <ClubView
          experiences={restaurants}
          initialSection={clubDeepLink.section}
          initialModality={clubDeepLink.modality}
          deepLinkNonce={clubDeepLink.nonce}
          onSelectExperience={setSelectedRestaurant}
          onReservationCreated={(req) => {
            setReservations((prev) => [req, ...prev]);
            setNotifications(getNotifications());
            setActivePassReservation(req);
          }}
          onPointsChanged={() => {
            setPointsBalance(getPointsBalance());
            setNotifications(getNotifications());
          }}
        />
      )}

      {effectiveTab === 'profile' && (
        <ProfileWalletView
          experiences={restaurants}
          preferences={preferences}
          reservations={reservations}
          vaultCount={activeVaultCount}
          confiaConnectionsCount={acceptedConnectionsCount}
          initialSectionTab={profileDeepLink.section}
          focusTarget={profileDeepLink.focus}
          deepLinkNonce={profileDeepLink.nonce}
          onSavePreferences={handleSavePreferences}
          onReservationsUpdated={setReservations}
          onOpenPersonalize={() => setShowPersonalize(true)}
          onOpenConfiaHub={() => {
            setActiveTab('wishes');
          }}
          onPointsChanged={() => {
            setPointsBalance(getPointsBalance());
            setNotifications(getNotifications());
          }}
          onOpenActivePass={setActivePassReservation}
        />
      )}

      <footer className="mt-16 border-t border-[var(--border-hairline)] bg-[var(--bg-surface)] py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-xs text-[var(--text-secondary)] sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <BrandLogo variant="horizontal" size="sm" onDark={isDark} />
            <span>· A cidade acontece. Você aproveita.</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => navigate('/')} className="hover:text-[#FF765E]">
              Site Institucional
            </button>
            <button type="button" onClick={() => navigate('/parceiros')} className="hover:text-[#FF765E]">
              Área de Parceiros
            </button>
          </div>
        </div>
      </footer>

      {toast && (
        <div className="fixed left-1/2 top-20 z-50 flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-[#123B56]/25 bg-[#123B56] px-4 py-3 text-xs text-white shadow-2xl">
          <div className="flex min-w-0 items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#4CA188]" />
            <span className="truncate font-semibold">{toast.text}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {toast.showVaultAction && (
              <button
                type="button"
                onClick={() => {
                  setToast(null);
                  openVaultHub();
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-[#FF6B35] px-2.5 py-1 text-[11px] font-bold text-white hover:opacity-95"
              >
                <Bookmark className="h-3 w-3" />
                Ver Desejos
              </button>
            )}
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Fechar aviso"
              className="rounded p-0.5 text-white/70 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {effectiveTab !== 'admin' && (
        <ConciergeWidget
          experiences={restaurants}
          nightlifeEvents={nightlifeEvents}
          externalPrompt={pendingBoraIaPrompt}
          onConsumeExternalPrompt={() => setPendingBoraIaPrompt(null)}
          onSendToPlanner={(promptText) => {
            setPendingPlannerPrompt(promptText);
            setActiveTab('planner');
          }}
          onSelectExperience={setSelectedRestaurant}
          onSelectNightlifeEvent={setSelectedNightlifeEvent}
          isHome={effectiveTab === 'discover'}
        />
      )}

      {showPersonalize && (
        <PersonalizeModal
          preferences={preferences}
          onSave={handleSavePreferences}
          onClose={() => setShowPersonalize(false)}
        />
      )}

      {showCaptureModal && (
        <IntentCaptureModal
          catalog={restaurants}
          initialVenue={captureInitialVenue}
          initialUrl={captureInitialUrl}
          onClose={() => {
            setShowCaptureModal(false);
            setCaptureInitialVenue(null);
            setCaptureInitialUrl('');
          }}
          onSaved={(nextItems) => {
            setVaultItems(nextItems);
            setToast({
              text: 'Desejo salvo com sucesso em Meus Desejos!',
              showVaultAction: effectiveTab !== 'wishes',
            });
          }}
        />
      )}

      {selectedNightlifeEvent && (
        <NightlifeEventModal
          event={selectedNightlifeEvent}
          linkedVenue={
            selectedNightlifeEvent.venue_id
              ? restaurants.find((r) => r.id === selectedNightlifeEvent.venue_id) || null
              : null
          }
          inVault={
            savedNightlifeKeys.has(selectedNightlifeEvent.title) ||
            (selectedNightlifeEvent.ticket_url
              ? savedNightlifeKeys.has(selectedNightlifeEvent.ticket_url)
              : false)
          }
          onClose={() => setSelectedNightlifeEvent(null)}
          onOpenPermanentVenue={(venue) => {
            setSelectedNightlifeEvent(null);
            setSelectedRestaurant(venue);
          }}
          onSaveToVault={handleSaveNightlifeToVault}
          onAskBoraIa={(promptText) => {
            setSelectedNightlifeEvent(null);
            setPendingBoraIaPrompt(promptText);
          }}
        />
      )}

      {selectedRestaurant && (
        <RestaurantDetailModal
          restaurant={selectedRestaurant}
          inVault={vaultVenueIds.has(selectedRestaurant.id)}
          locationConsent={preferences.lgpd_consents.location}
          onSaveToVault={handleSaveVenueToVault}
          onShareToConfia={handleShareVenueToConfia}
          onClose={() => setSelectedRestaurant(null)}
          onRestaurantClaimed={handleRestaurantClaimed}
          onReservationCreated={(req) => {
            setReservations((prev) => [req, ...prev]);
            setNotifications(getNotifications());
            setSelectedRestaurant(null);
            setVipPassBarHidden(false);
            setActivePassReservation(req);
          }}
        />
      )}

      {/* Floating Active VIP Pass Badge */}
      {latestActiveReservation &&
        !vipPassBarHidden &&
        !activePassReservation &&
        !selectedRestaurant &&
        !selectedNightlifeEvent && (
          <div className="fixed bottom-[5.25rem] left-3 right-[4.75rem] z-30 sm:bottom-6 sm:left-6 sm:right-auto sm:w-auto sm:min-w-[320px] sm:max-w-sm pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-amber-500/35 bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 p-2 pl-3.5 text-white shadow-xl shadow-stone-950/35 transition-all hover:border-amber-400/60">
              <button
                type="button"
                onClick={() => setActivePassReservation(latestActiveReservation)}
                className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                  </span>
                  <div className="min-w-0 truncate">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      Passe VIP Ativo
                    </p>
                    <p className="truncate text-sm font-bold text-white">
                      {latestActiveReservation.experience_name}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-xl border border-amber-500/40 bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-300">
                  Ver Passe 🎟️
                </span>
              </button>
              <button
                type="button"
                onClick={() => setVipPassBarHidden(true)}
                aria-label="Ocultar Passe VIP"
                title="Ocultar barra (acesse depois em Perfil)"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-stone-400 transition hover:bg-white/10 hover:text-white"
              >
                ×
              </button>
            </div>
          </div>
        )}

      {activeOfferingForActivation && (
        <BenefitActivationModal
          offering={activeOfferingForActivation}
          restaurant={
            restaurants.find((r) => r.id === activeOfferingForActivation.restaurant_id) || null
          }
          onClose={() => setActiveOfferingForActivation(null)}
          onActivated={(newRes) => {
            setActiveOfferingForActivation(null);
            setReservations((prev) => [newRes, ...prev]);
            setNotifications(getNotifications());
            setVipPassBarHidden(false);
            setActivePassReservation(newRes);
            setToast({
              text: `Benefício ativado com sucesso em ${newRes.experience_name}!`,
            });
          }}
        />
      )}

      {activePassReservation && (
        <ExperiencePassModal
          reservation={activePassReservation}
          restaurant={activePassRestaurant}
          onClose={() => setActivePassReservation(null)}
          onCheckinSuccess={(updatedRes) => {
            setReservations((prev) =>
              prev.map((r) => (r.id === updatedRes.id ? updatedRes : r))
            );
            setActivePassReservation(updatedRes);
            setPointsBalance(getPointsBalance());
            setNotifications(getNotifications());
          }}
          onReservationsUpdated={(all) => {
            setReservations(all);
            setPointsBalance(getPointsBalance());
            setNotifications(getNotifications());
          }}
        />
      )}

      <PwaInstallModal
        isOpen={showPwaInstallModal}
        canInstall={canInstall}
        onInstall={promptInstall}
        onClose={handleClosePwaModal}
      />
    </div>
  );
}

export default App;

