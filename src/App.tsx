import { UtensilsCrossed } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminPanel } from './components/AdminPanel';
import { AgendaView } from './components/AgendaView';
import { BrandLogo } from './components/BrandLogo';
import { ClubView } from './components/ClubView';
import { ConciergeWidget } from './components/ConciergeWidget';
import { DiscoverEditorialSections } from './components/DiscoverEditorialSections';
import { HeroSection, type FilterState } from './components/HeroSection';
import { Navbar, type AppTab } from './components/Navbar';
import { calculateMatchScore, PersonalizeModal } from './components/PersonalizeModal';
import { PlannerView } from './components/PlannerView';
import { ProfileWalletView } from './components/ProfileWalletView';
import { RestaurantCard } from './components/RestaurantCard';
import { RestaurantDetailModal } from './components/RestaurantDetailModal';
import { LandingPage } from './pages/LandingPage';
import { PartnerDashboard } from './pages/PartnerDashboard';
import { PartnersLandingPage } from './pages/PartnersLandingPage';
import { getAllRestaurants, getClaimRequests } from './services/database';
import { usePwaStatus } from './services/pwa';
import { useAppRoute } from './services/router';
import {
  getNotifications,
  getPointsBalance,
  getReservations,
  getUserPreferences,
  markAllNotificationsRead,
  saveUserPreferences,
} from './services/superappStore';
import type { NotificationItem, ReservationRequest, UserPreferences } from './types/experience';
import type { ClaimRequest, Restaurant, RestaurantCategory } from './types/restaurant';

export function App() {
  const [route, navigate] = useAppRoute();
  const { isOnline, canInstall, promptInstall } = usePwaStatus();

  const [activeTab, setActiveTab] = useState<AppTab>('discover');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [claims, setClaims] = useState<ClaimRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [showPersonalize, setShowPersonalize] = useState(false);

  // Superapp State
  const [preferences, setPreferences] = useState<UserPreferences>(() => getUserPreferences());
  const [pointsBalance, setPointsBalance] = useState<number>(() => getPointsBalance());
  const [reservations, setReservations] = useState<ReservationRequest[]>(() => getReservations());
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => getNotifications());

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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rests, claimList] = await Promise.all([getAllRestaurants(), getClaimRequests()]);
      setRestaurants(rests);
      setClaims(claimList);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const availableCategories = useMemo(() => {
    const set = new Set<RestaurantCategory>();
    restaurants.forEach((r) => set.add(r.category));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [restaurants]);

  const filteredRestaurants = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const list = restaurants.filter((r) => {
      if (filters.macroCategory && (r.macro_category || 'Gastronomia') !== filters.macroCategory) {
        return false;
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
  }, [restaurants, filters, preferences]);

  const handleRestaurantClaimed = (restaurantId: string) => {
    setRestaurants((prev) =>
      prev.map((r) => (r.id === restaurantId ? { ...r, is_claimed: true } : r))
    );
    setSelectedRestaurant((prev) =>
      prev && prev.id === restaurantId ? { ...prev, is_claimed: true } : prev
    );
    void getClaimRequests().then(setClaims);
  };

  const handleSavePreferences = (next: UserPreferences) => {
    saveUserPreferences(next);
    setPreferences(next);
  };

  // 1. Public Landing Page (/)
  if (route === '/') {
    return (
      <LandingPage
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        onNavigate={navigate}
        totalExperiences={restaurants.length}
        canInstallPwa={canInstall}
        onInstallPwa={() => void promptInstall()}
      />
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
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        onNavigate={navigate}
        onDatabaseUpdated={loadData}
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

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] pb-24 text-[var(--text-primary)] lg:pb-0">
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
        notifications={notifications}
        onMarkNotificationsRead={() => setNotifications(markAllNotificationsRead())}
        isOnline={isOnline}
        canInstallPwa={canInstall}
        onInstallPwa={() => void promptInstall()}
      />

      {effectiveTab === 'admin' && (
        <AdminPanel
          restaurants={restaurants}
          claims={claims}
          reservations={reservations}
          onDatabaseUpdated={loadData}
        />
      )}

      {effectiveTab === 'discover' && (
        <>
          <HeroSection
            filters={filters}
            onChange={setFilters}
            availableCategories={availableCategories}
            resultCount={filteredRestaurants.length}
            onOpenPersonalize={() => setShowPersonalize(true)}
            personalizationActive={preferences.lgpd_consents.personalization}
            isDark={isDark}
          />

          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {showEditorialDiscover && !loading && (
              <DiscoverEditorialSections
                experiences={restaurants}
                locationConsent={preferences.lgpd_consents.location}
                onSelectExperience={setSelectedRestaurant}
                onGoToExploreMap={() => setActiveTab('planner')}
                onGoToClub={() => setActiveTab('club')}
                onGoToPlanner={() => setActiveTab('planner')}
              />
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
                    ? 'O banco de dados está vazio. Use o Painel de Importação em Lote para carregar o Seed RJ ou extrair dados.'
                    : 'Tente ajustar sua busca ou remover alguns filtros de momento, categoria ou bairro.'}
                </p>
                <div className="mt-6 flex justify-center gap-3">
                  {restaurants.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => navigate('/admin')}
                      className="rounded-xl bg-[#FF765E] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#e8634c]"
                    >
                      Abrir Painel Admin
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
              <div>
                <h2 className="font-sans tracking-tight mb-4 text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
                  {showEditorialDiscover ? 'Em alta no Rio' : 'Resultados para você'}
                </h2>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredRestaurants.map((restaurant, idx) => (
                    <RestaurantCard
                      key={restaurant.id}
                      restaurant={restaurant}
                      index={idx}
                      matchScore={calculateMatchScore(restaurant, preferences)}
                      onSelect={setSelectedRestaurant}
                    />
                  ))}
                </div>
              </div>
            )}
          </main>
        </>
      )}

      {effectiveTab === 'planner' && (
        <PlannerView
          experiences={restaurants}
          onSelectExperience={setSelectedRestaurant}
        />
      )}

      {effectiveTab === 'club' && (
        <ClubView
          experiences={restaurants}
          onSelectExperience={setSelectedRestaurant}
        />
      )}

      {effectiveTab === 'agenda' && (
        <AgendaView
          experiences={restaurants}
          reservations={reservations}
          onReservationsUpdated={setReservations}
          onSelectExperience={setSelectedRestaurant}
        />
      )}

      {effectiveTab === 'profile' && (
        <ProfileWalletView
          experiences={restaurants}
          preferences={preferences}
          onSavePreferences={handleSavePreferences}
          onPointsChanged={() => {
            setPointsBalance(getPointsBalance());
            setNotifications(getNotifications());
          }}
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
            <button type="button" onClick={() => navigate('/admin')} className="hover:text-[#FF765E]">
              Administração
            </button>
          </div>
        </div>
      </footer>

      {effectiveTab !== 'admin' && (
        <ConciergeWidget
          experiences={restaurants}
          onSelectExperience={setSelectedRestaurant}
        />
      )}

      {showPersonalize && (
        <PersonalizeModal
          preferences={preferences}
          onSave={handleSavePreferences}
          onClose={() => setShowPersonalize(false)}
        />
      )}

      {selectedRestaurant && (
        <RestaurantDetailModal
          restaurant={selectedRestaurant}
          onClose={() => setSelectedRestaurant(null)}
          onRestaurantClaimed={handleRestaurantClaimed}
          onReservationCreated={(req) => {
            setReservations((prev) => [req, ...prev]);
            setNotifications(getNotifications());
          }}
        />
      )}
    </div>
  );
}

export default App;
