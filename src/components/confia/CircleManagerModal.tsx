import {
  Check,
  Copy,
  Plus,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  addTrustConnectionByInvite,
  createTrustCircle,
  deleteTrustCircle,
  getMyConfiaInviteCode,
  toggleConnectionInCircle,
  updateConnectionStatus,
} from '../../services/confiaStore';
import type { TrustCircle, TrustConnection } from '../../types/confia';

interface CircleManagerModalProps {
  circles: TrustCircle[];
  connections: TrustConnection[];
  onUpdated: (nextCircles: TrustCircle[], nextConnections: TrustConnection[]) => void;
  onClose: () => void;
}

export function CircleManagerModal({
  circles,
  connections,
  onUpdated,
  onClose,
}: CircleManagerModalProps) {
  const [circleName, setCircleName] = useState('');
  const [friendName, setFriendName] = useState('');
  const [friendCode, setFriendCode] = useState('');
  const [selectedCircles, setSelectedCircles] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const myCode = getMyConfiaInviteCode();

  const handleCreateCircle = (e: FormEvent) => {
    e.preventDefault();
    if (!circleName.trim()) return;
    const next = createTrustCircle(circleName);
    setCircleName('');
    onUpdated(next, connections);
  };

  const handleAddConnection = (e: FormEvent) => {
    e.preventDefault();
    const res = addTrustConnectionByInvite(friendName, friendCode, selectedCircles, true);
    setFeedback(res.message);
    if (res.ok) {
      setFriendName('');
      setFriendCode('');
      setSelectedCircles([]);
      onUpdated(circles, res.connections);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative my-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar gerenciador de círculos"
          className="absolute right-4 top-4 rounded-full p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#397B68]">
          <Shield className="h-4 w-4" />
          Rede Confia · Gestão Privada
        </div>
        <h3 className="font-sans mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          Círculos &amp; Pessoas de Confiança
        </h3>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Sem seguidores abertos ou feed público. Conecte apenas quem você confia e revogue acessos em 1 toque.
        </p>

        {/* My Invite Code */}
        <div className="mt-5 flex flex-col justify-between gap-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Seu código pessoal de convite
            </p>
            <p className="mt-0.5 font-mono text-base font-bold text-[var(--text-primary)]">
              {myCode}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(myCode);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs font-bold text-[var(--text-primary)] hover:border-[#397B68]"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copiado!' : 'Copiar código'}
          </button>
        </div>

        {/* Create Circle */}
        <form onSubmit={handleCreateCircle} className="mt-5 space-y-2">
          <label className="block text-xs font-bold text-[var(--text-primary)]">
            Criar novo círculo de confiança
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={circleName}
              onChange={(e) => setCircleName(e.target.value)}
              placeholder="Ex: Família, Amigos Zona Sul, Trabalho..."
              className="min-w-0 flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2 text-xs text-[var(--text-primary)]"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-xl bg-[#123B56] px-4 py-2 text-xs font-bold text-white hover:bg-[#102F46]"
            >
              <Plus className="h-3.5 w-3.5" />
              Criar
            </button>
          </div>

          {circles.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {circles.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-1 text-xs font-semibold text-[var(--text-primary)]"
                >
                  <Users className="h-3 w-3 text-[#397B68]" />
                  {c.name}
                  <button
                    type="button"
                    aria-label={`Remover círculo ${c.name}`}
                    onClick={() => onUpdated(deleteTrustCircle(c.id), connections)}
                    className="ml-1 text-[var(--text-secondary)] hover:text-red-500"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </form>

        {/* Connect Friend */}
        <form
          onSubmit={handleAddConnection}
          className="mt-6 space-y-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
            <UserPlus className="h-4 w-4 text-[#FF6B35]" />
            Adicionar pessoa de confiança por código
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <input
              type="text"
              required
              value={friendName}
              onChange={(e) => setFriendName(e.target.value)}
              placeholder="Nome (ex: Camila Ribeiro)"
              className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)]"
            />
            <input
              type="text"
              required
              value={friendCode}
              onChange={(e) => setFriendCode(e.target.value)}
              placeholder="Código CONFIA-..."
              className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 font-mono text-xs text-[var(--text-primary)]"
            />
          </div>

          {circles.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="font-semibold text-[var(--text-secondary)]">Incluir nos círculos:</span>
              {circles.map((c) => {
                const active = selectedCircles.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setSelectedCircles((prev) =>
                        active ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                      )
                    }
                    className={`rounded-full border px-2.5 py-0.5 font-semibold ${
                      active
                        ? 'border-[#397B68] bg-[#397B68] text-white'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}

          {feedback && <p className="text-xs font-semibold text-[#397B68]">{feedback}</p>}

          <button
            type="submit"
            className="rounded-xl bg-[#397B68] px-4 py-2 text-xs font-bold text-white hover:opacity-95"
          >
            Confirmar Conexão Privada
          </button>
        </form>

        {/* Active / Revoked Connections */}
        <div className="mt-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            Conexões registradas ({connections.length})
          </h4>
          {connections.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              Nenhuma pessoa conectada ainda. Envie seu código para amigos próximos ou adicione alguém pelo código acima.
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              {connections.map((conn) => (
                <div
                  key={conn.id}
                  className="flex flex-col justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3 text-xs sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-[var(--text-primary)]">{conn.display_name}</strong>
                      <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                        {conn.handle_or_code}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          conn.status === 'ACCEPTED'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'bg-red-500/15 text-red-600 dark:text-red-300'
                        }`}
                      >
                        {conn.status === 'ACCEPTED' ? 'Ativo' : 'Revogado'}
                      </span>
                    </div>

                    {circles.length > 0 && conn.status === 'ACCEPTED' && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {circles.map((circle) => {
                          const member = conn.circle_ids.includes(circle.id);
                          return (
                            <button
                              key={circle.id}
                              type="button"
                              onClick={() =>
                                onUpdated(circles, toggleConnectionInCircle(conn.id, circle.id))
                              }
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                member
                                  ? 'bg-[#123B56] text-white'
                                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                              }`}
                            >
                              {circle.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onUpdated(
                        circles,
                        updateConnectionStatus(
                          conn.id,
                          conn.status === 'ACCEPTED' ? 'REVOKED' : 'ACCEPTED'
                        )
                      )
                    }
                    className={`inline-flex items-center gap-1 self-start rounded-lg px-3 py-1.5 text-[11px] font-bold sm:self-auto ${
                      conn.status === 'ACCEPTED'
                        ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-300'
                        : 'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300'
                    }`}
                  >
                    {conn.status === 'ACCEPTED' ? (
                      <>
                        <UserX className="h-3.5 w-3.5" />
                        Revogar acesso
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-3.5 w-3.5" />
                        Reativar
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
