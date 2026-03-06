import { forwardRef, useImperativeHandle, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface MapViewRef {
  animateToRegion: (region: Region) => void;
}

interface MapViewProps {
  style?: any;
  initialRegion?: Region;
  region?: Region;
  onRegionChangeComplete?: (region: Region) => void;
  children?: ReactNode;
}

const MapView = forwardRef<MapViewRef, MapViewProps>(function MapViewWeb(props, ref) {
  useImperativeHandle(
    ref,
    () => ({
      animateToRegion: (region: Region) => {
        props.onRegionChangeComplete?.(region);
      }
    }),
    [props]
  );

  return (
    <View style={[styles.wrap, props.style]}>
      <Text style={styles.title}>Map preview is available on iOS/Android builds.</Text>
      <Text style={styles.subtitle}>Continue with address search and pin flow.</Text>
    </View>
  );
});

interface MarkerProps {
  coordinate: { latitude: number; longitude: number };
  title?: string;
  pinColor?: string;
}

export function Marker(_props: MarkerProps) {
  return null;
}

interface PolylineProps {
  coordinates: Array<{ latitude: number; longitude: number }>;
  strokeColor?: string;
  strokeWidth?: number;
}

export function Polyline(_props: PolylineProps) {
  return null;
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0'
  },
  title: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '600'
  },
  subtitle: {
    marginTop: 4,
    color: '#334155',
    fontSize: 12
  }
});

export default MapView;
