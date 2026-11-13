import {
  AlertCircle,
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
import { useState, type DragEvent } from 'react';
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
import type { ClaimRequest, Restaurant, RestaurantCategory } from '../types/restaurant';
import { SmartImage } from './SmartImage';

interface AdminPanelProps {
  restaurants: Restaurant[];
  claims: ClaimRequest[];
  onDatabaseUpdated: () => Promise<void>;
}

type AdminTab = 'overpass' | 'csv' | 'seed' | 'claims';

interface StagedItem {
  selected: boolean;
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

export function AdminPanel({ restaurants, claims, onDatabaseUpdated }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overpass');
  const storageMode = getStorageMode();

  // Overpass State
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>('Botafogo');
  const [amenityType, setAmenityType] = useState<OverpassAmenityType>('restaurant');
  const [geminiKey, setGeminiKey] = useState<string>('');
  const [overpassLoading, setOverpassLoading] = useState(false);
  const [overpassStatus, setOverpassStatus] = useState<string>('');
  const [overpassError, setOverpassError] = useState<string>('');

  // CSV / JSON State
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
    setTimeout(() => setToastMessage(''), 5000);
  };

  // --- Overpass Handlers ---
  const handleOverpassFetch = async () => {
    setOverpassLoading(true);
    setOverpassError('');
    setOverpassStatus('Conectando ao OpenStreetMap...');
    setStaged([]);

    try {
      let items = await fetchFromOverpass(selectedNeighborhood, amenityType, (step) => {
        setOverpassStatus(step);
      });

      if (items.length === 0) {
        setOverpassError(
          `Nenhum estabelecimento encontrado em ${selectedNeighborhood} para este filtro. Tente "Todos" ou outro bairro.`
        );
        setOverpassStatus('');
        return;
      }

      if (geminiKey.trim()) {
        items = await rewriteDescriptionsWithGemini(items, geminiKey, (step) => {
          setOverpassStatus(step);
        });
      }

      setOverpassStatus(`Pronto para importar! ${items.length} estabelecimentos reais encontrados.`);
      setStaged(items.map((data) => ({ selected: true, data })));
    } catch (err) {
      setOverpassError(
        err instanceof Error ? err.message : 'Erro inesperado ao consultar a Overpass API.'
      );
      setOverpassStatus('');
    } finally {
      setOverpassLoading(false);
    }
  };

  // --- CSV / JSON Handlers ---
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

      const mapped = mapRowsToRestaurants(rows, detected);
      setStaged(mapped.map((data) => ({ selected: true, data })));
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
    setStaged(mapped.map((data) => ({ selected: true, data })));
  };

  // --- Staging & Bulk Upsert ---
  const selectedCount = staged.filter((s) => s.selected).length;

  const toggleAllStaged = (checked: boolean) => {
    setStaged((prev) => prev.map((item) => ({ ...item, selected: checked })));
  };

  const handleBulkUpsert = async () => {
    const toImport = staged.filter((s) => s.selected).map((s) => s.data);
    if (toImport.length === 0) return;

    setImporting(true);
    try {
      const res = await upsertRestaurants(toImport);
      await onDatabaseUpdated();
      setStaged([]);
      showToast(
        `Importação concluída: ${res.inserted} novos adicionados, ${res.updated} atualizados. Total no guia: ${res.total}.`
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
          <h1 className="font-editorial mt-3 text-3xl font-bold text-[var(--text-primary)]">
            Motor de Importação em Lote (Cold Start)
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Popule o Rio Gastro Guide em segundos com dados reais gratuitos do OpenStreetMap ou planilhas CSV/JSON.
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
          1. Extrator Ao Vivo (OpenStreetMap)
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
      </div>

      {/* Tab 1: Overpass API Live Extractor */}
      {activeTab === 'overpass' && (
        <div className="mt-6 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6">
          <div className="grid gap-4 md:grid-cols-4">
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
                <option value="bar">Bares & Botecos</option>
                <option value="cafe">Cafeterias</option>
                <option value="all">Todos (Restaurantes, Bares e Cafés)</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--text-primary)]">
                GEMINI_API_KEY (Opcional · Reescreve textos)
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="Cole sua chave gratuita do AI Studio"
                  className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/60 focus:border-[#E05A47] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-end">
              <button
                id="btn-fetch-overpass"
                type="button"
                disabled={overpassLoading}
                onClick={handleOverpassFetch}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E05A47] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#c84b39] disabled:opacity-60"
              >
                {overpassLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Globe2 className="h-4 w-4" />
                )}
                {overpassLoading ? 'Extraindo...' : 'Buscar Estabelecimentos Reais Agora'}
              </button>
            </div>
          </div>

          {overpassStatus && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--bg-subtle)] px-4 py-2.5 text-xs font-medium text-[var(--text-primary)]">
              {overpassLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#E05A47]" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              )}
              <span>{overpassStatus}</span>
            </div>
          )}

          {overpassError && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-medium text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{overpassError}</span>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Universal CSV / JSON Importer */}
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
            <h3 className="font-editorial mt-3 text-xl font-bold text-[var(--text-primary)]">
              Arraste seu CSV ou JSON do Google Maps / Apify / Outscraper
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
          <h3 className="font-editorial text-2xl font-bold text-[var(--text-primary)]">
            Carga Inicial de Demonstração (1-Click Seed RJ)
          </h3>
          <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
            Popule ou restaure instantaneamente 12 casas icônicas do Rio de Janeiro (Aprazível, Satyricon, Lasai, CT Boucherie, Churrascaria Palace, Bar Urca, Oteque, Sushi Leblon, Bráz Pizzaria, Confeitaria Colombo, Gero Ipanema e Bar do Mineiro) com coordenadas reais e fotos curadas.
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
          <h3 className="font-editorial text-xl font-bold text-[var(--text-primary)]">
            Solicitações de Reivindicação de Perfil
          </h3>
          {claims.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              Nenhuma solicitação registrada ainda. Abra qualquer restaurante no Guia Público e clique em "Reivindicar Perfil Gratuitamente" para testar o fluxo de captura de leads.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-[var(--border-hairline)]">
              {claims.map((c) => (
                <div key={c.id} className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center">
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
          <div className="flex flex-col justify-between gap-3 border-b border-[var(--border-hairline)] bg-[var(--bg-subtle)]/60 px-5 py-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedCount === staged.length}
                onChange={(e) => toggleAllStaged(e.target.checked)}
                className="h-4 w-4 rounded accent-[#E05A47]"
              />
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Área de Pré-Visualização (Staging Area)
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  {selectedCount} de {staged.length} estabelecimentos selecionados para envio em lote
                </p>
              </div>
            </div>

            <button
              id="btn-commit-bulk"
              type="button"
              disabled={importing || selectedCount === 0}
              onClick={handleBulkUpsert}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E05A47] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#c84b39] disabled:opacity-50"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Subir {selectedCount} Estabelecimentos em Lote para o Guia
            </button>
          </div>

          <div className="max-h-[540px] overflow-x-auto overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
                <tr>
                  <th className="px-4 py-3">Sel.</th>
                  <th className="px-4 py-3">Foto</th>
                  <th className="px-4 py-3">Estabelecimento & Endereço</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Descrição Editorial</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)]">
                {staged.map((item, idx) => (
                  <tr
                    key={`${item.data.external_id}-${idx}`}
                    className={item.selected ? '' : 'opacity-50'}
                  >
                    <td className="px-4 py-3 align-top">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setStaged((prev) =>
                            prev.map((row, i) => (i === idx ? { ...row, selected: checked } : row))
                          );
                        }}
                        className="mt-1 h-4 w-4 rounded accent-[#E05A47]"
                      />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <SmartImage
                        src={item.data.cover_image}
                        alt={item.data.name}
                        category={item.data.category}
                        fallbackIndex={idx}
                        className="h-14 w-20 rounded-lg object-cover"
                      />
                    </td>
                    <td className="min-w-[220px] px-4 py-3 align-top">
                      <input
                        type="text"
                        value={item.data.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setStaged((prev) =>
                            prev.map((row, i) =>
                              i === idx ? { ...row, data: { ...row.data, name: val } } : row
                            )
                          );
                        }}
                        className="w-full rounded-lg border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-semibold text-[var(--text-primary)] hover:border-[var(--border-hairline)] focus:border-[#E05A47] focus:outline-none"
                      />
                      <p className="mt-1 px-1.5 text-[11px] text-[var(--text-secondary)]">
                        {item.data.neighborhood} · {item.data.address}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <select
                        value={item.data.category}
                        onChange={(e) => {
                          const cat = e.target.value as RestaurantCategory;
                          setStaged((prev) =>
                            prev.map((row, i) =>
                              i === idx ? { ...row, data: { ...row.data, category: cat } } : row
                            )
                          );
                        }}
                        className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 py-1.5 text-xs text-[var(--text-primary)]"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="min-w-[280px] px-4 py-3 align-top">
                      <textarea
                        rows={2}
                        value={item.data.description}
                        onChange={(e) => {
                          const desc = e.target.value;
                          setStaged((prev) =>
                            prev.map((row, i) =>
                              i === idx ? { ...row, data: { ...row.data, description: desc } } : row
                            )
                          );
                        }}
                        className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-2 text-xs leading-relaxed text-[var(--text-secondary)] focus:border-[#E05A47] focus:outline-none"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
