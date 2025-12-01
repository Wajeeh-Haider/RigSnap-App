import AsyncStorage from '@react-native-async-storage/async-storage';

interface OTPData {
  email: string;
  otp: string;
  expiresAt: number;
  attempts: number;
}

class OTPService {
  private readonly STORAGE_KEY = 'pending_otps';
  private readonly OTP_EXPIRY_MINUTES = 10;
  private readonly MAX_ATTEMPTS = 3;

  // Generate 6-digit OTP
  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Store OTP locally with expiration
  async storeOTP(email: string, otp: string): Promise<void> {
    const otpData: OTPData = {
      email,
      otp,
      expiresAt: Date.now() + (this.OTP_EXPIRY_MINUTES * 60 * 1000),
      attempts: 0,
    };

    try {
      const existingOTPs = await this.getPendingOTPs();
      const updatedOTPs = {
        ...existingOTPs,
        [email]: otpData,
      };
      
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedOTPs));
    } catch (error) {
      console.error('Error storing OTP:', error);
      throw new Error('Failed to store OTP');
    }
  }

  // Get all pending OTPs
  async getPendingOTPs(): Promise<Record<string, OTPData>> {
    try {
      const data = await AsyncStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error getting pending OTPs:', error);
      return {};
    }
  }

  // Verify OTP (without consuming it immediately)
  async verifyOTP(email: string, inputOTP: string): Promise<{ success: boolean; error?: string }> {
    try {
      const pendingOTPs = await this.getPendingOTPs();
      const otpData = pendingOTPs[email];

      if (!otpData) {
        return { success: false, error: 'No OTP found for this email' };
      }

      // Check if expired
      if (Date.now() > otpData.expiresAt) {
        await this.clearOTP(email);
        return { success: false, error: 'OTP has expired' };
      }

      // Check attempts
      if (otpData.attempts >= this.MAX_ATTEMPTS) {
        await this.clearOTP(email);
        return { success: false, error: 'Too many attempts. Please request a new OTP' };
      }

      // Verify OTP
      if (otpData.otp === inputOTP) {
        // Don't clear OTP yet - let the caller clear it after successful user verification
        return { success: true };
      } else {
        // Increment attempts only on wrong OTP
        otpData.attempts += 1;
        await this.storeOTP(email, otpData.otp);
        return { success: false, error: 'Invalid OTP code' };
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return { success: false, error: 'Failed to verify OTP' };
    }
  }

  // Clear OTP after successful verification (to be called by auth context)
  async consumeOTP(email: string): Promise<void> {
    await this.clearOTP(email);
  }

  // Clear OTP for email
  async clearOTP(email: string): Promise<void> {
    try {
      const pendingOTPs = await this.getPendingOTPs();
      delete pendingOTPs[email];
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(pendingOTPs));
    } catch (error) {
      console.error('Error clearing OTP:', error);
    }
  }

  // Send OTP via Email API (React Native compatible)
  async sendOTP(email: string, otp: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`Sending OTP ${otp} to ${email}`);
      
      // Email template data
      const emailData = {
        to: email,
        subject: 'Your RigSnap Verification Code',
        html: this.getEmailTemplate(otp),
        from: 'RigSnap <noreply@rigsnap.com>',
      };

      // Try using your backend API to send emails (recommended approach)
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
      if (backendUrl) {
        try {
          const response = await fetch(`${backendUrl}/api/send-otp`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: email,
              otp: otp,
              template: 'verification',
            }),
          });

          if (response.ok) {
            console.log('OTP sent successfully via backend');
            return { success: true };
          } else {
            console.log('Backend email API failed, falling back to development mode');
          }
        } catch (backendError) {
          console.log('Backend not available, falling back to development mode');
        }
      }

      // Fallback: Development mode - show OTP in console
      console.log('=== DEVELOPMENT MODE - OTP EMAIL ===');
      console.log(`📧 TO: ${email}`);
      console.log(`🔢 OTP CODE: ${otp}`);
      console.log(`⏰ EXPIRES IN: ${this.OTP_EXPIRY_MINUTES} minutes`);
      console.log('====================================');
      console.log('📱 Use the OTP code above to verify in your app');
      console.log('💡 For production, set up email sending via your backend API');
      
      return { success: true };
    } catch (error: any) {
      console.error('Error sending OTP email:', error);
      return { success: false, error: 'Failed to send OTP email' };
    }
  }

  // Generate complete OTP flow
  async generateAndSendOTP(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const otp = this.generateOTP();
      
      // Store OTP
      await this.storeOTP(email, otp);
      
      // Send OTP
      const sendResult = await this.sendOTP(email, otp);
      
      return sendResult;
    } catch (error) {
      console.error('Error in OTP flow:', error);
      return { success: false, error: 'Failed to generate and send OTP' };
    }
  }

  // Email template
  private getEmailTemplate(otp: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Your RigSnap Verification Code</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #4CAF50; font-size: 28px; margin-bottom: 10px;">RigSnap</h1>
              <h2 style="color: #333; font-size: 24px;">Verify Your Email</h2>
            </div>
            
            <div style="margin-bottom: 30px;">
              <p>Hello,</p>
              <p>Thank you for signing up for RigSnap! To complete your registration, please enter this 6-digit verification code in the app:</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="display: inline-block; background-color: #f0f9ff; border: 2px solid #4CAF50; border-radius: 8px; padding: 20px 30px;">
                <div style="font-size: 32px; font-weight: bold; color: #4CAF50; letter-spacing: 4px;">${otp}</div>
              </div>
            </div>
            
            <div style="text-align: center; margin: 20px 0;">
              <p style="color: #666; font-size: 14px;">This code will expire in ${this.OTP_EXPIRY_MINUTES} minutes</p>
            </div>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-top: 20px;">
              <p><strong>Security Note:</strong></p>
              <ul style="color: #666; font-size: 14px;">
                <li>Never share this code with anyone</li>
                <li>RigSnap will never ask for this code via phone or email</li>
                <li>If you didn't request this code, please ignore this email</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 14px;">
              <p>This email was sent by RigSnap</p>
            </div>
            
          </div>
        </body>
      </html>
    `;
  }
}

export const otpService = new OTPService();