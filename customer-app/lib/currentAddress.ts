import * as Location from 'expo-location';

function uniqueParts(parts: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const part of parts) {
    const value = (part ?? '').trim();
    if (!value) continue;
    if (out.some((item) => item.toLowerCase() === value.toLowerCase())) continue;
    out.push(value);
  }
  return out;
}

export function formatGeocodedAddress(place: Location.LocationGeocodedAddress | undefined): string {
  if (!place) return '';
  const street = [place.streetNumber, place.street].filter(Boolean).join(' ').trim();
  return uniqueParts([street || place.name, place.district, place.city, place.subregion, place.region, place.postalCode]).join(', ');
}

export async function readCurrentAddress(): Promise<
  | { ok: true; address: string; latitude: number; longitude: number }
  | { ok: false; error: string }
> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return { ok: false, error: 'Location permission denied.' };
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const latitude = pos.coords.latitude;
    const longitude = pos.coords.longitude;
    let address = '';
    try {
      const places = await Location.reverseGeocodeAsync({ latitude, longitude });
      address = formatGeocodedAddress(places[0]);
    } catch {
      address = '';
    }
    if (!address) address = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    return { ok: true, address, latitude, longitude };
  } catch {
    return { ok: false, error: 'Could not get your current location.' };
  }
}
