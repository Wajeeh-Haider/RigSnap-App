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

// Make debug functions available globally for testing
if (__DEV__) {
  global.testUserNotification = async (userId: string = '28d8549c-b466-4e69-9356-88cb46fd88a9') => {
    const { testUserNotification } = require('@/utils/pushNotifications');
    await testUserNotification(userId);
  };
}

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
      console.log('Requesting push notification permissions...');
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: true,
        },
        android: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        }
      });
      finalStatus = status;
      console.log('Push notification permission result:', finalStatus);
    } else {
      console.log('Push notifications already granted');
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification! Status:', finalStatus);
      return null;
    }
    
    try {
      // Get the project ID from Expo config - for FCM V1, we need the project ID
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
      
      if (!projectId) {
        console.log('⚠️ Project ID not found, this may cause FCM issues');
        token = (await Notifications.getExpoPushTokenAsync()).data;
      } else {
        console.log('📱 Using project ID for FCM V1:', projectId);
        token = (await Notifications.getExpoPushTokenAsync({
          projectId,
        })).data;
      }
      
      console.log('✅ FCM/Expo push notification token generated:', token);
    } catch (error) {
      console.error('❌ Error getting push token:', error);
      return null;
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

/**
 * Debug function to test push notification delivery for a specific user
 */
export async function testPushNotificationDelivery(userId: string): Promise<void> {
  try {
    console.log('🧪 TESTING push notification delivery for user:', userId);
    
    // Get user's current push token from database
    const { data: userData, error } = await supabase
      .from('users')
      .select('id, name, email, push_token')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('❌ Error fetching user data:', error);
      return;
    }
    
    if (!userData.push_token) {
      console.log('❌ No push token found for user');
      return;
    }
    
    console.log('📱 Testing notification delivery to:', userData.name);
    console.log('📝 Token preview:', userData.push_token.substring(0, 50) + '...');
    
    // Send test notification directly to Expo push API
    const message = {
      to: userData.push_token,
      sound: 'default',
      title: '🧪 RigSnap Test',
      body: `Test notification for ${userData.name} - ${new Date().toLocaleTimeString()}`,
      data: {
        type: 'debug_test',
        userId: userId,
        timestamp: Date.now()
      },
      priority: 'high',
      badge: 1,
    };
    
    console.log('🚀 Sending test notification...');
    
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    
    const result = await response.json();
    console.log('📤 Expo Push API Response:', result);
    
    if (result.data && result.data[0]) {
      const notificationResult = result.data[0];
      console.log('📊 Notification status:', notificationResult.status);
      
      if (notificationResult.status === 'ok') {
        console.log('✅ Notification accepted by Expo servers');
        console.log('📱 Check device for notification (may take a few seconds)');
      } else {
        console.log('❌ Notification rejected:', notificationResult.message || 'Unknown error');
        console.log('🔍 Details:', notificationResult.details || 'No details available');
      }
    } else {
      console.log('❌ Unexpected response format:', result);
    }
    
  } catch (error) {
    console.error('❌ Test notification error:', error);
  }
}

/**
 * Quick test function - call this in React Native console to test user's notifications
 * Usage: testUserNotification('28d8549c-b466-4e69-9356-88cb46fd88a9')
 */
export async function testUserNotification(userId: string = '28d8549c-b466-4e69-9356-88cb46fd88a9'): Promise<void> {
  console.log('🔧 QUICK TEST for user:', userId);
  
  // Test both debug check and delivery test
  await debugCheckPushToken(userId);
  await testPushNotificationDelivery(userId);
  
  console.log('✅ Debug test completed - check console logs above');
}

/**
 * Debug function to check if push token is saved in database
 */
export async function debugCheckPushToken(userId: string): Promise<void> {
  try {
    console.log('🔍 DEBUG: Checking push token in database for user:', userId);
    
    const { data, error } = await supabase
      .from('users')
      .select('id, email, push_token')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('❌ DEBUG: Error fetching user data:', error);
      return;
    }
    
    console.log('📊 DEBUG: User data from database:');
    console.log('  - ID:', data.id);
    console.log('  - Email:', data.email);
    console.log('  - Push Token:', data.push_token ? 'present' : 'missing');
    
    if (data.push_token) {
      console.log('  - Token Preview:', data.push_token.substring(0, 50) + '...');
    }
  } catch (error) {
    console.error('❌ DEBUG: Exception checking push token:', error);
  }
}

/**
 * Check if push notifications are enabled for a user
 */
export async function checkUserPushNotificationStatus(userId: string): Promise<{
  hasToken: boolean;
  permissionGranted: boolean;
  token?: string | null;
}> {
  try {
    // Check database for existing token
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('push_token')
      .eq('id', userId)
      .single();
    
    if (fetchError) {
      console.error('Error fetching user push token:', fetchError);
    }
    
    // Check device permissions
    const { status } = await Notifications.getPermissionsAsync();
    const permissionGranted = status === 'granted';
    
    return {
      hasToken: Boolean(userData?.push_token),
      permissionGranted,
      token: userData?.push_token || null,
    };
  } catch (error) {
    console.error('Error checking push notification status:', error);
    return {
      hasToken: false,
      permissionGranted: false,
      token: null,
    };
  }
}

/**
 * Update user's push token in the database
 */
export async function updateUserPushToken(userId: string, token: string | null): Promise<void> {
  try {
    console.log('Updating push token for user:', userId, 'Token:', token ? 'present' : 'null');
    
    const { data, error } = await supabase
      .from('users')
      .update({ push_token: token })
      .eq('id', userId)
      .select('push_token');

    if (error) {
      console.error('Error updating push token:', error);
      throw error;
    }

    console.log('Successfully updated push token for user:', userId);
    console.log('Updated data:', data);
  } catch (error) {
    console.error('Failed to update push token:', error);
    throw error;
  }
}

/**
 * Initialize push notifications for a user
 * Checks if user already has a push token in DB, and only requests permissions if needed
 */
export async function initializePushNotifications(userId: string): Promise<void> {
  try {
    console.log('🔔 Initializing push notifications for user:', userId);
    
    // First check if user already has a valid push token in the database
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('push_token')
      .eq('id', userId)
      .single();
    
    if (fetchError) {
      console.error('❌ Error fetching user push token:', fetchError);
      // Continue with registration anyway
    }
    
    const existingToken = userData?.push_token;
    console.log('📋 Existing push token in DB:', existingToken ? 'present' : 'none');
    
    // If user already has a push token, check if it's still valid
    if (existingToken) {
      console.log('✅ User already has push token, checking if still valid');
      // For now, we'll always get a fresh token to ensure it's current
      // In a production app, you might want to validate the existing token first
    }
    
    console.log('🔐 Requesting push notification permissions...');
    // Always try to get/refresh the push token
    const token = await registerForPushNotificationsAsync();
    
    if (token) {
      console.log('✅ Successfully obtained push token');
      // Only update if the token is different from what's stored
      if (token !== existingToken) {
        console.log('💾 Updating user with new push token');
        await updateUserPushToken(userId, token);
      } else {
        console.log('⚡ Push token unchanged, no update needed');
      }
    } else {
      console.log('❌ No push token available - permissions denied or device issue');
      // Clear the token in DB if permission was revoked
      if (existingToken) {
        console.log('🗑️ Clearing revoked push token from database');
        await updateUserPushToken(userId, null);
      }
    }
  } catch (error) {
    console.error('❌ Error initializing push notifications:', error);
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