import type { NightlifeEvent } from '../../types/nightlife';
import {
  addDaysToIsoDate,
  buildStartEndIsoRio,
  getNextWeekdayIso,
  getRioTodayIso,
} from './nightlifeDedup';

export function buildStarterCuratedNightlifeEvents(baseDate: Date = new Date()): NightlifeEvent[] {
  const today = getRioTodayIso(baseDate);
  const tomorrow = addDaysToIsoDate(today, 1);
  const friday = getNextWeekdayIso(5, baseDate);
  const saturday = getNextWeekdayIso(6, baseDate);
  const sunday = getNextWeekdayIso(0, baseDate);
  const nowIso = baseDate.toISOString();

  const makeEvent = (params: {
    id: string;
    title: string;
    sub_area: NightlifeEvent['sub_area'];
    event_date: string;
    start_time: string;
    end_time: string;
    venue_name: string;
    neighborhood: string;
    address: string;
    price_display_label: string;
    price_min_brl?: number;
    price_max_brl?: number;
    is_free?: boolean;
    music_genres: string[];
    description: string;
    ticket_url?: string;
    availability_status?: NightlifeEvent['availability_status'];
    is_featured?: boolean;
  }): NightlifeEvent => {
    const { startsAtIso, endsAtIso } = buildStartEndIsoRio(
      params.event_date,
      params.start_time,
      params.end_time
    );

    return {
      id: params.id,
      external_key: `seed-nl-${params.id}`,
      dedup_hash: `hash-${params.id}-${params.event_date}`,
      source_platform: 'MANUAL_ADMIN',
      source_url: params.ticket_url || 'https://www.sympla.com.br/eventos/rio-de-janeiro-rj',
      curation_status: 'PUBLICADO',
      is_featured: params.is_featured ?? true,
      last_verified_at: nowIso,
      sub_area: params.sub_area,
      music_genres: params.music_genres,
      moment_tags: ['nightlife', params.sub_area.toLowerCase()],
      age_rating: '18 anos',
      venue_name: params.venue_name,
      neighborhood: params.neighborhood,
      address: params.address,
      event_date: params.event_date,
      start_time: params.start_time,
      end_time: params.end_time,
      starts_at: startsAtIso,
      ends_at: endsAtIso,
      is_free: Boolean(params.is_free),
      price_min_brl: params.price_min_brl,
      price_max_brl: params.price_max_brl,
      price_display_label: params.price_display_label,
      ticket_url: params.ticket_url || 'https://www.sympla.com.br/eventos/rio-de-janeiro-rj',
      availability_status: params.availability_status || (params.is_free ? 'GRATUITO' : 'DISPONIVEL'),
      lineup: [params.venue_name],
      title: params.title,
      slug: params.id,
      short_summary: params.description,
      cover_image:
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1000&q=80',
      image_origin: 'PARTNER_AUTHORIZED',
      is_demonstrative: false,
      created_at: nowIso,
      updated_at: nowIso,
    };
  };

  return [
    // 1. ROOFTOPS & EXPERIÊNCIAS (Sexta-feira / Hoje / Fim de semana)
    makeEvent({
      id: 'rooftop-pestana-friday',
      title: 'Sunset Sessions & Jazz no Rooftop Pestana Rio Atlântica',
      sub_area: 'ROOFTOPS_EXPERIENCIAS',
      event_date: friday,
      start_time: '18:00',
      end_time: '23:30',
      venue_name: 'Deck Bar Rooftop — Hotel Pestana Rio Atlântica',
      neighborhood: 'Copacabana',
      address: 'Av. Atlântica, 2964 - Copacabana, Rio de Janeiro',
      price_display_label: 'Entrada R$ 50 · Welcome Drink',
      price_min_brl: 50,
      music_genres: ['Jazz', 'Lounge', 'House'],
      description:
        'Sexta-feira no rooftop com vista panorâmica da orla de Copacabana. Drinques autorais, show instrumental de jazz ao vivo e DJ set ao pôr do sol.',
      ticket_url: 'https://www.sympla.com.br/eventos/rio-de-janeiro-rj',
      is_featured: true,
    }),
    makeEvent({
      id: 'rooftop-xian-friday',
      title: 'Golden Hour Rooftop no Xian Bossa Nova Mall',
      sub_area: 'ROOFTOPS_EXPERIENCIAS',
      event_date: friday,
      start_time: '17:30',
      end_time: '23:00',
      venue_name: 'Xian Rio — Rooftop Lounge',
      neighborhood: 'Centro',
      address: 'Av. Alm. Silvio de Noronha, 365 - Centro, Rio de Janeiro',
      price_display_label: 'Couvert R$ 40 · Vista Pão de Açúcar',
      price_min_brl: 40,
      music_genres: ['Lounge', 'Bossa Nova', 'Deep House'],
      description:
        'Deck aberto com vista deslumbrante para a Baía de Guanabara e Pão de Açúcar. Carta de coquetéis premiada e pôr do sol inesquecível na sexta-feira carioca.',
      ticket_url: 'https://www.sympla.com.br/eventos/rio-de-janeiro-rj',
      is_featured: true,
    }),
    makeEvent({
      id: 'rooftop-selina-saturday',
      title: 'Noite Tropical no Rooftop Selina Lapa',
      sub_area: 'ROOFTOPS_EXPERIENCIAS',
      event_date: saturday,
      start_time: '19:00',
      end_time: '02:00',
      venue_name: 'Rooftop Selina Lapa',
      neighborhood: 'Lapa',
      address: 'Largo da Lapa, 9 - Lapa, Rio de Janeiro',
      price_display_label: 'Entrada R$ 35',
      price_min_brl: 35,
      music_genres: ['Brasilidades', 'Indie', 'DJs'],
      description:
        'Festa no terraço com vista privilegiada para os Arcos da Lapa. Drinques criativos, chope artesanal e clima vibrante com DJs cariocas.',
      ticket_url: 'https://www.sympla.com.br/eventos/rio-de-janeiro-rj',
    }),
    makeEvent({
      id: 'rooftop-descasados-today',
      title: 'Sunset & Coquetelaria no Bar dos Descasados',
      sub_area: 'ROOFTOPS_EXPERIENCIAS',
      event_date: today,
      start_time: '17:00',
      end_time: '23:00',
      venue_name: 'Bar dos Descasados — Hotel Santa Teresa',
      neighborhood: 'Santa Teresa',
      address: 'Rua Felício dos Santos, 15 - Santa Teresa, Rio de Janeiro',
      price_display_label: 'Consumo no Local · Vista Histórica',
      music_genres: ['Jazz', 'Bossa Lounge'],
      description:
        'Terraço histórico com arcos coloniais e pôr do sol deslumbrante sobre os morros cariocas em Santa Teresa. Carta de drinques assinada.',
      ticket_url: 'https://www.sympla.com.br/eventos/rio-de-janeiro-rj',
    }),

    // 2. SAMBA & PAGODE (Sexta / Sábado / Hoje / Gratuito)
    makeEvent({
      id: 'samba-beco-friday',
      title: 'Roda de Samba Tradicional do Beco do Rato',
      sub_area: 'SAMBA_PAGODE',
      event_date: friday,
      start_time: '20:00',
      end_time: '03:00',
      venue_name: 'Beco do Rato',
      neighborhood: 'Lapa',
      address: 'Rua Joaquim Silva, 11 - Lapa, Rio de Janeiro',
      price_display_label: 'Entrada R$ 30',
      price_min_brl: 30,
      music_genres: ['Samba de Raiz', 'Partido Alto'],
      description:
        'Um dos principais santuários do samba tradicional carioca na Lapa. Música de raiz na palma da mão, cerveja gelada e petiscos autênticos.',
      ticket_url: 'https://www.sympla.com.br/eventos/rio-de-janeiro-rj',
      is_featured: true,
    }),
    makeEvent({
      id: 'samba-pedra-do-sal-friday',
      title: 'Roda de Samba Histórica da Pedra do Sal',
      sub_area: 'SAMBA_PAGODE',
      event_date: friday,
      start_time: '19:00',
      end_time: '01:00',
      venue_name: 'Largo da Pedra do Sal',
      neighborhood: 'Saúde',
      address: 'Rua Argemiro Bulcão - Saúde, Rio de Janeiro',
      price_display_label: 'Gratuito · Na Rua',
      is_free: true,
      availability_status: 'GRATUITO',
      music_genres: ['Samba de Raiz', 'Choro'],
      description:
        'O berço sagrado do samba carioca sob a rocha centenária da Saúde. Evento de rua gratuito com energia contagiante, roda ao vivo e caipirinhas.',
      ticket_url: 'https://www.sympla.com.br/eventos/rio-de-janeiro-rj',
      is_featured: true,
    }),
    makeEvent({
      id: 'samba-rio-scenarium-saturday',
      title: 'Feijoada com Samba de Raiz no Rio Scenarium',
      sub_area: 'SAMBA_PAGODE',
      event_date: saturday,
      start_time: '13:00',
      end_time: '19:00',
      venue_name: 'Rio Scenarium Pavilhão da Cultura',
      neighborhood: 'Lapa',
      address: 'Rua do Lavradio, 20 - Lapa, Rio de Janeiro',
      price_display_label: 'Entrada R$ 45 · Buffet Feijoada',
      price_min_brl: 45,
      music_genres: ['Samba', 'Choro', 'MPB'],
      description:
        'A tradicional feijoada de sábado no casarão de antiguidades mais famoso da Lapa. Roda de samba de alta qualidade e ambiente imersivo.',
      ticket_url: 'https://www.sympla.com.br/eventos/rio-de-janeiro-rj',
    }),
    makeEvent({
      id: 'samba-beco-today',
      title: 'Samba dos Amigos no Beco do Rato',
      sub_area: 'SAMBA_PAGODE',
      event_date: today,
      start_time: '19:30',
      end_time: '01:30',
      venue_name: 'Beco do Rato',
      neighborhood: 'Lapa',
      address: 'Rua Joaquim Silva, 11 - Lapa, Rio de Janeiro',
      price_display_label: 'Entrada R$ 25',
      price_min_brl: 25,
      music_genres: ['Samba de Raiz'],
      description: 'Programação de samba autêntico para aquecer a noite no Beco do Rato.',
      ticket_url: 'https://www.sympla.com.br/eventos/rio-de-janeiro-rj',
    }),

    // 3. FESTAS & BALADAS (Sexta / Sábado)
    makeEvent({
      id: 'festa-bosque-friday',
      title: 'Festa Rio Sunset & DJs no Bosque Bar',
      sub_area: 'FESTAS_BALADAS',
      event_date: friday,
      start_time: '22:00',
      end_time: '05:00',
      venue_name: 'Bosque Bar',
      neighborhood: 'Gávea',
      address: 'Praça Santos Dumont, 31 - Gávea, Rio de Janeiro',
      price_display_label: 'A partir de R$ 60',
      price_min_brl: 60,
      music_genres: ['Eletrônica', 'Pop', 'Funk'],
      description:
        'Balada ao ar livre no Jockey Club com vista para o Cristo Redentor. Pista animada, grandes DJs cariocas e drinques premium.',
      ticket_url: 'https://www.sympla.com.br/eventos/rio-de-janeiro-rj',
      is_featured: true,
    }),
    makeEvent({
      id: 'festa-circo-friday',
      title: 'Baile do Circo sob os Arcos da Lapa',
      sub_area: 'FESTAS_BALADAS',
      event_date: friday,
      start_time: '23:00',
      end_time: '05:00',
      venue_name: 'Circo Voador',
      neighborhood: 'Lapa',
      address: 'Rua dos Arcos, s/n - Lapa, Rio de Janeiro',
      price_display_label: 'R$ 50 (1º lote)',
      price_min_brl: 50,
      music_genres: ['Brasilidades', 'Indie', 'Funk Carioca'],
      description:
        'A pista clássica e aberta do Circo Voador recebendo festa noturna com coletivos musicais cariocas e brasilidades.',
      ticket_url: 'https://www.sympla.com.br/eventos/rio-de-janeiro-rj',
    }),
    makeEvent({
      id: 'festa-galeria-saturday',
      title: 'Noite Pop & Brasilidades no Galeria Café',
      sub_area: 'FESTAS_BALADAS',
      event_date: saturday,
      start_time: '23:00',
      end_time: '05:30',
      venue_name: 'Galeria Café Rio',
      neighborhood: 'Ipanema',
      address: 'Rua Teixeira de Melo, 31 - Ipanema, Rio de Janeiro',
      price_display_label: 'R$ 40 na lista',
      price_min_brl: 40,
      music_genres: ['Pop', 'Hits', 'Eletrônica'],
      description: 'Clube icônico de Ipanema com pista agitada, coquetelaria caprichada e público cosmopolita.',
      ticket_url: 'https://www.sympla.com.br/eventos/rio-de-janeiro-rj',
    }),

    // 4. SHOWS (Sexta / Sábado / Hoje)
    makeEvent({
      id: 'show-circo-friday',
      title: 'Show Especial de MPB & Samba no Circo Voador',
      sub_area: 'SHOWS',
      event_date: friday,
      start_time: '21:00',
      end_time: '02:00',
      venue_name: 'Circo Voador',
      neighborhood: 'Lapa',
      address: 'Rua dos Arcos, s/n - Lapa, Rio de Janeiro',
      price_display_label: 'Ingressos a partir de R$ 70',
      price_min_brl: 70,
      music_genres: ['MPB', 'Samba', 'Rock Nacional'],
      description:
        'Noite de show ao vivo sob a lona mais celebrada da música brasileira na Lapa. Grandes nomes da música e plateia apaixonada.',
      ticket_url: 'https://www.sympla.com.br/eventos/rio-de-janeiro-rj',
      is_featured: true,
    }),
    makeEvent({
      id: 'show-fundicao-saturday',
      title: 'Grandes Encontros Musicais na Fundição Progresso',
      sub_area: 'SHOWS',
      event_date: saturday,
      start_time: '22:00',
      end_time: '04:00',
      venue_name: 'Fundição Progresso',
      neighborhood: 'Lapa',
      address: 'Rua dos Arcos, 24 - Lapa, Rio de Janeiro',
      price_display_label: 'R$ 60 (Meia solidária)',
      price_min_brl: 60,
      music_genres: ['MPB', 'Reggae', 'Rap'],
      description: 'Festival de música e apresentações ao vivo no lendário pavilhão cultural da Lapa.',
      ticket_url: 'https://www.sympla.com.br/eventos/rio-de-janeiro-rj',
    }),
    makeEvent({
      id: 'show-municipal-today',
      title: 'Série Noturna Instrumental no Theatro Municipal',
      sub_area: 'SHOWS',
      event_date: today,
      start_time: '20:00',
      end_time: '22:15',
      venue_name: 'Theatro Municipal do Rio de Janeiro',
      neighborhood: 'Centro',
      address: 'Praça Floriano, s/n - Cinelândia, Centro',
      price_display_label: 'A partir de R$ 20',
      price_min_brl: 20,
      music_genres: ['Música Clássica', 'Instrumental'],
      description:
        'Apresentação de gala noturna no monumento histórico mais deslumbrante da Cinelândia.',
      ticket_url: 'https://www.sympla.com.br/eventos/rio-de-janeiro-rj',
    }),
    makeEvent({
      id: 'rooftop-selina-tomorrow',
      title: 'Amanhã Sunset Sessions — Rooftop Selina Lapa',
      sub_area: 'ROOFTOPS_EXPERIENCIAS',
      event_date: tomorrow,
      start_time: '18:00',
      end_time: '23:30',
      venue_name: 'Rooftop Selina Lapa',
      neighborhood: 'Lapa',
      address: 'Largo da Lapa, 9 - Lapa, Rio de Janeiro',
      price_display_label: 'Entrada Franca',
      is_free: true,
      music_genres: ['House', 'Nu-Disco'],
      description:
        'Sunset com vista para os Arcos da Lapa, coquetelaria autoral e clima descontraído.',
      ticket_url: 'https://www.sympla.com.br/eventos/rio-de-janeiro-rj',
    }),
    makeEvent({
      id: 'samba-pedra-sunday',
      title: 'Domingo Tradicional na Pedra do Sal',
      sub_area: 'SAMBA_PAGODE',
      event_date: sunday,
      start_time: '17:00',
      end_time: '23:00',
      venue_name: 'Pedra do Sal',
      neighborhood: 'Saúde',
      address: 'Rua Argemiro Bulcão - Saúde, Rio de Janeiro',
      price_display_label: 'Gratuito',
      is_free: true,
      music_genres: ['Samba de Raiz'],
      description:
        'O berço sagrado do samba carioca reunindo músicos locais e público sob céu aberto.',
      ticket_url: 'https://www.sympla.com.br/eventos/rio-de-janeiro-rj',
    }),
  ];
}
