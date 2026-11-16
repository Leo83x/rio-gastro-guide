import type { NightlifeEventDraft } from '../../types/nightlife.ts';

export function getRioTodayIso(baseDate: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(baseDate);
    const map = new Map(parts.map((p) => [p.type, p.value]));
    const y = map.get('year');
    const m = map.get('month');
    const d = map.get('day');
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // fallback below
  }
  return baseDate.toISOString().slice(0, 10);
}

export interface KnownRioVenue {
  canonicalName: string;
  neighborhood: string;
  patterns: RegExp[];
}

export const KNOWN_RIO_VENUES: KnownRioVenue[] = [
  {
    canonicalName: 'Farmasi Arena',
    neighborhood: 'Barra da Tijuca',
    patterns: [
      /\bfarmasi\s*arena\b/i,
      /\bjeunesse\s*arena\b/i,
      /\barena\s*jeunesse\b/i,
      /\bhsbc\s*arena\b/i,
      /\bfarmasi\b/i,
    ],
  },
  {
    canonicalName: 'Qualistage',
    neighborhood: 'Barra da Tijuca',
    patterns: [/\bqualistage\b/i, /\bmetropolitan\b/i, /\bcitibank\s*hall\b/i],
  },
  {
    canonicalName: 'Circo Voador',
    neighborhood: 'Lapa',
    patterns: [/\bcirco\s*voador\b/i, /\bcircovoador\b/i],
  },
  {
    canonicalName: 'Fundição Progresso',
    neighborhood: 'Lapa',
    patterns: [/\bfundi[cç][aã]o\s*progresso\b/i, /\bfundi[cç][aã]o\b/i],
  },
  {
    canonicalName: 'Vivo Rio',
    neighborhood: 'Glória',
    patterns: [/\bvivo\s*rio\b/i],
  },
  {
    canonicalName: 'Marina da Glória',
    neighborhood: 'Glória',
    patterns: [/\bmarina\s*da\s*gl[oó]ria\b/i, /\bmarinadagloria\b/i],
  },
  {
    canonicalName: 'Theatro Municipal',
    neighborhood: 'Centro',
    patterns: [/\btheatro\s*municipal\b/i, /\bteatro\s*municipal\b/i],
  },
  {
    canonicalName: 'Maracanã',
    neighborhood: 'Maracanã',
    patterns: [/\best[aá]dio\s*(?:do\s*)?maracan[aã]\b/i, /\bmaracan[aã]\b/i],
  },
  {
    canonicalName: 'Maracanãzinho',
    neighborhood: 'Maracanã',
    patterns: [/\bmaracan[aã]zinho\b/i],
  },
  {
    canonicalName: 'Estádio Nilton Santos (Engenhão)',
    neighborhood: 'Engenho de Dentro',
    patterns: [/\bnilton\s*santos\b/i, /\bengenh[aã]o\b/i],
  },
  {
    canonicalName: 'Espaço Hall',
    neighborhood: 'Barra da Tijuca',
    patterns: [/\bespa[cç]o\s*hall\b/i],
  },
  {
    canonicalName: 'Riocentro',
    neighborhood: 'Barra da Tijuca',
    patterns: [/\briocentro\b/i],
  },
  {
    canonicalName: 'Morro da Urca',
    neighborhood: 'Urca',
    patterns: [/\bmorro\s*da\s*urca\b/i, /\bp[aã]o\s*de\s*a[cç][uú]car\b/i, /\bbondinho\b/i],
  },
  {
    canonicalName: 'Sacadura 154',
    neighborhood: 'Saúde',
    patterns: [/\bsacadura\s*154\b/i, /\bsacadura\b/i],
  },
  {
    canonicalName: 'Nau Cidades',
    neighborhood: 'Santo Cristo',
    patterns: [/\bnau\s*cidades\b/i, /\bnaucidades\b/i],
  },
  {
    canonicalName: 'MAM Rio',
    neighborhood: 'Glória',
    patterns: [/\bmam\s*rio\b/i, /\bmuseu\s*de\s*arte\s*moderna\b/i],
  },
  {
    canonicalName: 'Leviano Bar',
    neighborhood: 'Lapa',
    patterns: [/\bleviano\s*bar\b/i, /\bleviano\b/i],
  },
  {
    canonicalName: 'Clube dos Democráticos',
    neighborhood: 'Lapa',
    patterns: [/\bclube\s*dos\s*democr[aá]ticos\b/i, /\bdemocr[aá]ticos\b/i],
  },
  {
    canonicalName: 'Beco das Garrafas',
    neighborhood: 'Copacabana',
    patterns: [/\bbeco\s*das\s*garrafas\b/i],
  },
  {
    canonicalName: 'Blue Note Rio',
    neighborhood: 'Copacabana',
    patterns: [/\bblue\s*note\s*rio\b/i, /\bblue\s*note\b/i],
  },
  {
    canonicalName: 'Renascença Clube',
    neighborhood: 'Andaraí',
    patterns: [/\brenascen[cç]a\s*clube\b/i, /\brenascen[cç]a\b/i],
  },
  {
    canonicalName: 'Beco do Rato',
    neighborhood: 'Lapa',
    patterns: [/\bbeco\s*do\s*rato\b/i],
  },
  {
    canonicalName: 'Teatro Rival Petrobras',
    neighborhood: 'Centro',
    patterns: [/\bteatro\s*rival\b/i, /\brival\s*petrobras\b/i],
  },
  {
    canonicalName: 'Teatro Riachuelo',
    neighborhood: 'Centro',
    patterns: [/\bteatro\s*riachuelo\b/i],
  },
  {
    canonicalName: 'Teatro Claro Mais RJ',
    neighborhood: 'Copacabana',
    patterns: [/\bteatro\s*claro\b/i],
  },
  {
    canonicalName: 'Teatro dos Quatro',
    neighborhood: 'Gávea',
    patterns: [/\bteatro\s*dos\s*quatro\b/i],
  },
  {
    canonicalName: 'Teatro Prudential',
    neighborhood: 'Glória',
    patterns: [/\bteatro\s*prudential\b/i],
  },
  {
    canonicalName: 'Cidade das Artes',
    neighborhood: 'Barra da Tijuca',
    patterns: [/\bcidade\s*das\s*artes\b/i],
  },
  {
    canonicalName: 'Imperator',
    neighborhood: 'Méier',
    patterns: [/\bimperator\b/i, /\bjo[aã]o\s*nogueira\b/i],
  },
  {
    canonicalName: 'Parque Madureira',
    neighborhood: 'Madureira',
    patterns: [/\bparque\s*madureira\b/i],
  },
  {
    canonicalName: 'Quadra da Portela',
    neighborhood: 'Madureira',
    patterns: [/\bquadra\s*da\s*portela\b/i, /\bportela\b/i],
  },
  {
    canonicalName: 'Quadra da Mangueira',
    neighborhood: 'Mangueira',
    patterns: [/\bquadra\s*da\s*mangueira\b/i, /\bmangueira\b/i],
  },
  {
    canonicalName: 'Quadra do Salgueiro',
    neighborhood: 'Andaraí',
    patterns: [/\bquadra\s*do\s*salgueiro\b/i, /\bsalgueiro\b/i],
  },
  {
    canonicalName: 'Cidade do Samba',
    neighborhood: 'Gamboa',
    patterns: [/\bcidade\s*do\s*samba\b/i],
  },
  {
    canonicalName: 'Sambódromo (Sapucaí)',
    neighborhood: 'Centro',
    patterns: [/\bsamb[oó]dromo\b/i, /\bsapuca[ií]\b/i],
  },
  {
    canonicalName: 'Pedra do Sal',
    neighborhood: 'Saúde',
    patterns: [/\bpedra\s*do\s*sal\b/i],
  },
  {
    canonicalName: 'Jockey Club Brasileiro',
    neighborhood: 'Gávea',
    patterns: [/\bjockey\s*club\b/i, /\bhip[oó]dromo\s*da\s*g[aá]vea\b/i],
  },
  {
    canonicalName: 'Bosque Bar',
    neighborhood: 'Gávea',
    patterns: [/\bbosque\s*bar\b/i, /\bbosque\b/i],
  },
  {
    canonicalName: 'Manouche (Casa Camolese)',
    neighborhood: 'Jardim Botânico',
    patterns: [/\bmanouche\b/i, /\bcasa\s*camolese\b/i],
  },
  {
    canonicalName: 'Bar Bukowski',
    neighborhood: 'Botafogo',
    patterns: [/\bbar\s*bukowski\b/i, /\bbukowski\b/i],
  },
  {
    canonicalName: 'Palafita',
    neighborhood: 'Lagoa',
    patterns: [/\bpalafita\b/i],
  },
];

export interface InferredVenueResult {
  venue_name: string;
  neighborhood: string;
  matched_by: 'known_catalog' | 'title_delimiter' | 'text_pattern';
}

export function inferVenueAndNeighborhood(
  title: string,
  text = '',
  url = ''
): InferredVenueResult | null {
  const combined = `${title} ${text} ${url}`.trim();
  if (!combined) return null;

  // 1. Check known catalog
  for (const v of KNOWN_RIO_VENUES) {
    for (const pat of v.patterns) {
      if (pat.test(combined)) {
        return {
          venue_name: v.canonicalName,
          neighborhood: v.neighborhood,
          matched_by: 'known_catalog',
        };
      }
    }
  }

  // 2. Title delimiter extraction (e.g. "EVENTO | 21/11 | FARMASI ARENA" or "FESTA @ ESPAÇO X")
  const parts = title.split(/\s*[|@–—-]\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const seg = parts[i];
      if (/^\d{1,2}[/-]\d{1,2}/.test(seg) || /^\d{1,2}h/i.test(seg) || /^r\$\s*\d+/i.test(seg)) {
        continue;
      }
      if (seg.length >= 3 && seg.length <= 40) {
        for (const v of KNOWN_RIO_VENUES) {
          for (const pat of v.patterns) {
            if (pat.test(seg)) {
              return {
                venue_name: v.canonicalName,
                neighborhood: v.neighborhood,
                matched_by: 'known_catalog',
              };
            }
          }
        }
        const words = seg.split(/\s+/).map((w) => {
          if (['da', 'de', 'do', 'das', 'dos', 'em', 'no', 'na', 'e'].includes(w.toLowerCase())) {
            return w.toLowerCase();
          }
          return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        });
        const candidateVenue = words.join(' ');
        if (candidateVenue.length >= 3) {
          return {
            venue_name: candidateVenue,
            neighborhood: 'Rio de Janeiro',
            matched_by: 'title_delimiter',
          };
        }
      }
    }
  }

  // 3. Text pattern
  const matchPattern = combined.match(
    /(?:presencial em|local:\s*|no\s+|na\s+|em\s+)([A-ZÀ-ÿ][A-Za-zÀ-ÿ0-9\s'&.-]{2,32})(?:,|\.|\s+-|\s+no\s+rio|\s+rj)/i
  );
  if (matchPattern && matchPattern[1]) {
    const rawMatch = matchPattern[1].trim();
    if (rawMatch.length >= 3 && !/^(rio|brasil|janeiro|hoje|amanh[aã])/i.test(rawMatch)) {
      return {
        venue_name: rawMatch,
        neighborhood: 'Rio de Janeiro',
        matched_by: 'text_pattern',
      };
    }
  }

  return null;
}

export function inferDraftFromUrlSlug(
  urlStr: string
): Partial<NightlifeEventDraft> | null {
  try {
    const parsed = new URL(urlStr);
    const slug = parsed.pathname.replace(/\/\d+$/, '').split('/').filter(Boolean).pop() || '';
    if (!slug || slug.length < 5) return null;

    const words = slug.split(/[-_]+/).filter(Boolean);
    const slugText = words.join(' ');

    const venueInfo = inferVenueAndNeighborhood(slugText, '', urlStr);
    const venueName = venueInfo ? venueInfo.venue_name : 'Local no Rio de Janeiro';
    const neighborhood = venueInfo ? venueInfo.neighborhood : 'Rio de Janeiro';

    const now = new Date();
    const currentYear = now.getFullYear();
    let eventDate = getRioTodayIso();
    const dateMatch = slug.match(/(\d{1,2})-(\d{1,2})(?:-(\d{4}))?/);
    if (dateMatch) {
      const d = parseInt(dateMatch[1], 10);
      const m = parseInt(dateMatch[2], 10);
      const y = dateMatch[3] ? parseInt(dateMatch[3], 10) : currentYear;
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
        eventDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }

    const venueLowerWords = venueInfo
      ? venueInfo.venue_name.toLowerCase().split(/\s+/)
      : [];
    const cleanWords = words
      .filter(
        (w) =>
          !/^\d+$/.test(w) &&
          w.toLowerCase() !== 'rio' &&
          w.toLowerCase() !== 'rj' &&
          !venueLowerWords.includes(w.toLowerCase())
      )
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
    const titleCore = cleanWords.join(' ') || 'Evento na Noite Carioca';
    const finalTitle = venueInfo ? `${titleCore} | ${venueName}` : titleCore;

    return {
      title: finalTitle,
      venue_name: venueName,
      neighborhood,
      event_date: eventDate,
      start_time: '20:00',
      ticket_url: urlStr,
      short_summary: `Ingressos e programação oficial para ${finalTitle} em ${venueName} (${neighborhood}).`,
      source_url: urlStr,
    };
  } catch {
    return null;
  }
}
