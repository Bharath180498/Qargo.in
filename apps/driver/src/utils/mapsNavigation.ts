import { Alert, Linking } from 'react-native';

interface NavigateToPointInput {
  lat: number;
  lng: number;
  originLat?: number;
  originLng?: number;
}

function formatPoint(lat: number, lng: number) {
  return `${lat},${lng}`;
}

export async function openGoogleMapsNavigation(input: NavigateToPointInput) {
  const destination = formatPoint(input.lat, input.lng);
  const hasOrigin =
    typeof input.originLat === 'number' &&
    Number.isFinite(input.originLat) &&
    typeof input.originLng === 'number' &&
    Number.isFinite(input.originLng);

  const origin = hasOrigin ? formatPoint(input.originLat!, input.originLng!) : undefined;
  const googleMapsScheme = hasOrigin
    ? `comgooglemaps://?saddr=${origin}&daddr=${destination}&directionsmode=driving`
    : `comgooglemaps://?daddr=${destination}&directionsmode=driving`;
  const googleMapsWeb = hasOrigin
    ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`
    : `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;

  try {
    const canOpenGoogleApp = await Linking.canOpenURL(googleMapsScheme);
    const targetUrl = canOpenGoogleApp ? googleMapsScheme : googleMapsWeb;
    await Linking.openURL(targetUrl);
  } catch {
    Alert.alert(
      'Navigation unavailable',
      'Could not open Google Maps. Please check if Maps app or browser is available.'
    );
  }
}
