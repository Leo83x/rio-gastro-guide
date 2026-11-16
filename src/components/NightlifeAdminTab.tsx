import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  Database,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Globe2,
  KeyRound,
  Link2,
  ListPlus,
  Loader2,
  MapPin,
  MoonStar,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  downloadNightlifeCsvTemplate,
  mapRowsToNightlifeDrafts,
  parseNightlifeFile,
  type NightlifeColumnMapping,
  type NightlifeRawRow,
  detectNightlifeColumnMapping,
} from '../services/nightlife/nightlifeCsvImporter';
import {
  buildStartEndIsoRio,
  checkNightlifeCompleteness,
  getRioTodayIso,
} from '../services/nightlife/nightlifeDedup';
import {
  approveAndPublishNightlifeEvent,
  cancelNightlifeEvent,
  clearAllNightlifeEvents,
  deleteNightlifeEvent,
  extractNightlifeFromUrl,
  extractNightlifeFromUrls,
  getIngestionRuns,
  getNightlifeCloudStatus,
  getSessionNightlifeCredentials,
  ingestNightlifeBatch,
  rejectNightlifeEvent,
  runManualRadarSweepAndLog,
  saveSessionNightlifeCredentials,
  scheduleNightlifeEvent,
  setNightlifeAvailability,
  syncIngresseNightlifeEvents,
  syncRioturNightlifeEvents,
  syncSymplaNightlifeEvents,
  toggleFeaturedNightlifeEvent,
  updateNightlifeEvent,
} from '../services/nightlife/nightlifeStore';
import {
  NIGHTLIFE_SOURCE_LABELS,
  NIGHTLIFE_SUBAREA_META,
  type NightlifeAvailabilityStatus,
  type NightlifeCurationStatus,
  type NightlifeEvent,
  type NightlifeEventDraft,
  type NightlifeIngestionRun,
  type NightlifeSubArea,
} from '../types/nightlife';
import type { Restaurant } from '../types/restaurant';
import { NightlifeCoverArt } from './NightlifeCoverArt';

interface NightlifeAdminTabProps {
  permanentVenues: Restaurant[];
  nightlifeEvents: NightlifeEvent[];
  onNightlifeUpdated: () => Promise<void>;
  onShowToast: (msg: string) => void;
  onShowError: (msg: string) => void;
}

type CaptureMode = 'url' | 'api' | 'batch' | 'manual';
type QueueFilter = 'ALL' | NightlifeCurationStatus;

const CURATION_STATUS_BADGE: Record<NightlifeCurationStatus, { label: string; cls: string }> = {
  PENDENTE: {
    label: 'Pendente',
    cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35',
  },
  PROGRAMADO: {
    label: 'Programado',
    cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/35',
  },
  PUBLICADO: {
    label: 'Publicado',
    cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35',
  },
  REJEITADO: {
    label: 'Rejeitado',
    cls: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-300 border-zinc-500/35',
  },
  CANCELADO: {
    label: 'Cancelado',
    cls: 'bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/35',
  },
  EXPIRADO: {
    label: 'Expirado',
    cls: 'bg-zinc-500/15 text-zinc-500 dark:text-zinc-400 border-zinc-500/30',
  },
};

export function NightlifeAdminTab({
  permanentVenues,
  nightlifeEvents,
  onNightlifeUpdated,
  onShowToast,
  onShowError,
}: NightlifeAdminTabProps) {
  const [captureMode, setCaptureMode] = useState<CaptureMode>('url');
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('ALL');
  const [runs, setRuns] = useState<NightlifeIngestionRun[]>([]);
  const [busyAction, setBusyAction] = useState<string>('');

  // Mode 1: URL Extraction (Single vs Batch)
  const [urlSubTab, setUrlSubTab] = useState<'single' | 'batch'>('single');
  const [urlInput, setUrlInput] = useState('');
  const [batchUrlsInput, setBatchUrlsInput] = useState('');
  const [batchUrlsResults, setBatchUrlsResults] = useState<{
    total: number;
    success: number;
    errors: Array<{ url: string; error: string }>;
  } | null>(null);
  const [urlExtractedDraft, setUrlExtractedDraft] = useState<NightlifeEventDraft | null>(null);
  const [urlWarning, setUrlWarning] = useState('');

  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [rioturMonth, setRioturMonth] = useState(() => new Date().getMonth() + 1);
  const [rioturYear, setRioturYear] = useState(() => new Date().getFullYear());
  const [rioturMonthsCount, setRioturMonthsCount] = useState(2);

  // Cloud status (Supabase Server Persistence)
  const [cloudStatus, setCloudStatus] = useState<{
    configured: boolean;
    storage: 'supabase' | 'local_only' | 'error';
    message: string;
  } | null>(null);

  const initialCreds = useMemo(() => getSessionNightlifeCredentials(), []);
  const [symplaToken, setSymplaToken] = useState(initialCreds.symplaToken);
  const [ingresseKey, setIngresseKey] = useState(initialCreds.ingresseKey);
  const [showTokens, setShowTokens] = useState(false);
  const [apiSyncNote, setApiSyncNote] = useState('');

  // Mode 3: Batch CSV / JSON
  const [batchFileName, setBatchFileName] = useState('');
  const [batchHeaders, setBatchHeaders] = useState<string[]>([]);
  const [batchRows, setBatchRows] = useState<NightlifeRawRow[]>([]);
  const [batchMapping, setBatchMapping] = useState<NightlifeColumnMapping | null>(null);
  const [batchDrafts, setBatchDrafts] = useState<NightlifeEventDraft[]>([]);

  // Mode 4: Manual Quick Create
  const [todayIso] = useState(() => getRioTodayIso());
  const [manTitle, setManTitle] = useState('');
  const [manSubArea, setManSubArea] = useState<NightlifeSubArea>('SAMBA_PAGODE');
  const [manVenueId, setManVenueId] = useState('');
  const [manVenueName, setManVenueName] = useState('');
  const [manNeighborhood, setManNeighborhood] = useState('Lapa');
  const [manAddress, setManAddress] = useState('');
  const [manDate, setManDate] = useState(todayIso);
  const [manStartTime, setManStartTime] = useState('22:00');
  const [manEndTime, setManEndTime] = useState('04:00');
  const [manIsFree, setManIsFree] = useState(false);
  const [manPrice, setManPrice] = useState('');
  const [manTicketUrl, setManTicketUrl] = useState('');
  const [manAvailability, setManAvailability] =
    useState<NightlifeAvailabilityStatus>('DISPONIVEL');
  const [manGenres, setManGenres] = useState('Samba, Pagode');
  const [manLineup, setManLineup] = useState('');
  const [manSummary, setManSummary] = useState('');
  const [manCoverUrl, setManCoverUrl] = useState('');

  // Queue Inline Edit & Scheduling
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<NightlifeEvent>>({});
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleDatetime, setScheduleDatetime] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const refreshRuns = async () => {
    const list = await getIngestionRuns();
    setRuns(list);
  };

  useEffect(() => {
    let active = true;
    void getIngestionRuns().then((list) => {
      if (active) setRuns(list);
    });
    void getNightlifeCloudStatus().then((st) => {
      if (active) setCloudStatus(st);
    });
    return () => {
      active = false;
    };
  }, [nightlifeEvents.length]);

  const counts = useMemo(() => {
    const map: Record<NightlifeCurationStatus, number> = {
      PENDENTE: 0,
      PROGRAMADO: 0,
      PUBLICADO: 0,
      REJEITADO: 0,
      CANCELADO: 0,
      EXPIRADO: 0,
    };
    for (const ev of nightlifeEvents) {
      map[ev.curation_status] = (map[ev.curation_status] || 0) + 1;
    }
    return map;
  }, [nightlifeEvents]);

  const filteredQueue = useMemo(() => {
    if (queueFilter === 'ALL') return nightlifeEvents;
    return nightlifeEvents.filter((ev) => ev.curation_status === queueFilter);
  }, [nightlifeEvents, queueFilter]);

  // --- Mode 1 Handlers ---
  const handleExtractUrl = async (e: FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setBusyAction('url-extract');
    setUrlWarning('');
    setUrlExtractedDraft(null);
    try {
      const res = await extractNightlifeFromUrl(urlInput);
      if (!res.ok || !res.draft) {
        setUrlWarning(res.error || 'Não foi possível extrair os metadados da URL.');
        if (res.blockedByProtection) {
          onShowError(
            res.error ||
              'Proteção anti-bot/CAPTCHA detectada. Preencha manualmente na aba Cadastro Manual.'
          );
        }
        return;
      }
      setUrlExtractedDraft(res.draft);
      onShowToast(`Metadados extraídos de ${NIGHTLIFE_SOURCE_LABELS[res.draft.source_platform]}!`);
    } finally {
      setBusyAction('');
    }
  };

  const handleQueueUrlDraft = async () => {
    if (!urlExtractedDraft) return;
    setBusyAction('url-queue');
    try {
      const res = await ingestNightlifeBatch({
        drafts: [urlExtractedDraft],
        sourceCode: 'url_extractor',
        sourcePlatform: urlExtractedDraft.source_platform,
        triggerType: 'MANUAL',
        permanentVenues,
      });
      await onNightlifeUpdated();
      await refreshRuns();
      setUrlExtractedDraft(null);
      setUrlInput('');
      setQueueFilter('PENDENTE');
      onShowToast(
        res.dedupedUpdated > 0
          ? 'Evento já existia na agenda — link adicional mesclado sem duplicidade!'
          : 'Evento enviado para a fila PENDENTE de curadoria!'
      );
    } finally {
      setBusyAction('');
    }
  };

  const handleBatchUrlsExtract = async (e: FormEvent) => {
    e.preventDefault();
    const lines = batchUrlsInput
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('http'));

    if (lines.length === 0) {
      onShowError('Cole pelo menos um link HTTPS válido de evento (um por linha).');
      return;
    }

    setBusyAction('batch-urls-extract');
    setBatchUrlsResults(null);
    try {
      const res = await extractNightlifeFromUrls(lines);
      if (!res.ok) {
        onShowError(res.error || 'Falha ao processar lote de links.');
        return;
      }

      let insertedPending = 0;
      let deduped = 0;
      if (res.drafts.length > 0) {
        const batch = await ingestNightlifeBatch({
          drafts: res.drafts,
          sourceCode: 'batch_urls_extractor',
          sourcePlatform: res.drafts[0]?.source_platform || 'MANUAL_ADMIN',
          triggerType: 'MANUAL',
          permanentVenues,
        });
        insertedPending = batch.insertedPending;
        deduped = batch.dedupedUpdated;
        await onNightlifeUpdated();
        await refreshRuns();
        setQueueFilter('PENDENTE');
      }

      setBatchUrlsResults({
        total: res.totalRequested,
        success: res.successCount,
        errors: res.errors,
      });

      if (res.successCount > 0) {
        onShowToast(
          `Lote processado: ${res.successCount} evento(s) extraído(s), ${insertedPending} adicionado(s) em PENDENTE e ${deduped} deduplicado(s).`
        );
      } else {
        onShowError('Nenhum evento pôde ser extraído dos links informados. Verifique os erros abaixo.');
      }
    } finally {
      setBusyAction('');
    }
  };

  // --- Mode 2 Handlers ---
  const handleRioturSync = async () => {
    setBusyAction('riotur-sync');
    setApiSyncNote('');
    try {
      const res = await syncRioturNightlifeEvents({
        mes: rioturMonth,
        ano: rioturYear,
        syncMonths: rioturMonthsCount,
      });

      if (!res.ok) {
        onShowError(res.error || 'Falha ao sincronizar agenda da Riotur.');
        return;
      }

      if (res.drafts.length === 0) {
        onShowToast('Nenhum evento retornado pela Riotur para o período selecionado.');
        return;
      }

      const batch = await ingestNightlifeBatch({
        drafts: res.drafts,
        sourceCode: 'riotur_calendar',
        sourcePlatform: 'RIOTUR',
        triggerType: 'MANUAL',
        permanentVenues,
      });

      await onNightlifeUpdated();
      await refreshRuns();
      setQueueFilter('PENDENTE');
      onShowToast(
        `Riotur oficial sincronizada: ${res.rawCount} evento(s) recebido(s), ${batch.insertedPending} novo(s) em PENDENTE e ${batch.dedupedUpdated} deduplicado(s)!`
      );
    } finally {
      setBusyAction('');
    }
  };

  const handleWeekendRadar = async () => {
    setBusyAction('weekend-radar');
    setApiSyncNote('');
    try {
      const now = new Date();
      const res = await syncRioturNightlifeEvents({
        mes: now.getMonth() + 1,
        ano: now.getFullYear(),
        syncMonths: 1,
        weekendOnly: true,
      });

      if (!res.ok) {
        onShowError(res.error || 'Falha ao capturar agenda de fim de semana.');
        return;
      }

      if (res.drafts.length === 0) {
        onShowToast('Nenhum evento adicional de fim de semana retornado para as próximas datas.');
        return;
      }

      const batch = await ingestNightlifeBatch({
        drafts: res.drafts,
        sourceCode: 'riotur_weekend_radar',
        sourcePlatform: 'RIOTUR',
        triggerType: 'MANUAL',
        permanentVenues,
      });

      await onNightlifeUpdated();
      await refreshRuns();
      setQueueFilter('PENDENTE');
      onShowToast(
        `Radar Fim de Semana no Rio: ${res.drafts.length} evento(s) capturado(s)! ${batch.insertedPending} novo(s) em PENDENTE e ${batch.dedupedUpdated} deduplicado(s).`
      );
    } finally {
      setBusyAction('');
    }
  };
  const handleSymplaSync = async () => {
    setBusyAction('sympla-sync');
    setApiSyncNote('');
    saveSessionNightlifeCredentials(symplaToken, ingresseKey);
    try {
      const res = await syncSymplaNightlifeEvents(symplaToken, 'Rio de Janeiro');
      if (!res.ok) {
        onShowError(res.error || 'Falha ao consultar API da Sympla.');
        return;
      }
      if (res.note) setApiSyncNote(res.note);
      const batch = await ingestNightlifeBatch({
        drafts: res.drafts,
        sourceCode: 'sympla_api',
        sourcePlatform: 'SYMPLA',
        triggerType: 'MANUAL',
        permanentVenues,
      });
      await onNightlifeUpdated();
      await refreshRuns();
      setQueueFilter('PENDENTE');
      onShowToast(
        `Sympla sincronizada: ${res.rawCount} evento(s) lido(s), ${batch.insertedPending} novo(s) em PENDENTE e ${batch.dedupedUpdated} deduplicado(s).`
      );
    } finally {
      setBusyAction('');
    }
  };

  const handleIngresseSync = async () => {
    setBusyAction('ingresse-sync');
    setApiSyncNote('');
    saveSessionNightlifeCredentials(symplaToken, ingresseKey);
    try {
      const res = await syncIngresseNightlifeEvents(ingresseKey, 'Rio de Janeiro');
      if (!res.ok) {
        onShowError(res.error || 'Falha ao consultar API da Ingresse.');
        return;
      }
      const batch = await ingestNightlifeBatch({
        drafts: res.drafts,
        sourceCode: 'ingresse_api',
        sourcePlatform: 'INGRESSE',
        triggerType: 'MANUAL',
        permanentVenues,
      });
      await onNightlifeUpdated();
      await refreshRuns();
      setQueueFilter('PENDENTE');
      onShowToast(
        `Ingresse sincronizada: ${res.rawCount} lido(s), ${batch.insertedPending} novo(s) em PENDENTE e ${batch.dedupedUpdated} deduplicado(s).`
      );
    } finally {
      setBusyAction('');
    }
  };

  // --- Mode 3 Handlers ---
  const handleBatchFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusyAction('batch-parse');
    try {
      const { headers, rows } = await parseNightlifeFile(file);
      if (rows.length === 0) {
        onShowError('O arquivo não possui linhas válidas de eventos.');
        return;
      }
      const mapping = detectNightlifeColumnMapping(headers);
      const drafts = mapRowsToNightlifeDrafts(rows, mapping, permanentVenues);
      setBatchFileName(file.name);
      setBatchHeaders(headers);
      setBatchRows(rows);
      setBatchMapping(mapping);
      setBatchDrafts(drafts);
      onShowToast(`${drafts.length} evento(s) reconhecido(s) em "${file.name}".`);
    } catch (err) {
      onShowError(
        `Erro ao ler arquivo: ${err instanceof Error ? err.message : 'formato inválido'}`
      );
    } finally {
      setBusyAction('');
    }
  };

  const handleBatchQueue = async () => {
    if (batchDrafts.length === 0) return;
    setBusyAction('batch-ingest');
    try {
      const res = await ingestNightlifeBatch({
        drafts: batchDrafts,
        sourceCode: 'batch_csv_json',
        sourcePlatform: 'CSV_JSON',
        triggerType: 'MANUAL',
        permanentVenues,
      });
      await onNightlifeUpdated();
      await refreshRuns();
      setBatchDrafts([]);
      setBatchRows([]);
      setBatchHeaders([]);
      setBatchFileName('');
      setBatchMapping(null);
      setQueueFilter('PENDENTE');
      onShowToast(
        `Lote enviado para curadoria: ${res.insertedPending} pendente(s) e ${res.dedupedUpdated} deduplicado(s).`
      );
    } finally {
      setBusyAction('');
    }
  };

  // --- Mode 4 Handler ---
  const handleManualCreate = async (directPublish: boolean) => {
    const linkedVenue = permanentVenues.find((v) => v.id === manVenueId);
    const resolvedVenueName = (linkedVenue?.name || manVenueName).trim();
    const resolvedNeighborhood = (linkedVenue?.neighborhood || manNeighborhood).trim();
    const resolvedAddress = (
      linkedVenue?.address ||
      manAddress ||
      `${resolvedNeighborhood}, Rio de Janeiro - RJ`
    ).trim();

    const priceNum = manPrice.trim() ? Number(manPrice.replace(',', '.')) : undefined;
    const { startsAtIso, endsAtIso } = buildStartEndIsoRio(manDate, manStartTime, manEndTime);

    const draft: NightlifeEventDraft = {
      external_key: `manual:${manDate}:${manTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}:${Date.now().toString(36)}`,
      source_platform: 'MANUAL_ADMIN',
      title: manTitle.trim(),
      short_summary: manSummary.trim(),
      sub_area: manSubArea,
      music_genres: manGenres
        .split(',')
        .map((g) => g.trim())
        .filter(Boolean),
      moment_tags: ['friends', 'couple'],
      age_rating: '18+',
      venue_id: linkedVenue?.id,
      venue_name: resolvedVenueName,
      neighborhood: resolvedNeighborhood,
      address: resolvedAddress,
      latitude: linkedVenue?.latitude,
      longitude: linkedVenue?.longitude,
      event_date: manDate,
      start_time: manStartTime,
      end_time: manEndTime || undefined,
      starts_at: startsAtIso,
      ends_at: endsAtIso,
      is_free: manIsFree,
      price_min_brl: manIsFree ? 0 : Number.isFinite(priceNum) ? priceNum : undefined,
      price_display_label: manIsFree
        ? 'Entrada gratuita'
        : Number.isFinite(priceNum) && (priceNum ?? 0) > 0
          ? `A partir de R$ ${(priceNum ?? 0).toFixed(0)}`
          : manAvailability === 'PORTA'
            ? 'Ingresso na porta'
            : 'Consultar valores na fonte oficial',
      ticket_url: manTicketUrl.trim() || undefined,
      availability_status: manIsFree ? 'GRATUITO' : manAvailability,
      lineup: manLineup
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean),
      cover_image: manCoverUrl.trim(),
      image_origin: manCoverUrl.trim()
        ? 'PRODUCER_AUTHORIZED'
        : 'ILLUSTRATIVE_CATEGORY_FALLBACK',
      image_license_note: manCoverUrl.trim()
        ? 'Arte autorizada inserida pela curadoria Admin.'
        : 'Visual editorial da subárea.',
      curation_status: directPublish ? 'PUBLICADO' : 'PENDENTE',
      is_featured: false,
      is_demonstrative: false,
    };

    const comp = checkNightlifeCompleteness(draft);
    if (!comp.complete) {
      onShowError(`Cadastro incompleto: ${comp.missing_fields.join('; ')}.`);
      return;
    }

    setBusyAction('manual-create');
    try {
      const res = await ingestNightlifeBatch({
        drafts: [draft],
        sourceCode: 'manual_admin',
        sourcePlatform: 'MANUAL_ADMIN',
        triggerType: 'MANUAL',
        permanentVenues,
        allowDirectPublishIfComplete: directPublish,
      });
      await onNightlifeUpdated();
      await refreshRuns();
      setManTitle('');
      setManLineup('');
      setManSummary('');
      setManTicketUrl('');
      setManCoverUrl('');
      setQueueFilter(directPublish ? 'PUBLICADO' : 'PENDENTE');
      onShowToast(
        directPublish && res.insertedPending > 0
          ? 'Evento cadastrado e publicado diretamente na agenda pública!'
          : res.dedupedUpdated > 0
            ? 'Evento mesclado com registro equivalente existente!'
            : 'Evento salvo na fila PENDENTE de curadoria.'
      );
    } finally {
      setBusyAction('');
    }
  };

  // --- Queue Curation Actions ---
  const handleApprove = async (ev: NightlifeEvent) => {
    const res = await approveAndPublishNightlifeEvent(ev.id);
    if (!res.ok) {
      if (res.completeness?.missing_fields.some((f) => f.includes('Local'))) {
        setEditingId(ev.id);
        setEditDraft({
          title: ev.title,
          sub_area: ev.sub_area,
          venue_id: ev.venue_id,
          venue_name:
            res.completeness.inferred_venue?.venue_name ||
            (ev.venue_name !== 'Local a confirmar' ? ev.venue_name : ''),
          neighborhood: res.completeness.inferred_venue?.neighborhood || ev.neighborhood,
          address: ev.address,
          event_date: ev.event_date,
          start_time: ev.start_time,
          end_time: ev.end_time,
          is_free: ev.is_free,
          price_min_brl: ev.price_min_brl,
          price_display_label: ev.price_display_label,
          ticket_url: ev.ticket_url,
          availability_status: ev.availability_status,
          short_summary: ev.short_summary,
          cover_image: ev.cover_image,
        });
        onShowToast('Informe ou confirme o Local / Casa do evento para concluir a publicação.');
        return;
      }
      onShowError(res.error);
      return;
    }
    await onNightlifeUpdated();
    onShowToast(`"${ev.title}" aprovado e publicado em A noite carioca!`);
  };

  const handleSaveEdit = async (ev: NightlifeEvent) => {
    const linked = editDraft.venue_id
      ? permanentVenues.find((v) => v.id === editDraft.venue_id)
      : undefined;
    const patch: Partial<NightlifeEvent> = {
      ...editDraft,
      venue_name: linked ? linked.name : editDraft.venue_name,
      neighborhood: linked ? linked.neighborhood : editDraft.neighborhood,
      address: linked ? linked.address : editDraft.address,
      latitude: linked ? linked.latitude : editDraft.latitude,
      longitude: linked ? linked.longitude : editDraft.longitude,
    };
    const res = await updateNightlifeEvent(ev.id, patch);
    if (!res.ok) {
      onShowError(res.error);
      return;
    }
    setEditingId(null);
    await onNightlifeUpdated();
    onShowToast('Alterações do evento salvas com sucesso.');
  };

  const handleSchedule = async (ev: NightlifeEvent) => {
    if (!scheduleDatetime) {
      onShowError('Escolha a data e horário para publicação programada.');
      return;
    }
    const res = await scheduleNightlifeEvent(ev.id, new Date(scheduleDatetime).toISOString());
    if (!res.ok) {
      onShowError(res.error);
      return;
    }
    setSchedulingId(null);
    setScheduleDatetime('');
    await onNightlifeUpdated();
    onShowToast(`"${ev.title}" programado para publicação automática.`);
  };

  const handleManualSweep = async () => {
    setBusyAction('sweep');
    try {
      const res = await runManualRadarSweepAndLog();
      await onNightlifeUpdated();
      await refreshRuns();
      onShowToast(
        `Radar varrido: ${res.promotedCount} programado(s) publicado(s), ${res.expiredCount} encerrado(s) expirado(s).`
      );
    } finally {
      setBusyAction('');
    }
  };

  const handleClearAgenda = async () => {
    await clearAllNightlifeEvents();
    await onNightlifeUpdated();
    await refreshRuns();
    onShowToast('Agenda noturna restaurada para estado limpo (0 eventos).');
  };

  return (
    <div className="mt-6 space-y-6">
      {/* Cabeçalho KPIs & Lifecycle */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-[#123B56]/25 bg-gradient-to-br from-[#0E2235] to-[#123B56] p-5 text-white lg:flex-row lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FF6B35]/20 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#FFB347]">
              <MoonStar className="h-3.5 w-3.5" />
              BoraRio Nightlife Radar · Agenda Curada
            </span>
            {cloudStatus && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                  cloudStatus.storage === 'supabase'
                    ? 'border border-emerald-400/30 bg-emerald-500/20 text-emerald-300'
                    : 'border border-amber-400/30 bg-amber-500/20 text-amber-300'
                }`}
                title={cloudStatus.message}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    cloudStatus.storage === 'supabase' ? 'animate-pulse bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                {cloudStatus.storage === 'supabase'
                  ? 'Nuvem Supabase Global Conectada'
                  : 'Armazenamento Local (Defina SERVICE_ROLE na Vercel)'}
              </span>
            )}
          </div>
          <h2 className="mt-1.5 font-sans text-xl font-bold">
            Captura Multi-Fonte &amp; Curadoria Humana Obrigatória
          </h2>
          <p className="mt-0.5 text-xs text-[#F1E8D8]/85">
            Eventos são registros temporários independentes do catálogo permanente. Tudo que é capturado entra em{' '}
            <strong>PENDENTE</strong> com deduplicação e expiração automática após o horário final.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busyAction === 'sweep'}
            onClick={() => void handleManualSweep()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/20 disabled:opacity-50"
          >
            {busyAction === 'sweep' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 text-[#F7931E]" />
            )}
            Varrer Radar &amp; Expirar Encerrados
          </button>

          <button
            type="button"
            onClick={() => void handleClearAgenda()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-400/35 bg-red-500/15 px-3.5 py-2 text-xs font-bold text-red-100 hover:bg-red-500/30"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Limpar Agenda (Estado Limpo)
          </button>
        </div>
      </div>

      {/* KPIs de Status */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
          <p className="text-[11px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
            Publicados na Home
          </p>
          <p className="mt-1 font-sans text-2xl font-extrabold text-[var(--text-primary)]">
            {counts.PUBLICADO}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-500/35 bg-amber-500/8 p-4">
          <p className="text-[11px] font-bold uppercase text-amber-700 dark:text-amber-300">
            Pendentes de Curadoria
          </p>
          <p className="mt-1 font-sans text-2xl font-extrabold text-[var(--text-primary)]">
            {counts.PENDENTE}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
          <p className="text-[11px] font-bold uppercase text-sky-600 dark:text-sky-400">
            Programados
          </p>
          <p className="mt-1 font-sans text-2xl font-extrabold text-[var(--text-primary)]">
            {counts.PROGRAMADO}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
          <p className="text-[11px] font-bold uppercase text-[var(--text-secondary)]">
            Expirados / Cancelados / Rej.
          </p>
          <p className="mt-1 font-sans text-2xl font-extrabold text-[var(--text-primary)]">
            {counts.EXPIRADO + counts.CANCELADO + counts.REJEITADO}
          </p>
        </div>
      </div>

      {/* Painel de Captura Multi-Modo */}
      <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
        <div className="flex flex-wrap gap-2 border-b border-[var(--border-hairline)] pb-4">
          {[
            { id: 'url' as const, label: '1. Importar por URL Oficial', icon: Link2 },
            { id: 'api' as const, label: '2. Riotur, Sympla & Ingresse', icon: Globe2 },
            { id: 'batch' as const, label: '3. Em Lote (CSV / JSON)', icon: Upload },
            { id: 'manual' as const, label: '4. Cadastro Manual Rápido', icon: Plus },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = captureMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCaptureMode(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  active
                    ? 'bg-[#FF6B35] text-white shadow-xs'
                    : 'border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* MODO 1: POR URL (INDIVIDUAL OU LOTE) */}
        {captureMode === 'url' && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUrlSubTab('single')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  urlSubTab === 'single'
                    ? 'bg-[#123B56] text-white'
                    : 'border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]'
                }`}
              >
                Link Individual (1 URL)
              </button>
              <button
                type="button"
                onClick={() => setUrlSubTab('batch')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  urlSubTab === 'batch'
                    ? 'bg-[#123B56] text-white'
                    : 'border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]'
                }`}
              >
                <ListPlus className="h-3.5 w-3.5" />
                Lote de Múltiplos Links (Até 30 URLs)
              </button>
            </div>

            {urlSubTab === 'single' ? (
              <>
                <form onSubmit={handleExtractUrl} className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="url"
                    required
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://www.sympla.com.br/evento/... ou Ingresse, Shotgun, Eventbrite, Circo Voador"
                    className="flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm text-[var(--text-primary)] focus:border-[#FF6B35] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={busyAction === 'url-extract'}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#123B56] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#102F46] disabled:opacity-50"
                  >
                    {busyAction === 'url-extract' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-[#F7931E]" />
                    )}
                    Extrair via Servidor (/api/nightlife)
                  </button>
                </form>

                <p className="text-xs text-[var(--text-secondary)]">
                  Suporta leitura estruturada JSON-LD e OpenGraph de links HTTPS em Sympla, Ingresse, Shotgun, Eventbrite, Eventim, Ticketmaster, Ticket360, Circo Voador, Rio Scenarium, Riotur, Agenda Rio e Tá Sendo (SSR com allowlist estrita; proteções anti-bot nunca são burladas).
                </p>

                {urlWarning && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-200">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="space-y-1.5">
                      <p className="font-semibold">{urlWarning}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setManTicketUrl(urlInput);
                          setCaptureMode('manual');
                        }}
                        className="font-bold text-[#FF6B35] underline"
                      >
                        Abrir Cadastro Manual com link preenchido →
                      </button>
                    </div>
                  </div>
                )}

                {urlExtractedDraft && (
                  <div className="flex flex-col justify-between gap-4 rounded-2xl border border-[#397B68]/35 bg-[#397B68]/8 p-4 sm:flex-row sm:items-center">
                    <div className="space-y-1 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#397B68] px-2.5 py-0.5 text-[10px] font-bold text-white">
                        Extraído · {NIGHTLIFE_SOURCE_LABELS[urlExtractedDraft.source_platform]}
                      </span>
                      <h4 className="text-sm font-bold text-[var(--text-primary)]">
                        {urlExtractedDraft.title}
                      </h4>
                      <p className="text-[var(--text-secondary)]">
                        {urlExtractedDraft.event_date} · {urlExtractedDraft.start_time} ·{' '}
                        {urlExtractedDraft.venue_name} ({urlExtractedDraft.neighborhood}) ·{' '}
                        {urlExtractedDraft.price_display_label}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={busyAction === 'url-queue'}
                      onClick={() => void handleQueueUrlDraft()}
                      className="shrink-0 rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-4 py-2.5 text-xs font-bold text-white shadow-sm"
                    >
                      Enviar para Fila PENDENTE
                    </button>
                  </div>
                )}
              </>
            ) : (
              <form onSubmit={handleBatchUrlsExtract} className="space-y-3">
                <p className="text-xs text-[var(--text-secondary)]">
                  Cole múltiplos links de páginas de eventos (um por linha, até 30 links). O servidor processará em lote concorrente e colocará todos os eventos válidos na fila <strong>PENDENTE</strong>.
                </p>
                <textarea
                  rows={5}
                  required
                  value={batchUrlsInput}
                  onChange={(e) => setBatchUrlsInput(e.target.value)}
                  placeholder="https://www.sympla.com.br/evento/exemplo-1&#10;https://www.ingresse.com/evento-exemplo-2&#10;https://shotgun.live/events/exemplo-3"
                  className="w-full font-mono rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3 text-xs text-[var(--text-primary)] focus:border-[#FF6B35] focus:outline-none"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    {batchUrlsInput.split('\n').filter((l) => l.trim().startsWith('http')).length} link(s) detectado(s)
                  </span>
                  <button
                    type="submit"
                    disabled={busyAction === 'batch-urls-extract'}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#123B56] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#102F46] disabled:opacity-50"
                  >
                    {busyAction === 'batch-urls-extract' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-[#F7931E]" />
                    )}
                    Extrair Lote Concorrente &amp; Enviar a PENDENTE
                  </button>
                </div>

                {batchUrlsResults && (
                  <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5 text-xs space-y-2">
                    <p className="font-bold text-[var(--text-primary)]">
                      Resultado do Lote: {batchUrlsResults.success} sucesso(s) de {batchUrlsResults.total} link(s).
                    </p>
                    {batchUrlsResults.errors.length > 0 && (
                      <div className="space-y-1 text-red-600 dark:text-red-400">
                        <p className="font-semibold">Links com falha ou proteção anti-bot:</p>
                        {batchUrlsResults.errors.map((err, i) => (
                          <p key={i} className="text-[11px] font-mono truncate">
                            • {err.url}: {err.error}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </form>
            )}
          </div>
        )}

        {/* MODO 2: APIS OFICIAIS (RIOTUR, SYMPLA, INGRESSE) */}
        {captureMode === 'api' && (
          <div className="mt-4 space-y-5">
            {/* CARD 1: RIOTUR OFICIAL (PREFEITURA DO RIO) */}
            <div className="rounded-2xl border-2 border-[#123B56]/40 bg-gradient-to-br from-[#0E2235] via-[#123B56]/50 to-[#0A1A28] p-5 text-white">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/35 bg-emerald-500/20 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Fonte Oficial Aberta · Sem Token/Chave Necessário
                  </span>
                  <h3 className="mt-2 text-base font-bold text-white">
                    Riotur Oficial — Calendário Cultural Rio o Ano Inteiro
                  </h3>
                  <p className="mt-0.5 text-xs text-[#F1E8D8]/80 max-w-2xl">
                    Coleta cultural e de entretenimento da Prefeitura da Cidade do Rio de Janeiro (shows, teatro, samba, festivais e vida noturna). Coleta fotos oficiais, endereços, horários e links originais de compra.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-black/25 p-3.5">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-white/80">Mês Inicial:</label>
                  <select
                    value={rioturMonth}
                    onChange={(e) => setRioturMonth(parseInt(e.target.value, 10))}
                    className="rounded-lg border border-white/20 bg-[#0E2235] px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none"
                  >
                    {[
                      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
                    ].map((mName, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        {idx + 1} - {mName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-white/80">Ano:</label>
                  <select
                    value={rioturYear}
                    onChange={(e) => setRioturYear(parseInt(e.target.value, 10))}
                    className="rounded-lg border border-white/20 bg-[#0E2235] px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none"
                  >
                    <option value={currentYear}>{currentYear}</option>
                    <option value={currentYear + 1}>{currentYear + 1}</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-white/80">Período:</label>
                  <select
                    value={rioturMonthsCount}
                    onChange={(e) => setRioturMonthsCount(parseInt(e.target.value, 10))}
                    className="rounded-lg border border-white/20 bg-[#0E2235] px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none"
                  >
                    <option value={1}>1 mês (~50 eventos)</option>
                    <option value={2}>2 meses consecutivos (~100-150 eventos)</option>
                    <option value={3}>3 meses consecutivos (~200+ eventos)</option>
                  </select>
                </div>

                <button
                  type="button"
                  disabled={busyAction === 'weekend-radar'}
                  onClick={() => void handleWeekendRadar()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-sky-400/40 bg-sky-500/20 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-500/30 disabled:opacity-50"
                >
                  {busyAction === 'weekend-radar' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Calendar className="h-4 w-4 text-sky-300" />
                  )}
                  Radar Fim de Semana (Lote Automático)
                </button>

                <button
                  type="button"
                  disabled={busyAction === 'riotur-sync'}
                  onClick={() => void handleRioturSync()}
                  className="ml-auto inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-4 py-2 text-xs font-bold text-white shadow-md hover:brightness-105 disabled:opacity-50"
                >
                  {busyAction === 'riotur-sync' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-white" />
                  )}
                  Sincronizar Agenda Riotur Oficial
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-200">
              <p className="font-bold">
                Segurança de Credenciais (Nunca grave tokens no código/Git):
              </p>
              <p className="mt-0.5">
                Em produção, configure <code className="font-mono">SYMPLA_API_TOKEN</code> e{' '}
                <code className="font-mono">INGRESSE_API_KEY</code> nas{' '}
                <strong>Environment Variables da Vercel</strong>. Caso deseje testar imediatamente sem redeploy, informe o token abaixo (mantido apenas nesta sessão do navegador em <code className="font-mono">sessionStorage</code>).
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-[var(--text-primary)]">
                    Sympla Public API (`s_token`)
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowTokens((p) => !p)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--text-secondary)]"
                  >
                    {showTokens ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {showTokens ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Conforme <span className="font-mono">developers.sympla.com.br/api-doc/</span>, este endpoint lista eventos do produtor autenticado. Para eventos públicos de terceiros, use Importar por URL ou Lote CSV/JSON.
                </p>
                <input
                  type={showTokens ? 'text' : 'password'}
                  value={symplaToken}
                  onChange={(e) => setSymplaToken(e.target.value)}
                  placeholder="Opcional na UI se SYMPLA_API_TOKEN já estiver na Vercel"
                  className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)]"
                />
                <button
                  type="button"
                  disabled={busyAction === 'sympla-sync'}
                  onClick={() => void handleSymplaSync()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#123B56] py-2.5 text-xs font-bold text-white hover:bg-[#102F46] disabled:opacity-50"
                >
                  {busyAction === 'sympla-sync' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="h-4 w-4 text-[#F7931E]" />
                  )}
                  Sincronizar Sympla Rio → Fila Pendente
                </button>
              </div>

              <div className="space-y-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
                <h4 className="text-sm font-bold text-[var(--text-primary)]">
                  Ingresse Partner API (`apikey`)
                </h4>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Documentação em <span className="font-mono">developer.ingresse.com</span>. Requer chave de parceiro organizador para listagem em lote, ou utilize URL pública individual na aba 1.
                </p>
                <input
                  type={showTokens ? 'text' : 'password'}
                  value={ingresseKey}
                  onChange={(e) => setIngresseKey(e.target.value)}
                  placeholder="Opcional na UI se INGRESSE_API_KEY já estiver na Vercel"
                  className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)]"
                />
                <button
                  type="button"
                  disabled={busyAction === 'ingresse-sync'}
                  onClick={() => void handleIngresseSync()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#397B68] py-2.5 text-xs font-bold text-white hover:opacity-95 disabled:opacity-50"
                >
                  {busyAction === 'ingresse-sync' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="h-4 w-4" />
                  )}
                  Sincronizar Ingresse Rio → Fila Pendente
                </button>
              </div>
            </div>

            {apiSyncNote && (
              <p className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-xs text-[var(--text-secondary)]">
                <strong>Nota da Fonte:</strong> {apiSyncNote}
              </p>
            )}

            {/* Logs de Execuções do Radar */}
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Últimas Execuções do Nightlife Radar ({runs.length})
              </h4>
              {runs.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--border-hairline)] p-3 text-xs text-[var(--text-secondary)]">
                  Nenhuma execução registrada ainda neste ambiente.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {runs.slice(0, 5).map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs"
                    >
                      <span className="font-semibold text-[var(--text-primary)]">
                        [{NIGHTLIFE_SOURCE_LABELS[r.source_platform] || r.source_platform}] {r.summary}
                      </span>
                      <span className="text-[11px] text-[var(--text-secondary)]">
                        {new Date(r.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODO 3: IMPORTAÇÃO EM LOTE CSV / JSON */}
        {captureMode === 'batch' && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-dashed border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-5 sm:flex-row sm:items-center">
              <div className="space-y-1">
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  Importar planilha ou feed JSON de eventos noturnos
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Colunas detectadas automaticamente (`title`, `sub_area`, `venue_name`, `neighborhood`, `event_date`, `start_time`, `price_min_brl`, `ticket_url`, `source_platform`).
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={downloadNightlifeCsvTemplate}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs font-bold text-[var(--text-primary)] hover:border-[#FF6B35]"
                >
                  <Download className="h-3.5 w-3.5" />
                  Baixar Modelo CSV
                </button>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#123B56] px-4 py-2 text-xs font-bold text-white hover:bg-[#102F46]">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-[#F7931E]" />
                  Selecionar CSV / JSON
                  <input
                    data-testid="nightlife-batch-file-input"
                    type="file"
                    accept=".csv,.json,text/csv,application/json"
                    onChange={(e) => void handleBatchFileChange(e)}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {batchDrafts.length > 0 && batchMapping && (
              <div className="space-y-3 rounded-2xl border border-[#397B68]/35 bg-[#397B68]/8 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs">
                    <p className="font-bold text-[var(--text-primary)]">
                      Pré-visualização de "{batchFileName}" · {batchDrafts.length} evento(s) mapeado(s) ({batchRows.length} linha(s), {batchHeaders.length} colunas)
                    </p>
                    <p className="text-[var(--text-secondary)]">
                      Mapeamento: título=<code>{batchMapping.title || '—'}</code>, data=
                      <code>{batchMapping.event_date || '—'}</code>, casa=
                      <code>{batchMapping.venue_name || '—'}</code>
                    </p>
                  </div>

                  <button
                    type="button"
                    data-testid="btn-queue-batch-nightlife"
                    disabled={busyAction === 'batch-ingest'}
                    onClick={() => void handleBatchQueue()}
                    className="rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-4 py-2 text-xs font-bold text-white shadow-sm"
                  >
                    Enviar {batchDrafts.length} para Fila PENDENTE (Deduplicar)
                  </button>
                </div>

                <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1 text-xs">
                  {batchDrafts.slice(0, 15).map((d, idx) => (
                    <div
                      key={`${d.external_key}-${idx}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2"
                    >
                      <span className="font-bold text-[var(--text-primary)]">{d.title}</span>
                      <span className="text-[var(--text-secondary)]">
                        {d.event_date} {d.start_time} · {d.venue_name} ({d.neighborhood}) ·{' '}
                        {NIGHTLIFE_SOURCE_LABELS[d.source_platform]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODO 4: CADASTRO MANUAL RÁPIDO */}
        {captureMode === 'manual' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleManualCreate(false);
            }}
            className="mt-4 space-y-4"
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="text-xs font-bold">Título do evento *</label>
                <input
                  type="text"
                  required
                  value={manTitle}
                  onChange={(e) => setManTitle(e.target.value)}
                  placeholder="Ex: Samba da Pedra do Sal / Noite Carioca"
                  className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold">Subárea *</label>
                <select
                  value={manSubArea}
                  onChange={(e) => setManSubArea(e.target.value as NightlifeSubArea)}
                  className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs"
                >
                  {(Object.keys(NIGHTLIFE_SUBAREA_META) as NightlifeSubArea[]).map((key) => (
                    <option key={key} value={key}>
                      {NIGHTLIFE_SUBAREA_META[key].label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold">Vincular estabelecimento permanente (opcional)</label>
                <select
                  value={manVenueId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setManVenueId(nextId);
                    const found = permanentVenues.find((v) => v.id === nextId);
                    if (found) {
                      setManVenueName(found.name);
                      setManNeighborhood(found.neighborhood);
                      setManAddress(found.address);
                    }
                  }}
                  className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs"
                >
                  <option value="">Evento avulso / Casa externa</option>
                  {permanentVenues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.neighborhood})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold">Local / Casa do evento *</label>
                <input
                  type="text"
                  required={!manVenueId}
                  value={manVenueName}
                  onChange={(e) => setManVenueName(e.target.value)}
                  placeholder="Ex: Circo Voador"
                  className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold">Bairro *</label>
                <input
                  type="text"
                  required={!manVenueId}
                  value={manNeighborhood}
                  onChange={(e) => setManNeighborhood(e.target.value)}
                  placeholder="Lapa, Botafogo, Ipanema..."
                  className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold">Endereço completo</label>
                <input
                  type="text"
                  value={manAddress}
                  onChange={(e) => setManAddress(e.target.value)}
                  placeholder="Rua, número - Bairro"
                  className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold">Data *</label>
                <input
                  type="date"
                  required
                  value={manDate}
                  onChange={(e) => setManDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold">Início / Fim previstos *</label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="text"
                    required
                    value={manStartTime}
                    onChange={(e) => setManStartTime(e.target.value)}
                    placeholder="22:00"
                    className="w-1/2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs"
                  />
                  <input
                    type="text"
                    value={manEndTime}
                    onChange={(e) => setManEndTime(e.target.value)}
                    placeholder="04:00"
                    className="w-1/2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold">Ingresso &amp; Valor</label>
                <div className="mt-1 flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={manIsFree}
                      onChange={(e) => setManIsFree(e.target.checked)}
                    />
                    Gratuito
                  </label>
                  {!manIsFree && (
                    <input
                      type="number"
                      min={0}
                      value={manPrice}
                      onChange={(e) => setManPrice(e.target.value)}
                      placeholder="R$ mín."
                      className="flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold">Link oficial de ingressos</label>
                <input
                  type="url"
                  value={manTicketUrl}
                  onChange={(e) => setManTicketUrl(e.target.value)}
                  placeholder="https://www.sympla.com.br/..."
                  className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold">Disponibilidade</label>
                <select
                  value={manAvailability}
                  onChange={(e) =>
                    setManAvailability(e.target.value as NightlifeAvailabilityStatus)
                  }
                  className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs"
                >
                  <option value="DISPONIVEL">Disponível</option>
                  <option value="ULTIMOS_INGRESSOS">Últimos ingressos</option>
                  <option value="LISTA_AMIGA">Lista amiga</option>
                  <option value="PORTA">Na porta / Bilheteria</option>
                  <option value="GRATUITO">Entrada gratuita</option>
                  <option value="ESGOTADO">Esgotado</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold">URL de arte autorizada (opcional)</label>
                <input
                  type="url"
                  value={manCoverUrl}
                  onChange={(e) => setManCoverUrl(e.target.value)}
                  placeholder="https://... (deixe vazio para fallback visual)"
                  className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-bold">Gêneros musicais (separados por vírgula)</label>
                <input
                  type="text"
                  value={manGenres}
                  onChange={(e) => setManGenres(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold">Line-up / Atrações (separados por vírgula)</label>
                <input
                  type="text"
                  value={manLineup}
                  onChange={(e) => setManLineup(e.target.value)}
                  placeholder="Roda A, DJ Convidado"
                  className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold">Resumo editorial próprio</label>
              <textarea
                rows={2}
                value={manSummary}
                onChange={(e) => setManSummary(e.target.value)}
                placeholder="Texto original curto descrevendo a noite sem cópia longa de terceiros..."
                className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={busyAction === 'manual-create'}
                className="rounded-xl border border-[#123B56] px-4 py-2.5 text-xs font-bold text-[#123B56] hover:bg-[#123B56] hover:text-white dark:border-[#8DC4EA] dark:text-[#8DC4EA]"
              >
                Enviar para Fila PENDENTE
              </button>
              <button
                type="button"
                disabled={busyAction === 'manual-create'}
                onClick={() => void handleManualCreate(true)}
                className="rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-5 py-2.5 text-xs font-bold text-white shadow-sm"
              >
                Publicar Direto na Home (Validar Campos)
              </button>
            </div>
          </form>
        )}
      </section>

      {/* FILA DE CURADORIA & AGENDA ATIVA */}
      <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
          <div>
            <h3 className="font-sans text-lg font-bold text-[var(--text-primary)]">
              Fila de Curadoria &amp; Agenda da Noite ({filteredQueue.length})
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Nenhum evento externo aparece ao público até receber aprovação curatorial explícita (`PUBLICADO`).
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['ALL', `Todos (${nightlifeEvents.length})`],
                ['PENDENTE', `Pendentes (${counts.PENDENTE})`],
                ['PUBLICADO', `Publicados (${counts.PUBLICADO})`],
                ['PROGRAMADO', `Programados (${counts.PROGRAMADO})`],
                ['CANCELADO', `Cancelados (${counts.CANCELADO})`],
                ['EXPIRADO', `Expirados (${counts.EXPIRADO})`],
                ['REJEITADO', `Rejeitados (${counts.REJEITADO})`],
              ] as const
            ).map(([statusKey, label]) => (
              <button
                key={statusKey}
                type="button"
                onClick={() => setQueueFilter(statusKey)}
                className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
                  queueFilter === statusKey
                    ? 'bg-[#123B56] text-white'
                    : 'border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filteredQueue.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-8 text-center">
            <Database className="mx-auto h-7 w-7 text-[var(--text-secondary)] opacity-60" />
            <p className="mt-2 text-sm font-bold text-[var(--text-primary)]">
              Nenhum evento nesta fila (estado limpo)
            </p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Capture eventos via URL, Sympla/Ingresse, CSV/JSON em lote, cadastro manual ou aguarde envios de estabelecimentos parceiros.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {filteredQueue.map((ev) => {
              const badge = CURATION_STATUS_BADGE[ev.curation_status];
              const comp = checkNightlifeCompleteness(ev);
              const isEditing = editingId === ev.id;
              const isScheduling = schedulingId === ev.id;
              const isRejecting = rejectingId === ev.id;

              return (
                <div
                  key={ev.id}
                  data-testid={`nightlife-queue-item-${ev.id}`}
                  className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4"
                >
                  <div className="flex flex-col justify-between gap-4 lg:flex-row">
                    <div className="flex gap-3.5">
                      <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl border border-[var(--border-hairline)]">
                        <NightlifeCoverArt
                          src={ev.cover_image}
                          alt={ev.title}
                          subArea={ev.sub_area}
                          imageOrigin={ev.image_origin}
                          compact
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                          <span className="rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                            {NIGHTLIFE_SUBAREA_META[ev.sub_area].shortLabel}
                          </span>
                          <span className="rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                            Fonte: {NIGHTLIFE_SOURCE_LABELS[ev.source_platform]}
                          </span>
                          {ev.is_featured && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#FF6B35]/15 px-2 py-0.5 text-[10px] font-bold text-[#FF6B35]">
                              <Star className="h-3 w-3 fill-current" />
                              Destaque
                            </span>
                          )}
                          {ev.availability_status === 'ESGOTADO' && (
                            <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-300">
                              Esgotado
                            </span>
                          )}
                        </div>

                        <h4 className="font-sans text-base font-bold text-[var(--text-primary)]">
                          {ev.title}
                        </h4>

                        <p className="text-xs text-[var(--text-secondary)]">
                          {ev.event_date} · {ev.start_time}
                          {ev.end_time ? `–${ev.end_time}` : ''} · {ev.venue_name} ({ev.neighborhood}) ·{' '}
                          <strong>{ev.price_display_label}</strong>
                          {ev.alternate_ticket_urls && ev.alternate_ticket_urls.length > 0
                            ? ` · +${ev.alternate_ticket_urls.length} link(s) deduplicado(s)`
                            : ''}
                        </p>

                        {!comp.complete ? (
                          <div className="space-y-1">
                            <p className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 px-2 py-1 text-[11px] font-semibold text-red-600 dark:text-red-300">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                              Incompleto p/ publicar: {comp.missing_fields.join('; ')}
                            </p>
                            {comp.inferred_venue && (!ev.venue_name || ev.venue_name.toLowerCase() === 'local a confirmar') && (
                              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
                                  Local sugerido:
                                </span>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await updateNightlifeEvent(ev.id, {
                                      venue_name: comp.inferred_venue!.venue_name,
                                      neighborhood: comp.inferred_venue!.neighborhood,
                                      address: `${comp.inferred_venue!.venue_name}, ${comp.inferred_venue!.neighborhood}, Rio de Janeiro - RJ`,
                                    });
                                    await onNightlifeUpdated();
                                    onShowToast(`Local definido como "${comp.inferred_venue!.venue_name}"!`);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                                >
                                  <MapPin className="h-3 w-3" />
                                  Definir {comp.inferred_venue.venue_name} ({comp.inferred_venue.neighborhood})
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                            Checklist completo ({comp.warnings[0] || 'Pronto para publicação'})
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Botões de Ação Curatorial */}
                    <div className="flex flex-wrap items-start gap-1.5 lg:justify-end">
                      {ev.curation_status !== 'PUBLICADO' && ev.curation_status !== 'EXPIRADO' && (
                        <button
                          type="button"
                          onClick={() => void handleApprove(ev)}
                          className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Aprovar &amp; Publicar
                        </button>
                      )}

                      {ev.curation_status === 'PUBLICADO' && (
                        <>
                          <button
                            type="button"
                            onClick={async () => {
                              await toggleFeaturedNightlifeEvent(ev.id);
                              await onNightlifeUpdated();
                            }}
                            className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold ${
                              ev.is_featured
                                ? 'border-[#FF6B35] bg-[#FF6B35]/15 text-[#FF6B35]'
                                : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)]'
                            }`}
                          >
                            <Star className="h-3.5 w-3.5" />
                            {ev.is_featured ? 'Remover Destaque' : 'Destacar'}
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              const nextAvail =
                                ev.availability_status === 'ESGOTADO'
                                  ? ev.is_free
                                    ? 'GRATUITO'
                                    : 'DISPONIVEL'
                                  : 'ESGOTADO';
                              await setNightlifeAvailability(ev.id, nextAvail);
                              await onNightlifeUpdated();
                            }}
                            className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-bold text-[var(--text-primary)]"
                          >
                            {ev.availability_status === 'ESGOTADO' ? 'Reabrir Venda' : 'Marcar Esgotado'}
                          </button>
                        </>
                      )}

                      {ev.curation_status !== 'EXPIRADO' && ev.curation_status !== 'CANCELADO' && (
                        <button
                          type="button"
                          onClick={() => {
                            setSchedulingId(isScheduling ? null : ev.id);
                            setScheduleDatetime(`${ev.event_date}T12:00`);
                          }}
                          className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-bold text-[var(--text-primary)]"
                        >
                          <CalendarClock className="h-3.5 w-3.5 text-sky-600" />
                          Programar
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          if (isEditing) {
                            setEditingId(null);
                          } else {
                            setEditingId(ev.id);
                            setEditDraft({
                              title: ev.title,
                              sub_area: ev.sub_area,
                              venue_id: ev.venue_id,
                              venue_name: ev.venue_name,
                              neighborhood: ev.neighborhood,
                              address: ev.address,
                              event_date: ev.event_date,
                              start_time: ev.start_time,
                              end_time: ev.end_time,
                              is_free: ev.is_free,
                              price_min_brl: ev.price_min_brl,
                              price_display_label: ev.price_display_label,
                              ticket_url: ev.ticket_url,
                              availability_status: ev.availability_status,
                              short_summary: ev.short_summary,
                              cover_image: ev.cover_image,
                            });
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-bold text-[var(--text-primary)]"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Editar
                      </button>

                      {ev.curation_status === 'PUBLICADO' && (
                        <button
                          type="button"
                          onClick={async () => {
                            await cancelNightlifeEvent(ev.id);
                            await onNightlifeUpdated();
                            onShowToast(`"${ev.title}" marcado como CANCELADO e removido da Home.`);
                          }}
                          className="inline-flex items-center gap-1 rounded-xl border border-red-500/35 bg-red-500/10 px-2.5 py-1.5 text-xs font-bold text-red-600 dark:text-red-300"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Cancelar Evento
                        </button>
                      )}

                      {ev.curation_status === 'PENDENTE' && (
                        <button
                          type="button"
                          onClick={() => setRejectingId(isRejecting ? null : ev.id)}
                          className="inline-flex items-center gap-1 rounded-xl border border-zinc-500/35 px-2.5 py-1.5 text-xs font-bold text-[var(--text-secondary)]"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Rejeitar
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={async () => {
                          await deleteNightlifeEvent(ev.id);
                          await onNightlifeUpdated();
                          onShowToast('Registro removido.');
                        }}
                        aria-label={`Excluir ${ev.title}`}
                        className="rounded-xl p-1.5 text-[var(--text-secondary)] hover:bg-red-500/15 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Drawer inline: Programar publicação */}
                  {isScheduling && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-sky-500/35 bg-sky-500/8 p-3 text-xs">
                      <Clock className="h-4 w-4 text-sky-600" />
                      <span className="font-bold">Publicar automaticamente em:</span>
                      <input
                        type="datetime-local"
                        value={scheduleDatetime}
                        onChange={(e) => setScheduleDatetime(e.target.value)}
                        className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1"
                      />
                      <button
                        type="button"
                        onClick={() => void handleSchedule(ev)}
                        className="rounded-lg bg-sky-600 px-3 py-1.5 font-bold text-white"
                      >
                        Confirmar Agendamento
                      </button>
                      <button
                        type="button"
                        onClick={() => setSchedulingId(null)}
                        className="rounded-lg px-2 py-1 text-[var(--text-secondary)]"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}

                  {/* Drawer inline: Rejeitar */}
                  {isRejecting && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-red-500/35 bg-red-500/8 p-3 text-xs">
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Motivo da rejeição (ex: fora do Rio, duplicado, link inválido)..."
                        className="flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1.5"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          await rejectNightlifeEvent(ev.id, rejectReason);
                          setRejectingId(null);
                          setRejectReason('');
                          await onNightlifeUpdated();
                          onShowToast('Evento movido para REJEITADO.');
                        }}
                        className="rounded-lg bg-red-600 px-3 py-1.5 font-bold text-white"
                      >
                        Confirmar Rejeição
                      </button>
                    </div>
                  )}

                  {/* Drawer inline: Editar / Vincular casa permanente */}
                  {isEditing && (
                    <div className="mt-3 space-y-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 text-xs">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                          <label className="font-bold">Título</label>
                          <input
                            type="text"
                            value={editDraft.title || ''}
                            onChange={(e) =>
                              setEditDraft((prev) => ({ ...prev, title: e.target.value }))
                            }
                            className="mt-1 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label className="font-bold">Vincular casa permanente no BoraRio</label>
                          <select
                            value={editDraft.venue_id || ''}
                            onChange={(e) => {
                              const vid = e.target.value;
                              const v = permanentVenues.find((r) => r.id === vid);
                              setEditDraft((prev) => ({
                                ...prev,
                                venue_id: vid || undefined,
                                venue_name: v ? v.name : prev.venue_name,
                                neighborhood: v ? v.neighborhood : prev.neighborhood,
                              }));
                            }}
                            className="mt-1 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-1.5"
                          >
                            <option value="">Sem vínculo permanente</option>
                            {permanentVenues.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name} ({v.neighborhood})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="font-bold">Casa / Local</label>
                          <input
                            type="text"
                            value={editDraft.venue_name || ''}
                            onChange={(e) =>
                              setEditDraft((prev) => ({ ...prev, venue_name: e.target.value }))
                            }
                            className="mt-1 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label className="font-bold">Bairro</label>
                          <input
                            type="text"
                            value={editDraft.neighborhood || ''}
                            onChange={(e) =>
                              setEditDraft((prev) => ({ ...prev, neighborhood: e.target.value }))
                            }
                            className="mt-1 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label className="font-bold">Data &amp; Início</label>
                          <div className="mt-1 flex gap-2">
                            <input
                              type="date"
                              value={editDraft.event_date || ''}
                              onChange={(e) =>
                                setEditDraft((prev) => ({ ...prev, event_date: e.target.value }))
                              }
                              className="w-3/5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 py-1.5"
                            />
                            <input
                              type="text"
                              value={editDraft.start_time || ''}
                              onChange={(e) =>
                                setEditDraft((prev) => ({ ...prev, start_time: e.target.value }))
                              }
                              className="w-2/5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 py-1.5"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="font-bold">Link oficial de ingressos</label>
                          <input
                            type="url"
                            value={editDraft.ticket_url || ''}
                            onChange={(e) =>
                              setEditDraft((prev) => ({
                                ...prev,
                                ticket_url: e.target.value || undefined,
                              }))
                            }
                            className="mt-1 w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-1.5"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="inline-flex items-center gap-1.5 font-semibold">
                          <input
                            type="checkbox"
                            checked={Boolean(editDraft.is_free)}
                            onChange={(e) =>
                              setEditDraft((prev) => ({
                                ...prev,
                                is_free: e.target.checked,
                                price_display_label: e.target.checked
                                  ? 'Entrada gratuita'
                                  : prev.price_display_label,
                                availability_status: e.target.checked
                                  ? 'GRATUITO'
                                  : prev.availability_status,
                              }))
                            }
                          />
                          Entrada gratuita
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-lg border border-[var(--border-hairline)] px-3 py-1.5 font-semibold"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleSaveEdit(ev)}
                            className="rounded-lg bg-[#123B56] px-4 py-1.5 font-bold text-white"
                          >
                            Salvar Edição
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
