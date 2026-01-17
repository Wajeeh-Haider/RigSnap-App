// Debug script to test push notification delivery
// Run this in React Native to debug push notification issues

import { supabase } from './lib/supabase';
import * as Notifications from 'expo-notifications';

const DEBUG_USER_ID = '28d8549c-b466-4e69-9356-88cb46fd88a9';

export async function debugPushNotification() {
  console.log('🔍 DEBUGGING PUSH NOTIFICATION FOR USER:', DEBUG_USER_ID);
  
  try {
    // 1. Check user's push token in database
    const { data: userData, error } = await supabase
      .from('users')
      .select('id, name, email, push_token')
      .eq('id', DEBUG_USER_ID)
      .single();
    
    if (error) {
      console.error('❌ Error fetching user data:', error);
      return;
    }
    
    console.log('📊 User data:');
    console.log('  - Name:', userData.name);
    console.log('  - Email:', userData.email);
    console.log('  - Has push token:', userData.push_token ? 'YES' : 'NO');
    
    if (userData.push_token) {
      console.log('  - Token preview:', userData.push_token.substring(0, 50) + '...');
      
      // 2. Test sending a direct push notification
      console.log('🚀 Testing direct push notification...');
      
      const message = {
        to: userData.push_token,
        sound: 'default',
        title: '🧪 Test Notification',
        body: 'This is a test notification to debug delivery issues.',
        data: {
          type: 'test',
          timestamp: Date.now()
        },
        priority: 'high',
        badge: 1,
      };
      
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
      console.log('📤 Push API Response:', result);
      
      if (result.data) {
        console.log('✅ Notification sent to Expo servers');
        console.log('📱 Check if notification appears on device');
      } else {
        console.log('❌ Failed to send notification');
      }
    }
    
    // 3. Check device notification permissions
    console.log('🔐 Checking device notification permissions...');
    const { status } = await Notifications.getPermissionsAsync();
    console.log('  - Permission status:', status);
    
    // 4. Generate fresh token for comparison
    console.log('🔄 Generating fresh push token...');
    try {
      const { data: freshToken } = await Notifications.getExpoPushTokenAsync({
        projectId: '0e96c672-5ce2-4215-b363-584fe13554ce'
      });
      console.log('  - Fresh token preview:', freshToken.substring(0, 50) + '...');
      console.log('  - Tokens match:', freshToken === userData.push_token ? 'YES' : 'NO');
      
      if (freshToken !== userData.push_token) {
        console.log('⚠️ TOKEN MISMATCH! Database token might be outdated');
        console.log('💾 Updating database with fresh token...');
        
        const { error: updateError } = await supabase
          .from('users')
          .update({ push_token: freshToken })
          .eq('id', DEBUG_USER_ID);
          
        if (updateError) {
          console.error('❌ Failed to update token:', updateError);
        } else {
          console.log('✅ Token updated in database');
        }
      }
    } catch (tokenError) {
      console.error('❌ Error generating fresh token:', tokenError);
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

// Call this function to debug
// debugPushNotification();