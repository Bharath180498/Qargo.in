import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import appConfig from '../../app.json';
import api from './api';

let expoGoPushWarned = false;

function isExpoGoPushUnsupported(error: unknown) {
  const message = String((error as { message?: string })?.message ?? error ?? '').toLowerCase();
  return message.includes('expo go') && message.includes('push') && message.includes('removed');
}

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false
    })
  });
} catch (error) {
  if (!isExpoGoPushUnsupported(error)) {
    console.warn('Driver notification handler setup failed:', error);
  }
}

let registeredDriverId: string | undefined;
let registeredToken: string | undefined;

function appVersion() {
  const version = (appConfig as { expo?: { version?: unknown } }).expo?.version;
  return typeof version === 'string' ? version : undefined;
}

function expoProjectId() {
  const extra = (appConfig as { expo?: { extra?: { eas?: { projectId?: unknown }; expoProjectId?: unknown } } })
    .expo?.extra;
  const easProjectId = extra?.eas?.projectId;
  if (typeof easProjectId === 'string' && easProjectId.trim()) {
    return easProjectId.trim();
  }

  const legacyProjectId = extra?.expoProjectId;
  if (typeof legacyProjectId === 'string' && legacyProjectId.trim()) {
    return legacyProjectId.trim();
  }

  return undefined;
}

async function getPushToken() {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 220, 220, 220]
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    const existingPermission = existing as { granted?: boolean; status?: string };
    let granted = existingPermission.granted === true || existingPermission.status === 'granted';

    if (!granted) {
      const requested = await Notifications.requestPermissionsAsync();
      const requestedPermission = requested as { granted?: boolean; status?: string };
      granted = requestedPermission.granted === true || requestedPermission.status === 'granted';
    }

    if (!granted) {
      return null;
    }

    const projectId = expoProjectId();
    const token = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch (error) {
    if (isExpoGoPushUnsupported(error)) {
      if (!expoGoPushWarned) {
        console.info('Driver push registration skipped in Expo Go Android. Use a development build for push testing.');
        expoGoPushWarned = true;
      }
      return null;
    }
    console.warn('Driver push token registration skipped:', error);
    return null;
  }
}

export async function ensureDriverPushRegistered(driverId: string) {
  if (!driverId) {
    return null;
  }

  const token = await getPushToken();
  if (!token) {
    return null;
  }

  if (registeredDriverId === driverId && registeredToken === token) {
    return token;
  }

  await api.post('/notifications/tokens/driver/register', {
    driverId,
    token,
    platform: Platform.OS,
    appVersion: appVersion()
  });

  registeredDriverId = driverId;
  registeredToken = token;
  return token;
}

export async function unregisterDriverPushToken(driverId?: string) {
  if (!registeredToken) {
    return;
  }

  const activeDriverId = driverId ?? registeredDriverId;
  if (!activeDriverId) {
    registeredToken = undefined;
    registeredDriverId = undefined;
    return;
  }

  try {
    await api.post('/notifications/tokens/driver/unregister', {
      driverId: activeDriverId,
      token: registeredToken
    });
  } catch (error) {
    console.warn('Driver push token unregister failed:', error);
  } finally {
    registeredToken = undefined;
    registeredDriverId = undefined;
  }
}
