import { Bookmark, HeartHandshake, Lock, Plus, Users } from 'lucide-react';
import { useState } from 'react';
import type { ConfiaRecommendation, TrustCircle, TrustConnection } from '../../types/confia';
import type { IntentVaultItem } from '../../types/intention';
import type { Restaurant } from '../../types/restaurant';
import { CircleManagerModal } from './CircleManagerModal';
import { IntentVaultSection } from './IntentVaultSection';
import { TrustNetworkSection } from './TrustNetworkSection';

interface ConfiaHubViewProps {
  catalog: Restaurant[];
  vaultItems: IntentVaultItem[];
  circles: TrustCircle[];
  connections: TrustConnection[];
  posts: ConfiaRecommendation[];
  activeSubTab: 'vault' | 'network';
  onChangeSubTab: (tab: 'vault' | 'network') => void;
  externalShareVenue?: Restaurant | null;
  onClearExternalShareVenue?: () => void;
  onVaultItemsChanged: (next: IntentVaultItem[]) => void;
  onCirclesAndConnectionsChanged: (
    nextCircles: TrustCircle[],
    nextConnections: TrustConnection[]
  ) => void;
  onPostsChanged: (next: ConfiaRecommendation[]) => void;
  onOpenCaptureModal: () => void;
  onPlanWithBoraIa: (promptText: string) => void;
  onSelectVenue: (venue: Restaurant) => void;
}

export function ConfiaHubView({
  catalog,
  vaultItems,
  circles,
  connections,
  posts,
  activeSubTab,
  onChangeSubTab,
  externalShareVenue = null,
  onClearExternalShareVenue,
  onVaultItemsChanged,
  onCirclesAndConnectionsChanged,
  onPostsChanged,
  onOpenCaptureModal,
  onPlanWithBoraIa,
  onSelectVenue,
}: ConfiaHubViewProps) {
  const [showCircleManager, setShowCircleManager] = useState(false);
  const [shareVenueDraft, setShareVenueDraft] = useState<Restaurant | null>(null);
  const [shareNoteDraft, setShareNoteDraft] = useState<string>('');

  const activeVaultCount = vaultItems.filter((i) => i.status !== 'ARCHIVED').length;
  const acceptedConnCount = connections.filter((c) => c.status === 'ACCEPTED').length;
  const effectiveShareVenue = externalShareVenue || shareVenueDraft;

  const handleRecommendFromVault = (venue: Restaurant, initialNote?: string) => {
    onClearExternalShareVenue?.();
    setShareVenueDraft(venue);
    setShareNoteDraft(initialNote || '');
    onChangeSubTab('network');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Unified BoraRio > Rede Confia Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--border-hairline)] pb-6 md:flex-row md:items-end">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#397B68]">
            <Lock className="h-3.5 w-3.5" />
            BoraRio · Rede Confia &amp; Intenções
          </p>
          <h2 className="font-sans mt-1 text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            {activeSubTab === 'vault' ? 'Cofre de Intenções' : 'Rede Confia'}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-secondary)]">
            {activeSubTab === 'vault'
              ? 'Central pessoal de desejos para guardar links, prints e lugares que você quer viver no Rio.'
              : 'Camada privada de confiança dentro do BoraRio para trocar experiências reais com seus círculos.'}
          </p>
        </div>

        {/* Sub-tab Switcher + Clean Capture Trigger */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-1 shadow-xs">
            <button
              type="button"
              onClick={() => onChangeSubTab('vault')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeSubTab === 'vault'
                  ? 'bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Bookmark className="h-3.5 w-3.5" />
              Cofre de Intenções ({activeVaultCount})
            </button>

            <button
              type="button"
              onClick={() => onChangeSubTab('network')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeSubTab === 'network'
                  ? 'bg-[#397B68] text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <HeartHandshake className="h-3.5 w-3.5" />
              Rede Confia ({acceptedConnCount})
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenCaptureModal}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-[#123B56] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#102F46]"
          >
            <Plus className="h-3.5 w-3.5 text-[#F7931E]" />
            Salvar link/print
          </button>
        </div>
      </div>

      {activeSubTab === 'vault' ? (
        <IntentVaultSection
          items={vaultItems}
          catalog={catalog}
          onItemsChanged={onVaultItemsChanged}
          onOpenCapture={onOpenCaptureModal}
          onPlanWithBoraIa={onPlanWithBoraIa}
          onRecommendOnConfia={handleRecommendFromVault}
          onSelectVenue={onSelectVenue}
        />
      ) : (
        <TrustNetworkSection
          key={`${effectiveShareVenue?.id || 'default'}-${shareNoteDraft}`}
          catalog={catalog}
          circles={circles}
          connections={connections}
          posts={posts}
          preselectedVenue={effectiveShareVenue}
          preselectedNote={shareNoteDraft}
          onPostsChanged={onPostsChanged}
          onVaultItemsChanged={onVaultItemsChanged}
          onOpenCircleManager={() => setShowCircleManager(true)}
          onSelectVenue={onSelectVenue}
        />
      )}

      {showCircleManager && (
        <CircleManagerModal
          circles={circles}
          connections={connections}
          onUpdated={onCirclesAndConnectionsChanged}
          onClose={() => setShowCircleManager(false)}
        />
      )}

      {/* Quiet Quick Status Link to Circles if in Vault */}
      {activeSubTab === 'vault' && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowCircleManager(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[#397B68]"
          >
            <Users className="h-3.5 w-3.5" />
            Gerenciar meus círculos privados na Rede Confia
          </button>
        </div>
      )}
    </div>
  );
}
