import { Building2, CheckCircle2, Phone, User, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { claimRestaurant } from '../services/database';
import type { Restaurant } from '../types/restaurant';

interface ClaimModalProps {
  restaurant: Restaurant;
  onClose: () => void;
  onClaimed: (restaurantId: string) => void;
}

export function ClaimModal({ restaurant, onClose, onClaimed }: ClaimModalProps) {
  const [ownerName, setOwnerName] = useState('');
  const [role, setRole] = useState('Proprietário(a) / Sócio(a)');
  const [whatsapp, setWhatsapp] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ownerName.trim() || !whatsapp.trim()) return;
    setSubmitting(true);
    try {
      await claimRestaurant({
        restaurant_id: restaurant.id,
        restaurant_name: restaurant.name,
        owner_name: ownerName.trim(),
        role: role.trim(),
        whatsapp: whatsapp.trim(),
        cnpj: cnpj.trim() || undefined,
      });
      setSuccess(true);
      onClaimed(restaurant.id);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
        >
          <X className="h-5 w-5" />
        </button>

        {success ? (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="font-sans tracking-tight mt-4 text-2xl font-bold text-[var(--text-primary)]">
              Solicitação Recebida!
            </h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              O perfil de <strong>{restaurant.name}</strong> foi marcado como reivindicado e seus dados foram salvos na base de leads do guia.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-xl bg-[#E05A47] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#c84b39]"
            >
              Concluir
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#E05A47]">
              Área do Parceiro
            </p>
            <h3 className="font-sans tracking-tight mt-1 text-2xl font-bold text-[var(--text-primary)]">
              Reivindicar {restaurant.name}
            </h3>
            <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
              Atualize fotos, cardápio, horários e receba reservas diretas gratuitamente no BoraRio.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-primary)]">
                  Seu nome completo *
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Ex: Maria Clara Oliveira"
                    className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] py-2.5 pl-10 pr-3 text-sm text-[var(--text-primary)] focus:border-[#E05A47] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-primary)]">
                  Cargo no estabelecimento *
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:border-[#E05A47] focus:outline-none"
                >
                  <option>Proprietário(a) / Sócio(a)</option>
                  <option>Gerente Geral</option>
                  <option>Chef de Cozinha</option>
                  <option>Marketing / Assessoria</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-primary)]">
                  WhatsApp para contato *
                </label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                  <input
                    type="tel"
                    required
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="(21) 99999-9999"
                    className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] py-2.5 pl-10 pr-3 text-sm text-[var(--text-primary)] focus:border-[#E05A47] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--text-primary)]">
                  CNPJ (opcional)
                </label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                  <input
                    type="text"
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                    placeholder="00.000.000/0001-00"
                    className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] py-2.5 pl-10 pr-3 text-sm text-[var(--text-primary)] focus:border-[#E05A47] focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 w-full rounded-xl bg-[#E05A47] py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#c84b39] disabled:opacity-60"
              >
                {submitting ? 'Enviando solicitação...' : 'Reivindicar Perfil Gratuitamente'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
