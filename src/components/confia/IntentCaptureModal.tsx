import {
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Link2,
  Loader2,
  Lock,
  Sparkles,
  StickyNote,
  Upload,
  X,
} from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { analyzeIntentScreenshot, analyzeIntentUrl } from '../../services/intentAnalyzer';
import {
  addIntentVaultItem,
  detectSourceTypeFromUrl,
  sanitizeHttpUrl,
  validateAndPrepareScreenshot,
} from '../../services/intentVaultStore';
import type { MacroCategory, MomentMode } from '../../types/experience';
import type {
  IntentProcessingStatus,
  IntentSourceType,
  IntentVaultItem,
} from '../../types/intention';
import type { Restaurant } from '../../types/restaurant';

interface IntentCaptureModalProps {
  catalog: Restaurant[];
  onClose: () => void;
  onSaved: (nextItems: IntentVaultItem[]) => void;
  initialVenue?: Restaurant | null;
}

type CaptureTab = 'link' | 'screenshot' | 'manual';

const MACRO_OPTIONS: MacroCategory[] = [
  'Gastronomia',
  'Eventos & Shows',
  'Cultura & Museus',
  'Atrações Infantis',
  'Turismo & Praias',
  'Vida Noturna',
];

const NEIGHBORHOODS = [
  'Botafogo',
  'Ipanema',
  'Leblon',
  'Copacabana',
  'Santa Teresa',
  'Jardim Botânico',
  'Urca',
  'Centro',
  'Lapa',
  'Flamengo',
  'Barra da Tijuca',
  'Tijuca',
];

export function IntentCaptureModal({
  catalog,
  onClose,
  onSaved,
  initialVenue,
}: IntentCaptureModalProps) {
  const [tab, setTab] = useState<CaptureTab>(initialVenue ? 'manual' : 'link');
  const [urlInput, setUrlInput] = useState('');
  const [imagePreview, setImagePreview] = useState<string>('');
  const [title, setTitle] = useState(initialVenue?.name || '');
  const [neighborhood, setNeighborhood] = useState(initialVenue?.neighborhood || '');
  const [categoryTag, setCategoryTag] = useState<MacroCategory>(
    initialVenue?.macro_category || 'Gastronomia'
  );
  const [momentTag, setMomentTag] = useState<MomentMode>('all');
  const [linkedVenueId, setLinkedVenueId] = useState(initialVenue?.id || '');
  const [notes, setNotes] = useState('');

  const [processingStatus, setProcessingStatus] = useState<IntentProcessingStatus>(
    initialVenue ? 'COMPLETED' : 'NEEDS_CONFIRMATION'
  );
  const [processingMsg, setProcessingMsg] = useState<string>(
    initialVenue
      ? 'Local selecionado diretamente do catálogo BoraRio.'
      : ''
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyzeUrl = async () => {
    const safe = sanitizeHttpUrl(urlInput);
    if (!safe) {
      setProcessingStatus('ERROR');
      setProcessingMsg('URL inválida. Informe um link completo iniciado com https:// ou http://.');
      return;
    }

    setIsAnalyzing(true);
    setProcessingStatus('PROCESSING');
    setProcessingMsg('Validando link e verificando correspondências...');

    const res = await analyzeIntentUrl(safe, catalog);
    setProcessingStatus(res.processing_status);
    setProcessingMsg(res.processing_message);

    if (res.suggested_title && !title) setTitle(res.suggested_title);
    if (res.suggested_neighborhood && !neighborhood) setNeighborhood(res.suggested_neighborhood);
    if (res.suggested_category) setCategoryTag(res.suggested_category);
    if (res.suggested_venue_id) setLinkedVenueId(res.suggested_venue_id);
    if (res.suggested_notes && !notes) setNotes(res.suggested_notes);

    setIsAnalyzing(false);
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setProcessingStatus('PROCESSING');
    setProcessingMsg('Validando imagem e removendo metadados EXIF...');

    const prep = await validateAndPrepareScreenshot(file);
    if (!prep.ok) {
      setProcessingStatus('ERROR');
      setProcessingMsg(prep.error);
      setIsAnalyzing(false);
      return;
    }

    setImagePreview(prep.dataUrl);
    const analysis = await analyzeIntentScreenshot(prep.dataUrl, 'image/jpeg');
    setProcessingStatus(analysis.processing_status);
    setProcessingMsg(analysis.processing_message);

    if (analysis.suggested_title) setTitle(analysis.suggested_title);
    if (analysis.suggested_neighborhood) setNeighborhood(analysis.suggested_neighborhood);
    if (analysis.suggested_category) setCategoryTag(analysis.suggested_category);
    if (analysis.suggested_notes) setNotes(analysis.suggested_notes);

    setIsAnalyzing(false);
  };

  const handleVenuePick = (venueId: string) => {
    setLinkedVenueId(venueId);
    const found = catalog.find((v) => v.id === venueId);
    if (found) {
      if (!title.trim()) setTitle(found.name);
      setNeighborhood(found.neighborhood);
      setCategoryTag(found.macro_category || 'Gastronomia');
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const safeUrl = tab === 'link' ? sanitizeHttpUrl(urlInput) : null;
    if (tab === 'link' && urlInput.trim() && !safeUrl) {
      setProcessingStatus('ERROR');
      setProcessingMsg('Corrija a URL para um endereço http:// ou https:// válido.');
      return;
    }
    if (tab === 'screenshot' && !imagePreview) {
      setProcessingStatus('ERROR');
      setProcessingMsg('Selecione uma imagem PNG, JPEG ou WebP (até 5 MB).');
      return;
    }

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setProcessingStatus('ERROR');
      setProcessingMsg('Informe um título claro para identificar esse desejo no seu Cofre.');
      return;
    }

    const sourceType: IntentSourceType =
      initialVenue
        ? 'catalog_bookmark'
        : tab === 'screenshot'
          ? 'screenshot'
          : tab === 'link' && safeUrl
            ? detectSourceTypeFromUrl(safeUrl)
            : 'manual_note';

    const linkedVenue = catalog.find((v) => v.id === linkedVenueId);

    const next = addIntentVaultItem({
      title: cleanTitle,
      source_type: sourceType,
      source_url: safeUrl ?? undefined,
      image_preview_data_url: tab === 'screenshot' ? imagePreview : undefined,
      notes: notes.trim() || undefined,
      category_tag: categoryTag,
      neighborhood_tag: neighborhood || undefined,
      moment_tag: momentTag,
      linked_venue_id: linkedVenue?.id,
      linked_venue_name: linkedVenue?.name,
      status: 'SAVED',
      processing_status:
        processingStatus === 'PROCESSING' || processingStatus === 'ERROR'
          ? 'COMPLETED'
          : processingStatus,
      processing_message: processingMsg || undefined,
    });

    onSaved(next);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative my-auto max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar captura"
          className="absolute right-4 top-4 rounded-full p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#FF6B35]">
          <Lock className="h-3.5 w-3.5" />
          Cofre de Intenções · Privado
        </div>
        <h3 className="font-sans mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          Adicionar link ou print ao Cofre
        </h3>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Guarde inspirações de rolês, vídeos e restaurantes para transformar em experiências reais. Só você tem acesso.
        </p>

        {/* Source Tabs */}
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-1">
          {[
            { id: 'link' as const, label: 'Colar Link', icon: Link2 },
            { id: 'screenshot' as const, label: 'Enviar Print', icon: ImageIcon },
            { id: 'manual' as const, label: 'Nota Rápida', icon: StickyNote },
          ].map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setProcessingMsg('');
                }}
                className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
                  active
                    ? 'bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] text-white shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Link Input */}
          {tab === 'link' && (
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[var(--text-primary)]">
                URL (Instagram, TikTok, YouTube, matéria ou site)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://www.instagram.com/reel/..."
                  className="min-w-0 flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-xs text-[var(--text-primary)] focus:border-[#FF6B35] focus:outline-none"
                />
                <button
                  type="button"
                  disabled={isAnalyzing || !urlInput.trim()}
                  onClick={() => void handleAnalyzeUrl()}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#123B56] px-3.5 py-2.5 text-xs font-bold text-white hover:bg-[#102F46] disabled:opacity-50"
                >
                  {isAnalyzing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-[#F7931E]" />
                  )}
                  Analisar
                </button>
              </div>
            </div>
          )}

          {/* Screenshot Input */}
          {tab === 'screenshot' && (
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[var(--text-primary)]">
                Print de tela ou imagem (PNG, JPEG ou WebP · máx. 5 MB)
              </label>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-5 text-center transition hover:border-[#FF6B35]/60">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Prévia do print higienizado"
                    className="max-h-40 rounded-xl object-contain"
                  />
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-[#FF6B35]" />
                    <span className="mt-2 text-xs font-semibold text-[var(--text-primary)]">
                      Clique para selecionar um print
                    </span>
                    <span className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                      Metadados de localização (EXIF) são removidos antes de salvar
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => void handleFileChange(e)}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Honest Processing / Status Feedback */}
          {processingMsg && (
            <div
              className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-xs ${
                processingStatus === 'ERROR'
                  ? 'border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300'
                  : processingStatus === 'COMPLETED'
                    ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300'
              }`}
            >
              {processingStatus === 'PROCESSING' ? (
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
              ) : processingStatus === 'COMPLETED' ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{processingMsg}</span>
            </div>
          )}

          {/* Confirmation / Manual Fields */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-bold text-[var(--text-primary)]">
                O que você quer viver / visitar? *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Jantar no Lasai ou Trilha da Urca ao pôr do sol"
                className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-xs font-medium text-[var(--text-primary)] focus:border-[#FF6B35] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[var(--text-primary)]">
                Bairro no Rio
              </label>
              <select
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2.5 text-xs text-[var(--text-primary)]"
              >
                <option value="">A definir</option>
                {NEIGHBORHOODS.map((nb) => (
                  <option key={nb} value={nb}>
                    {nb}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[var(--text-primary)]">
                Categoria
              </label>
              <select
                value={categoryTag}
                onChange={(e) => setCategoryTag(e.target.value as MacroCategory)}
                className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2.5 text-xs text-[var(--text-primary)]"
              >
                {MACRO_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-bold text-[var(--text-primary)]">
                Vincular a local do catálogo BoraRio (opcional)
              </label>
              <select
                value={linkedVenueId}
                onChange={(e) => handleVenuePick(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2.5 text-xs text-[var(--text-primary)]"
              >
                <option value="">Sem vínculo específico por enquanto</option>
                {catalog.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} — {v.neighborhood} ({v.category})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[var(--text-primary)]">
                Momento ideal
              </label>
              <select
                value={momentTag}
                onChange={(e) => setMomentTag(e.target.value as MomentMode)}
                className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2.5 text-xs text-[var(--text-primary)]"
              >
                <option value="all">Qualquer momento</option>
                <option value="couple">Casal</option>
                <option value="family">Família &amp; Kids</option>
                <option value="friends">Galera</option>
                <option value="rainy">Dia de Chuva</option>
                <option value="budget">Econômico</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[var(--text-primary)]">
                Lembrete pessoal
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Pedir mesa na varanda"
                className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2.5 text-xs text-[var(--text-primary)]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--border-hairline)] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[var(--border-hairline)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isAnalyzing}
              className="rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-5 py-2 text-xs font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
            >
              Guardar no Cofre
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
