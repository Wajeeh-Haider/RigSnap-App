import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// Configure how notifications are handled when received
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export interface PushNotificationData {
  type: 'new_request' | 'request_accepted' | 'request_cancelled' | 'message';
  requestId?: string;
  title: string;
  body: string;
  data?: any;
}

/**
 * Register for push notifications and get the token
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }
    
    try {
      // Get the project ID from Expo config
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
      
      if (!projectId) {
        console.log('Project ID not found, using legacy method');
        token = (await Notifications.getExpoPushTokenAsync()).data;
      } else {
        token = (await Notifications.getExpoPushTokenAsync({
          projectId,
        })).data;
      }
      
      console.log('Push notification token:', token);
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

/**
 * Update user's push token in the database
 */
export async function updateUserPushToken(userId: string, token: string | null): Promise<void> {
  try {
    const { error } = await supabase
      .from('users')
      .update({ push_token: token })
      .eq('id', userId);

    if (error) {
      console.error('Error updating push token:', error);
      throw error;
    }

    console.log('Successfully updated push token for user:', userId);
  } catch (error) {
    console.error('Failed to update push token:', error);
    throw error;
  }
}

/**
 * Initialize push notifications for a user
 */
export async function initializePushNotifications(userId: string): Promise<void> {
  try {
    const token = await registerForPushNotificationsAsync();
    
    if (token) {
      await updateUserPushToken(userId, token);
    } else {
      console.log('No push token available');
    }
  } catch (error) {
    console.error('Error initializing push notifications:', error);
  }
}

/**
 * Handle notification received while app is open
 */
export function setupNotificationHandlers() {
  // Handle notification received while app is foregrounded
  const notificationListener = Notifications.addNotificationReceivedListener(notification => {
    console.log('Notification received while app open:', notification);
    // You can customize behavior here - show custom alert, update app state, etc.
  });

  // Handle user tapping on notification
  const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
    console.log('Notification tapped:', response);
    
    const data = response.notification.request.content.data;
    
    // Handle different notification types
    if (data?.type === 'new_request' && data?.requestId) {
      // Navigate to request detail or requests list
      console.log('Navigate to request:', data.requestId);
    } else if (data?.type === 'message' && data?.requestId) {
      // Navigate to chat
      console.log('Navigate to chat:', data.requestId);
    }
  });

  return () => {
    notificationListener.remove();
    responseListener.remove();
  };
}

/**
 * Send a local notification (for testing)
 */
export async function sendLocalNotification(title: string, body: string, data?: any): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
    },
    trigger: null, // Send immediately
  });
}