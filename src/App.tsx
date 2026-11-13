import { UtensilsCrossed } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminPanel } from './components/AdminPanel';
import { HeroSection, type FilterState } from './components/HeroSection';
import { Navbar } from './components/Navbar';
import { RestaurantCard } from './components/RestaurantCard';
import { RestaurantDetailModal } from './components/RestaurantDetailModal';
import { getAllRestaurants, getClaimRequests } from './services/database';
import type { ClaimRequest, Restaurant, RestaurantCategory } from './types/restaurant';

export function App() {
  const [view, setView] = useState<'guide' | 'admin'>('guide');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [claims, setClaims] = useState<ClaimRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);

  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem('rio_gastro_theme') === 'dark';
    } catch {
      return false;
    }
  });

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    neighborhood: '',
    category: '',
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
    return restaurants.filter((r) => {
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
        const haystack = `${r.name} ${r.category} ${r.neighborhood} ${r.address} ${r.description}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [restaurants, filters]);

  const handleRestaurantClaimed = (restaurantId: string) => {
    setRestaurants((prev) =>
      prev.map((r) => (r.id === restaurantId ? { ...r, is_claimed: true } : r))
    );
    setSelectedRestaurant((prev) =>
      prev && prev.id === restaurantId ? { ...prev, is_claimed: true } : prev
    );
    void getClaimRequests().then(setClaims);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <Navbar
        view={view}
        onToggleView={setView}
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        totalCount={restaurants.length}
      />

      {view === 'admin' ? (
        <AdminPanel
          restaurants={restaurants}
          claims={claims}
          onDatabaseUpdated={loadData}
        />
      ) : (
        <>
          <HeroSection
            filters={filters}
            onChange={setFilters}
            availableCategories={availableCategories}
            resultCount={filteredRestaurants.length}
          />

          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#E05A47]/15 text-[#E05A47]">
                  <UtensilsCrossed className="h-6 w-6" />
                </div>
                <h2 className="font-editorial mt-4 text-2xl font-bold text-[var(--text-primary)]">
                  Nenhum estabelecimento encontrado
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-secondary)]">
                  {restaurants.length === 0
                    ? 'O banco de dados está vazio. Use o Painel de Importação em Lote para carregar o Seed RJ ou extrair restaurantes reais do OpenStreetMap.'
                    : 'Tente ajustar sua busca ou remover alguns filtros de bairro, preço ou culinária.'}
                </p>
                <div className="mt-6 flex justify-center gap-3">
                  {restaurants.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => setView('admin')}
                      className="rounded-xl bg-[#E05A47] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#c84b39]"
                    >
                      Abrir Importador em Lote
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setFilters({
                          search: '',
                          neighborhood: '',
                          category: '',
                          priceRange: '',
                          minRating: 0,
                          onlyFeatured: false,
                        })
                      }
                      className="rounded-xl bg-[#E05A47] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#c84b39]"
                    >
                      Ver todos os estabelecimentos
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredRestaurants.map((restaurant, idx) => (
                  <RestaurantCard
                    key={restaurant.id}
                    restaurant={restaurant}
                    index={idx}
                    onSelect={setSelectedRestaurant}
                  />
                ))}
              </div>
            )}
          </main>
        </>
      )}

      <footer className="mt-16 border-t border-[var(--border-hairline)] bg-[var(--bg-surface)] py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 text-xs text-[var(--text-secondary)] sm:flex-row sm:px-6 lg:px-8">
          <p>
            <strong className="font-editorial text-sm text-[var(--text-primary)]">
              Rio Gastro Guide
            </strong>{' '}
            · Curadoria gastronômica independente do Rio de Janeiro.
          </p>
          <p>Mapas por OpenStreetMap & Leaflet · Persistência híbrida local / Supabase</p>
        </div>
      </footer>

      {selectedRestaurant && (
        <RestaurantDetailModal
          restaurant={selectedRestaurant}
          onClose={() => setSelectedRestaurant(null)}
          onRestaurantClaimed={handleRestaurantClaimed}
        />
      )}
    </div>
  );
}

export default App;
