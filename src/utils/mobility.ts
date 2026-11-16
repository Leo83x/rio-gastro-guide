/**
 * Utility for Ride-Hailing deep links and mobile app intents (Uber, 99 / DiDi, Google Maps)
 */

export interface RideCoordinates {
  latitude: number;
  longitude: number;
  name: string;
  userLat?: number | null;
  userLon?: number | null;
}

export function buildUberUrl(coords: RideCoordinates): string {
  const dropoffNick = encodeURIComponent(coords.name);
  if (coords.userLat != null && coords.userLon != null) {
    return `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${coords.userLat}&pickup[longitude]=${coords.userLon}&dropoff[latitude]=${coords.latitude}&dropoff[longitude]=${coords.longitude}&dropoff[nickname]=${dropoffNick}`;
  }
  return `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${coords.latitude}&dropoff[longitude]=${coords.longitude}&dropoff[nickname]=${dropoffNick}`;
}

export function buildGoogleMapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

export function buildNineNineUrl(coords: RideCoordinates): string {
  const refLat = coords.userLat ?? -22.9068;
  const refLon = coords.userLon ?? -43.1729;
  const dropLat = coords.latitude;
  const dropLon = coords.longitude;
  const dropTitle = encodeURIComponent(coords.name);
  const pickTitle = encodeURIComponent('Local de Partida');

  const rawParams = `pickup_latitude=${refLat}&pickup_longitude=${refLon}&pickup_title=${pickTitle}&dropoff_latitude=${dropLat}&dropoff_longitude=${dropLon}&dropoff_title=${dropTitle}&deep_link_product_id=316`;

  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);

  if (isAndroid) {
    return `intent://call?${rawParams}#Intent;scheme=taxis99;package=com.taxis99;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.taxis99;end`;
  }

  return `taxis99://call?${rawParams}&client_id=MAP_BORARIO`;
}

export function launchNineNineRide(coords: RideCoordinates): void {
  if (typeof window === 'undefined') return;

  const isAndroid = /android/i.test(navigator.userAgent);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const nineNineUrl = buildNineNineUrl(coords);

  if (isAndroid) {
    window.location.href = nineNineUrl;
    return;
  }

  if (isIOS) {
    const timer = window.setTimeout(() => {
      window.location.href = 'https://apps.apple.com/br/app/99-motorista-carro-e-moto/id553663691';
    }, 1800);
    window.addEventListener('pagehide', () => window.clearTimeout(timer), { once: true });
    window.location.href = nineNineUrl;
    return;
  }

  // Desktop or web fallback
  try {
    window.location.href = nineNineUrl;
  } catch {
    window.open(buildGoogleMapsUrl(coords.latitude, coords.longitude), '_blank');
  }
}
