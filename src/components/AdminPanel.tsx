import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  Globe2,
  KeyRound,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { useMemo, useState, type DragEvent } from 'react';
import {
  clearDatabase,
  exportRestaurantsAsCSV,
  exportRestaurantsAsJSON,
  getStorageMode,
  resetToSeed,
  upsertRestaurants,
} from '../services/database';
import {
  detectColumnMapping,
  mapRowsToRestaurants,
  parseUploadedFile,
  type ColumnMapping,
  type RawRow,
} from '../services/fileImporter';
import {
  fetchFromOverpass,
  rewriteDescriptionsWithGemini,
  RIO_NEIGHBORHOODS_BBOX,
  type OverpassAmenityType,
} from '../services/overpass';
import { fetchFromGooglePlacesOfficial } from '../services/sources/googlePlaces';
import { DATA_SOURCE_LABELS, findDuplicateInDatabase } from '../services/validator';
import type { ReservationRequest } from '../types/experience';
import type {
  ClaimRequest,
  ImageOrigin,
  Restaurant,
  RestaurantCategory,
  ValidationStatus,
} from '../types/restaurant';
import { B2BPartnerView } from './B2BPartnerView';
import { SmartImage } from './SmartImage';

interface AdminPanelProps {
  restaurants: Restaurant[];
  claims: ClaimRequest[];
  reservations: ReservationRequest[];
  onDatabaseUpdated: () => Promise<void>;
}

type AdminTab = 'overpass' | 'csv' | 'seed' | 'claims' | 'b2b';
type LiveSource = 'openstreetmap' | 'google_places_api';
type StatusFilter = 'ALL' | ValidationStatus;

interface StagedItem {
  id: string;
  selected: boolean;
  isDuplicate: boolean;
  data: Omit<Restaurant, 'id'>;
}

const CATEGORIES: RestaurantCategory[] = [
  'Italiano',
  'Japonês',
  'Boteco Carioca',
  'Churrascaria',
  'Bistrô',
  'Frutos do Mar',
  'Pizzaria',
  'Cafeteria',
  'Brasileiro',
  'Hamburgueria',
  'Contemporâneo',
];

const STATUS_BADGE_STYLES: Record<ValidationStatus, string> = {
  CONFIRMADO: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  PENDENTE: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  'FECHADO/INVÁLIDO': 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
};

export function AdminPanel({
  restaurants,
  claims,
  reservations,
  onDatabaseUpdated,
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overpass');
  const storageMode = getStorageMode();

  // Mode 1: Multi-Source Live Extractor State
  const [liveSource, setLiveSource] = useState<LiveSource>('openstreetmap');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('Botafogo');
  const [amenityType, setAmenityType] = useState<OverpassAmenityType>('restaurant');
  const [googlePlacesKey, setGooglePlacesKey] = useState<string>('');
  const [geminiKey, setGeminiKey] = useState<string>('');
  const [overpassLoading, setOverpassLoading] = useState(false);
  const [overpassStatus, setOverpassStatus] = useState<string>('');
  const [overpassError, setOverpassError] = useState<string>('');

  // Staging Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [minRatingFilter, setMinRatingFilter] = useState<number>(0);
  const [minReviewsFilter, setMinReviewsFilter] = useState<number>(0);
  const [hideDuplicates, setHideDuplicates] = useState<boolean>(false);

  // Mode 2: CSV / JSON State (Preserved)
  const [isDragging, setIsDragging] = useState(false);
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRawRows, setCsvRawRows] = useState<RawRow[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(null);
  const [csvError, setCsvError] = useState<string>('');

  // Shared Staging Area
  const [staged, setStaged] = useState<StagedItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 5500);
  };

  const toStagedItems = (items: Array<Omit<Restaurant, 'id'>>): StagedItem[] => {
    return items.map((data, idx) => {
      const dup = findDuplicateInDatabase(data, restaurants);
      const isClosed = data.validation_status === 'FECHADO/INVÁLIDO';
      const isAuthorized = data.is_redistribution_authorized !== false;
      return {
        id: `${data.external_id}-${idx}`,
        selected: !dup && !isClosed && isAuthorized,
        isDuplicate: Boolean(dup),
        data,
      };
    });
  };

  // --- Mode 1: Multi-Source Live Fetch ---
  const handleLiveFetch = async () => {
    setOverpassLoading(true);
    setOverpassError('');
    setOverpassStatus('Iniciando consulta na fonte selecionada...');
    setStaged([]);
    setStatusFilter('ALL');
    setMinRatingFilter(0);
    setMinReviewsFilter(0);

    try {
      let items: Array<Omit<Restaurant, 'id'>> = [];

      if (liveSource === 'openstreetmap') {
        items = await fetchFromOverpass(selectedNeighborhood, amenityType, (step) => {
          setOverpassStatus(step);
        });
      } else {
        items = await fetchFromGooglePlacesOfficial(
          selectedNeighborhood,
          amenityType,
          googlePlacesKey,
          (step) => setOverpassStatus(step)
        );
      }

      if (items.length === 0) {
        setOverpassError(
          `Nenhum estabelecimento encontrado em ${selectedNeighborhood} para este filtro. Tente outro bairro ou categoria.`
        );
        setOverpassStatus('');
        return;
      }

      if (geminiKey.trim()) {
        items = await rewriteDescriptionsWithGemini(items, geminiKey, (step) => {
          setOverpassStatus(step);
        });
      }

      setOverpassStatus(
        `${items.length} estabelecimentos carregados na Staging Area para revisão e validação.`
      );
      setStaged(toStagedItems(items));
    } catch (err) {
      setOverpassError(
        err instanceof Error ? err.message : 'Erro inesperado ao consultar a fonte selecionada.'
      );
      setOverpassStatus('');
    } finally {
      setOverpassLoading(false);
    }
  };

  // --- Mode 2: CSV / JSON Handlers (Preserved) ---
  const processFile = async (file: File) => {
    setCsvError('');
    try {
      const { headers, rows } = await parseUploadedFile(file);
      if (rows.length === 0) {
        setCsvError('O arquivo está vazio ou não possui linhas válidas.');
        return;
      }
      const detected = detectColumnMapping(headers);
      setCsvFileName(file.name);
      setCsvHeaders(headers);
      setCsvRawRows(rows);
      setColumnMapping(detected);

      const mapped = mapRowsToRestaurants(rows, detected).map((r) => ({
        ...r,
        data_source: 'csv_import' as const,
        is_redistribution_authorized: true,
        validation_status: 'PENDENTE' as const,
        operational_status: 'DESCONHECIDO' as const,
        confidence_level: 'MÉDIA' as const,
        last_verified_at: new Date().toISOString(),
        image_origin: r.cover_image ? ('commercial_licensed' as const) : ('none' as const),
        has_real_photo: Boolean(r.cover_image),
      }));
      setStaged(toStagedItems(mapped));
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : 'Falha ao ler o arquivo CSV/JSON.');
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
  };

  const handleMappingChange = (field: keyof ColumnMapping, header: string) => {
    if (!columnMapping) return;
    const next = { ...columnMapping, [field]: header };
    setColumnMapping(next);
    const mapped = mapRowsToRestaurants(csvRawRows, next);
    setStaged(toStagedItems(mapped));
  };

  // --- Filtered Staging View ---
  const hasAuthorizedRatings = useMemo(
    () => staged.some((s) => s.data.rating_source === 'authorized_source'),
    [staged]
  );

  const filteredStaged = useMemo(() => {
    return staged.filter((item) => {
      const status = item.data.validation_status || 'PENDENTE';
      if (statusFilter !== 'ALL' && status !== statusFilter) return false;
      if (hideDuplicates && item.isDuplicate) return false;
      if (hasAuthorizedRatings) {
        if (minRatingFilter > 0 && item.data.rating < minRatingFilter) return false;
        if (minReviewsFilter > 0 && item.data.reviews_count < minReviewsFilter) return false;
      }
      return true;
    });
  }, [staged, statusFilter, hideDuplicates, hasAuthorizedRatings, minRatingFilter, minReviewsFilter]);

  const statusCounts = useMemo(() => {
    let confirmados = 0;
    let pendentes = 0;
    let fechados = 0;
    let duplicados = 0;
    staged.forEach((s) => {
      const st = s.data.validation_status || 'PENDENTE';
      if (st === 'CONFIRMADO') confirmados++;
      else if (st === 'FECHADO/INVÁLIDO') fechados++;
      else pendentes++;
      if (s.isDuplicate) duplicados++;
    });
    return { confirmados, pendentes, fechados, duplicados };
  }, [staged]);

  const authorizedSelectedItems = useMemo(
    () =>
      staged.filter(
        (s) =>
          s.selected &&
          s.data.validation_status !== 'FECHADO/INVÁLIDO' &&
          s.data.is_redistribution_authorized !== false
      ),
    [staged]
  );

  const toggleAllVisible = (checked: boolean) => {
    const visibleIds = new Set(filteredStaged.map((f) => f.id));
    setStaged((prev) =>
      prev.map((item) => {
        if (!visibleIds.has(item.id)) return item;
        if (
          checked &&
          (item.data.validation_status === 'FECHADO/INVÁLIDO' ||
            item.data.is_redistribution_authorized === false)
        ) {
          return item;
        }
        return { ...item, selected: checked };
      })
    );
  };

  const handleBulkUpsert = async () => {
    const toImport = authorizedSelectedItems.map((s) => s.data);
    if (toImport.length === 0) return;

    setImporting(true);
    try {
      const res = await upsertRestaurants(toImport);
      await onDatabaseUpdated();
      setStaged([]);
      showToast(
        `Publicação autorizada concluída: ${res.inserted} novos adicionados, ${res.updated} atualizados. Total no guia: ${res.total}.`
      );
    } finally {
      setImporting(false);
    }
  };

  const handleResetSeed = async () => {
    await resetToSeed();
    await onDatabaseUpdated();
    showToast('Base restaurada com os 12 restaurantes icônicos do Rio de Janeiro!');
  };

  const handleClearDB = async () => {
    await clearDatabase();
    await onDatabaseUpdated();
    setStaged([]);
    showToast('Banco de dados limpo com sucesso. Pronto para novos testes de importação.');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header & Global Controls */}
      <div className="flex flex-col gap-4 border-b border-[var(--border-hairline)] pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E05A47]/15 px-3 py-1 text-xs font-semibold text-[#E05A47]">
              <Database className="h-3.5 w-3.5" />
              Modo: {storageMode === 'supabase' ? 'Supabase PostgreSQL' : 'LocalStorage (Instantâneo)'}
            </span>
            <span className="rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
              {restaurants.length} estabelecimentos ativos
            </span>
          </div>
          <h1 className="font-sans tracking-tight mt-3 text-3xl font-bold text-[var(--text-primary)]">
            Motor de Extração &amp; Validação Multi-Fonte
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Importe com procedência rastreável, validação de status e política rígida de fotografias reais ou placeholder editorial.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportRestaurantsAsJSON(restaurants)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:border-[#E05A47]/50"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar JSON
          </button>
          <button
            type="button"
            onClick={() => exportRestaurantsAsCSV(restaurants)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:border-[#E05A47]/50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={handleResetSeed}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:border-[#E05A47]/50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Restaurar Seed (12 RJ)
          </button>
          <button
            type="button"
            onClick={handleClearDB}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-500/20 dark:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Limpar Banco
          </button>
        </div>
      </div>

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="mt-5 flex items-center gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Mode Tabs */}
      <div className="mt-6 flex flex-wrap gap-2 border-b border-[var(--border-hairline)] pb-4">
        <button
          type="button"
          onClick={() => {
            setActiveTab('overpass');
            setStaged([]);
          }}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
            activeTab === 'overpass'
              ? 'bg-[#E05A47] text-white shadow-sm'
              : 'border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Globe2 className="h-4 w-4" />
          1. Extrator Ao Vivo (Multi-Fonte)
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('csv');
            setStaged([]);
          }}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
            activeTab === 'csv'
              ? 'bg-[#E05A47] text-white shadow-sm'
              : 'border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Upload className="h-4 w-4" />
          2. Importador Universal CSV / JSON
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('seed')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
            activeTab === 'seed'
              ? 'bg-[#E05A47] text-white shadow-sm'
              : 'border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          3. Carga Inicial (1-Click Seed RJ)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('claims')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
            activeTab === 'claims'
              ? 'bg-[#E05A47] text-white shadow-sm'
              : 'border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Users className="h-4 w-4" />
          Leads Reivindicados ({claims.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('b2b')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
            activeTab === 'b2b'
              ? 'bg-[#E05A47] text-white shadow-sm'
              : 'border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          Visão do Parceiro (B2B)
        </button>
      </div>

      {activeTab === 'b2b' && (
        <B2BPartnerView experiences={restaurants} reservations={reservations} />
      )}

      {/* Tab 1: Multi-Source Live Extractor */}
      {activeTab === 'overpass' && (
        <div className="mt-6 space-y-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--text-primary)]">
                Fonte de Dados
              </label>
              <select
                value={liveSource}
                onChange={(e) => setLiveSource(e.target.value as LiveSource)}
                className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:border-[#E05A47] focus:outline-none"
              >
                <option value="openstreetmap">OpenStreetMap (Overpass · ODbL)</option>
                <option value="google_places_api">Google Places API (Oficial)</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--text-primary)]">
                Bairro do Rio de Janeiro
              </label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#E05A47]" />
                <select
                  value={selectedNeighborhood}
                  onChange={(e) => setSelectedNeighborhood(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] focus:border-[#E05A47] focus:outline-none"
                >
                  {RIO_NEIGHBORHOODS_BBOX.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--text-primary)]">
                Tipo de Estabelecimento
              </label>
              <select
                value={amenityType}
                onChange={(e) => setAmenityType(e.target.value as OverpassAmenityType)}
                className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:border-[#E05A47] focus:outline-none"
              >
                <option value="restaurant">Restaurantes</option>
                <option value="bar">Bares &amp; Botecos</option>
                <option value="cafe">Cafeterias</option>
                <option value="all">Todos (Restaurantes, Bares e Cafés)</option>
              </select>
            </div>

            {liveSource === 'google_places_api' ? (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-primary)]">
                  GOOGLE_PLACES_API_KEY *
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#E05A47]" />
                  <input
                    type="password"
                    value={googlePlacesKey}
                    onChange={(e) => setGooglePlacesKey(e.target.value)}
                    placeholder="Chave oficial Google Cloud"
                    className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/60 focus:border-[#E05A47] focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-primary)]">
                  GEMINI_API_KEY (Opcional)
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                  <input
                    type="password"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="Reescreve textos em lote"
                    className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/60 focus:border-[#E05A47] focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="flex items-end">
              <button
                id="btn-fetch-overpass"
                type="button"
                disabled={overpassLoading}
                onClick={handleLiveFetch}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E05A47] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#c84b39] disabled:opacity-60"
              >
                {overpassLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Globe2 className="h-4 w-4" />
                )}
                {overpassLoading ? 'Consultando...' : 'Extrair para Revisão'}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/60 px-4 py-2.5 text-xs text-[var(--text-secondary)]">
            {liveSource === 'openstreetmap' ? (
              <span>
                <strong>Política de qualidade:</strong> registros do OpenStreetMap entram como{' '}
                <strong>PENDENTE</strong> e recebem o <strong>placeholder visual do Rio Gastro Guide</strong> (sem fotos genéricas de terceiros e sem notas inventadas).
              </span>
            ) : (
              <span>
                <strong>Conformidade Google Places API:</strong> consulta oficial sem scraping. Não armazena nem redistribui fotos hospedadas pelo Google e exige revisão/autorização antes da publicação em lote.
              </span>
            )}
          </div>

          {overpassStatus && (
            <div className="flex items-center gap-2 rounded-xl bg-[var(--bg-subtle)] px-4 py-2.5 text-xs font-medium text-[var(--text-primary)]">
              {overpassLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#E05A47]" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              )}
              <span>{overpassStatus}</span>
            </div>
          )}

          {overpassError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{overpassError}</span>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Universal CSV / JSON Importer (Preserved) */}
      {activeTab === 'csv' && (
        <div className="mt-6 space-y-5">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
              isDragging
                ? 'border-[#E05A47] bg-[#E05A47]/10'
                : 'border-[var(--border-hairline)] bg-[var(--bg-surface)]'
            }`}
          >
            <Upload className="h-10 w-10 text-[#E05A47]" />
            <h3 className="font-sans tracking-tight mt-3 text-xl font-bold text-[var(--text-primary)]">
              Arraste seu CSV ou JSON (Importador Universal)
            </h3>
            <p className="mt-1 max-w-lg text-xs text-[var(--text-secondary)]">
              Detectamos automaticamente colunas como <code className="font-mono">title</code>,{' '}
              <code className="font-mono">full_address</code>, <code className="font-mono">main_image</code>,{' '}
              <code className="font-mono">totalScore</code>, <code className="font-mono">reviewsCount</code> e{' '}
              <code className="font-mono">categoryName</code>.
            </p>
            <label className="mt-5 cursor-pointer rounded-xl bg-[#1C1917] px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#E05A47] dark:bg-[#F5F2EB] dark:text-[#0F1115] dark:hover:bg-[#E05A47] dark:hover:text-white">
              Selecionar Arquivo (.csv ou .json)
              <input
                type="file"
                accept=".csv,.json,application/json,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void processFile(file);
                }}
              />
            </label>
            {csvFileName && (
              <p className="mt-3 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Arquivo carregado: {csvFileName} ({csvRawRows.length} registros)
              </p>
            )}
          </div>

          {csvError && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{csvError}</span>
            </div>
          )}

          {columnMapping && csvHeaders.length > 0 && (
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
              <h4 className="text-sm font-bold text-[var(--text-primary)]">
                Mapeador Inteligente de Colunas
              </h4>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Ajuste caso alguma coluna da sua planilha tenha um nome diferente.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {(
                  [
                    ['name', 'Nome *'],
                    ['category', 'Categoria'],
                    ['neighborhood', 'Bairro'],
                    ['address', 'Endereço'],
                    ['cover_image', 'Foto Principal'],
                    ['rating', 'Nota'],
                    ['reviews_count', 'Avaliações'],
                    ['price_range', 'Preço ($-$$$$)'],
                    ['latitude', 'Latitude'],
                    ['longitude', 'Longitude'],
                  ] as Array<[keyof ColumnMapping, string]>
                ).map(([field, label]) => (
                  <div key={field}>
                    <label className="mb-1 block text-[11px] font-semibold text-[var(--text-secondary)]">
                      {label}
                    </label>
                    <select
                      value={columnMapping[field]}
                      onChange={(e) => handleMappingChange(field, e.target.value)}
                      className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
                    >
                      <option value="">— Auto / Ignorar —</option>
                      {csvHeaders.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: 1-Click Seed */}
      {activeTab === 'seed' && (
        <div className="mt-6 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
          <h3 className="font-sans tracking-tight text-2xl font-bold text-[var(--text-primary)]">
            Carga Inicial de Demonstração (1-Click Seed RJ)
          </h3>
          <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
            Popule ou restaure instantaneamente 12 casas icônicas do Rio de Janeiro com coordenadas reais e descrições editoriais.
          </p>
          <button
            type="button"
            onClick={handleResetSeed}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#E05A47] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#c84b39]"
          >
            <Sparkles className="h-4 w-4" />
            Carregar 12 Restaurantes Icônicos do RJ Agora
          </button>
        </div>
      )}

      {/* Tab 4: Claimed Leads */}
      {activeTab === 'claims' && (
        <div className="mt-6 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
          <h3 className="font-sans tracking-tight text-xl font-bold text-[var(--text-primary)]">
            Solicitações de Reivindicação de Perfil
          </h3>
          {claims.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              Nenhuma solicitação registrada ainda. Abra qualquer restaurante no Guia Público e clique em "Reivindicar Perfil Gratuitamente" para testar o fluxo de captura de leads.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-[var(--border-hairline)]">
              {claims.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      <strong className="text-sm text-[var(--text-primary)]">
                        {c.restaurant_name}
                      </strong>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                      {c.owner_name} ({c.role}) · WhatsApp: {c.whatsapp}
                      {c.cnpj ? ` · CNPJ: ${c.cnpj}` : ''}
                    </p>
                  </div>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {new Date(c.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Staging Area Table */}
      {staged.length > 0 && (activeTab === 'overpass' || activeTab === 'csv') && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] shadow-sm">
          {/* Top Bar */}
          <div className="flex flex-col justify-between gap-4 border-b border-[var(--border-hairline)] bg-[var(--bg-subtle)]/60 px-5 py-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={
                  filteredStaged.length > 0 && filteredStaged.every((item) => item.selected)
                }
                onChange={(e) => toggleAllVisible(e.target.checked)}
                className="h-4 w-4 rounded accent-[#E05A47]"
              />
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Staging Area · Revisão, Validação e Licenciamento
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  {authorizedSelectedItems.length} autorizados selecionados para publicação ·{' '}
                  {statusCounts.duplicados} duplicado(s) detectado(s) na base
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setStaged((prev) =>
                    prev.map((row) => {
                      const year = row.data.source_updated_at
                        ? new Date(row.data.source_updated_at).getFullYear()
                        : 2025;
                      return year < 2022 ? { ...row, selected: false } : row;
                    })
                  )
                }
                className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-500/20 dark:text-amber-300"
              >
                Desmarcar antigos (&lt; 2022)
              </button>

              <button
                id="btn-commit-bulk"
                type="button"
                disabled={importing || authorizedSelectedItems.length === 0}
                onClick={handleBulkUpsert}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E05A47] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#c84b39] disabled:opacity-50"
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Publicar {authorizedSelectedItems.length} Autorizados em Lote
              </button>
            </div>
          </div>

          {/* Staging Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-5 py-3 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  ['ALL', `Todos (${staged.length})`],
                  ['CONFIRMADO', `Confirmados (${statusCounts.confirmados})`],
                  ['PENDENTE', `Pendentes (${statusCounts.pendentes})`],
                  ['FECHADO/INVÁLIDO', `Fechados/Inválidos (${statusCounts.fechados})`],
                ] as Array<[StatusFilter, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  className={`rounded-lg px-2.5 py-1.5 font-semibold transition-colors ${
                    statusFilter === key
                      ? 'bg-[#E05A47] text-white'
                      : 'border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {label}
                </button>
              ))}

              <label className="ml-2 inline-flex cursor-pointer items-center gap-1.5 text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={hideDuplicates}
                  onChange={(e) => setHideDuplicates(e.target.checked)}
                  className="rounded accent-[#E05A47]"
                />
                Ocultar duplicados ({statusCounts.duplicados})
              </label>
            </div>

            {hasAuthorizedRatings && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-[var(--text-secondary)]">
                  Filtros (fonte autorizada):
                </span>
                <select
                  value={minRatingFilter}
                  onChange={(e) => setMinRatingFilter(Number(e.target.value))}
                  className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 py-1 text-xs"
                >
                  <option value={0}>Nota: Todas</option>
                  <option value={4.0}>Nota 4.0+</option>
                  <option value={4.5}>Nota 4.5+</option>
                </select>
                <select
                  value={minReviewsFilter}
                  onChange={(e) => setMinReviewsFilter(Number(e.target.value))}
                  className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 py-1 text-xs"
                >
                  <option value={0}>Avaliações: Todas</option>
                  <option value={50}>50+ avaliações</option>
                  <option value={200}>200+ avaliações</option>
                </select>
              </div>
            )}
          </div>

          {/* Staging Rows */}
          <div className="max-h-[580px] overflow-x-auto overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
                <tr>
                  <th className="px-4 py-3">Sel.</th>
                  <th className="px-4 py-3">Mídia / Origem</th>
                  <th className="px-4 py-3">Estabelecimento &amp; Contato</th>
                  <th className="px-4 py-3">Status &amp; Procedência</th>
                  <th className="px-4 py-3">Categoria &amp; Descrição</th>
                  <th className="px-4 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)]">
                {filteredStaged.map((item) => {
                  const status = item.data.validation_status || 'PENDENTE';
                  const isClosed = status === 'FECHADO/INVÁLIDO';
                  const isUnauthorized = item.data.is_redistribution_authorized === false;
                  const sourceLabel = item.data.data_source
                    ? DATA_SOURCE_LABELS[item.data.data_source]
                    : 'Fonte não informada';

                  const updateItem = (patch: Partial<Omit<Restaurant, 'id'>>) => {
                    setStaged((prev) =>
                      prev.map((row) =>
                        row.id === item.id
                          ? { ...row, data: { ...row.data, ...patch } }
                          : row
                      )
                    );
                  };

                  return (
                    <tr key={item.id} className={item.selected ? '' : 'opacity-60'}>
                      <td className="px-4 py-3 align-top">
                        <input
                          type="checkbox"
                          disabled={isClosed || isUnauthorized}
                          checked={item.selected}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setStaged((prev) =>
                              prev.map((row) =>
                                row.id === item.id ? { ...row, selected: checked } : row
                              )
                            );
                          }}
                          className="mt-1 h-4 w-4 rounded accent-[#E05A47] disabled:opacity-40"
                        />
                      </td>

                      <td className="min-w-[150px] px-4 py-3 align-top">
                        <SmartImage
                          src={item.data.cover_image}
                          alt={item.data.name}
                          name={item.data.name}
                          category={item.data.category}
                          imageOrigin={item.data.image_origin}
                          hasRealPhoto={item.data.has_real_photo}
                          compact
                          className="h-14 w-24 rounded-lg object-cover"
                        />
                        <input
                          type="url"
                          value={item.data.cover_image}
                          onChange={(e) => {
                            const url = e.target.value.trim();
                            updateItem({
                              cover_image: url,
                              has_real_photo: Boolean(url),
                              image_origin: url ? 'establishment_authorized' : 'none',
                              image_license: url
                                ? 'URL autorizada informada na revisão'
                                : 'Sem fotografia oficial disponível',
                            });
                          }}
                          placeholder="URL foto autorizada..."
                          className="mt-1.5 w-28 rounded border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-1.5 py-0.5 text-[10px] text-[var(--text-primary)]"
                        />
                        <select
                          value={item.data.image_origin || 'none'}
                          onChange={(e) =>
                            updateItem({ image_origin: e.target.value as ImageOrigin })
                          }
                          className="mt-1 w-28 rounded border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-1 py-0.5 text-[10px] text-[var(--text-secondary)]"
                        >
                          <option value="none">Sem foto real</option>
                          <option value="establishment_authorized">Autorizada (local)</option>
                          <option value="owner_authorized">Enviada pelo dono</option>
                          <option value="commercial_licensed">Licença comercial</option>
                        </select>
                      </td>

                      <td className="min-w-[230px] px-4 py-3 align-top">
                        <input
                          type="text"
                          value={item.data.name}
                          onChange={(e) => updateItem({ name: e.target.value })}
                          className="w-full rounded-lg border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--border-hairline)] focus:border-[#E05A47] focus:outline-none"
                        />
                        <input
                          type="text"
                          value={item.data.address}
                          onChange={(e) => updateItem({ address: e.target.value })}
                          className="mt-1 w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)] hover:border-[var(--border-hairline)] focus:border-[#E05A47] focus:outline-none"
                        />
                        <div className="mt-1 flex gap-1.5 px-1">
                          <input
                            type="text"
                            value={item.data.phone || ''}
                            onChange={(e) => updateItem({ phone: e.target.value })}
                            placeholder="Telefone"
                            className="w-28 rounded border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-1.5 py-0.5 text-[10px]"
                          />
                          <input
                            type="text"
                            value={item.data.website || ''}
                            onChange={(e) => updateItem({ website: e.target.value })}
                            placeholder="Site oficial"
                            className="w-28 rounded border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-1.5 py-0.5 text-[10px]"
                          />
                        </div>
                      </td>

                      <td className="min-w-[200px] px-4 py-3 align-top space-y-1.5">
                        <select
                          value={status}
                          onChange={(e) => {
                            const nextStatus = e.target.value as ValidationStatus;
                            setStaged((prev) =>
                              prev.map((row) =>
                                row.id === item.id
                                  ? {
                                      ...row,
                                      selected:
                                        nextStatus === 'FECHADO/INVÁLIDO' ? false : row.selected,
                                      data: { ...row.data, validation_status: nextStatus },
                                    }
                                  : row
                              )
                            );
                          }}
                          className={`w-full rounded-lg border px-2 py-1 text-[11px] font-bold ${STATUS_BADGE_STYLES[status]}`}
                        >
                          <option value="CONFIRMADO">CONFIRMADO</option>
                          <option value="PENDENTE">PENDENTE</option>
                          <option value="FECHADO/INVÁLIDO">FECHADO/INVÁLIDO</option>
                        </select>

                        <div className="text-[10px] leading-snug text-[var(--text-secondary)]">
                          <div>
                            <strong>Fonte:</strong> {sourceLabel}
                          </div>
                          <div>
                            <strong>Confiabilidade:</strong> {item.data.confidence_level || 'MÉDIA'}
                          </div>
                          {item.data.last_verified_at && (
                            <div>
                              <strong>Verificado:</strong>{' '}
                              {new Date(item.data.last_verified_at).toLocaleDateString('pt-BR')}
                            </div>
                          )}
                          {item.data.source_updated_at && (
                            <div>
                              <strong>Atualizado na fonte:</strong>{' '}
                              {new Date(item.data.source_updated_at).getFullYear()}
                            </div>
                          )}
                        </div>

                        {item.isDuplicate && (
                          <span className="inline-flex items-center gap-1 rounded bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-purple-600 dark:text-purple-300">
                            <AlertTriangle className="h-3 w-3" />
                            Duplicado na base
                          </span>
                        )}

                        {isUnauthorized && (
                          <div className="flex items-center gap-1.5">
                            <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-300">
                              Uso não autorizado
                            </span>
                            <button
                              type="button"
                              onClick={() => updateItem({ is_redistribution_authorized: true })}
                              className="text-[10px] font-semibold text-[#E05A47] underline"
                            >
                              Autorizar
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="min-w-[260px] px-4 py-3 align-top">
                        <select
                          value={item.data.category}
                          onChange={(e) =>
                            updateItem({ category: e.target.value as RestaurantCategory })
                          }
                          className="mb-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 py-1 text-xs text-[var(--text-primary)]"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <textarea
                          rows={2}
                          value={item.data.description}
                          onChange={(e) => updateItem({ description: e.target.value })}
                          className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-2 text-xs leading-relaxed text-[var(--text-secondary)] focus:border-[#E05A47] focus:outline-none"
                        />
                      </td>

                      <td className="px-4 py-3 text-right align-top">
                        <button
                          type="button"
                          title="Excluir da pré-visualização"
                          onClick={() =>
                            setStaged((prev) => prev.filter((row) => row.id !== item.id))
                          }
                          className="rounded-lg p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-red-500/15 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
