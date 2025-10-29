import * as React from 'react';
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import {
  ArrowLeft,
  Bell,
  Mail,
  MessageSquare,
  Shield,
  Moon,
  Globe,
  CircleHelp as HelpCircle,
  ChevronRight,
  Check,
  Key,
  Lock,
  Eye,
  EyeOff,
  X,
  Trash2,
  TriangleAlert as AlertTriangle,
} from 'lucide-react-native';

interface NotificationSettings {
  pushNotifications: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  requestUpdates: boolean;
  marketingEmails: boolean;
  securityAlerts: boolean;
}

export default function AccountSettingsScreen() {
  const { user } = useAuth();
  const { isDarkMode, toggleDarkMode, colors } = useTheme();
  const { currentLanguage, setLanguage, languages, getCurrentLanguage } =
    useLanguage();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<NotificationSettings>({
    pushNotifications: true,
    emailNotifications: true,
    smsNotifications: false,
    requestUpdates: true,
    marketingEmails: false,
    securityAlerts: true,
  });

  // Password change state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Language selection state
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  if (!user) return null;

  const updateNotificationSetting = (
    key: keyof NotificationSettings,
    value: boolean
  ) => {
    setNotifications((prev) => ({ ...prev, [key]: value }));
    Alert.alert(
      'Settings Updated',
      `${key.replace(/([A-Z])/g, ' $1').toLowerCase()} has been ${
        value ? 'enabled' : 'disabled'
      }`
    );
  };

  const handlePasswordChange = async () => {
    if (
      !passwordData.currentPassword ||
      !passwordData.newPassword ||
      !passwordData.confirmPassword
    ) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      Alert.alert('Error', 'New password must be at least 8 characters long');
      return;
    }

    if (passwordData.currentPassword === passwordData.newPassword) {
      Alert.alert(
        'Error',
        'New password must be different from current password'
      );
      return;
    }

    setIsChangingPassword(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // In a real app, this would verify current password and update to new one
      setShowPasswordModal(false);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setShowPasswords({ current: false, new: false, confirm: false });

      Alert.alert(
        'Password Changed',
        'Your password has been successfully updated. Please use your new password for future logins.',
        [{ text: 'OK' }]
      );
    } catch {
      Alert.alert('Error', 'Failed to change password. Please try again.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLanguageChange = (languageCode: string) => {
    setLanguage(languageCode);
    setShowLanguageModal(false);

    const selectedLang = languages.find((lang) => lang.code === languageCode);
    // Language changes instantly, no need for alert
    if (selectedLang) {
      // Language changes instantly, no need for alert
      // The selected language is already applied by setLanguage(languageCode) above
    } else {
      Alert.alert('Error', 'Failed to change language. Please try again.');
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation.toLowerCase() !== 'delete') {
      Alert.alert('Error', 'Please type "DELETE" to confirm account deletion');
      return;
    }

    setIsDeletingAccount(true);
    try {
      // Simulate API call for account deletion
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // In a real app, this would:
      // 1. Delete user data from database
      // 2. Cancel any active requests/jobs
      // 3. Process any pending payments/refunds
      // 4. Delete the auth user account
      // 5. Sign out the user

      Alert.alert(
        'Account Deleted',
        'Your account has been permanently deleted. All your data has been removed from our servers.',
        [
          {
            text: 'OK',
            onPress: () => {
              // In a real app, this would sign out and redirect to login
              router.replace('/(auth)/login');
            },
          },
        ]
      );
    } catch {
      Alert.alert(
        'Error',
        'Failed to delete account. Please try again or contact support.'
      );
    } finally {
      setIsDeletingAccount(false);
      setShowDeleteModal(false);
      setDeleteConfirmation('');
    }
  };

  const showDeleteAccountConfirmation = () => {
    Alert.alert(
      'Delete Account',
      `Are you sure you want to permanently delete your ${
        user.role === 'trucker' ? 'trucker' : 'service provider'
      } account?\n\nThis action cannot be undone and will:\n\n• Delete all your personal data\n• Cancel any active ${
        user.role === 'trucker' ? 'requests' : 'jobs'
      }\n• Remove your account permanently\n• Process any pending refunds`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => setShowDeleteModal(true),
        },
      ]
    );
  };

  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    return strength;
  };

  const getPasswordStrengthText = (strength: number) => {
    switch (strength) {
      case 0:
      case 1:
        return { text: 'Very Weak', color: '#dc2626' };
      case 2:
        return { text: 'Weak', color: '#ea580c' };
      case 3:
        return { text: 'Fair', color: '#f59e0b' };
      case 4:
        return { text: 'Good', color: '#10b981' };
      case 5:
        return { text: 'Strong', color: '#059669' };
      default:
        return { text: 'Very Weak', color: '#dc2626' };
    }
  };

  const currentLang = getCurrentLanguage();

  const SettingItem = ({
    icon,
    title,
    description,
    value,
    onToggle,
    showSwitch = true,
    onPress,
    rightContent,
  }: {
    icon: any;
    title: string;
    description?: string;
    value?: boolean;
    onToggle?: (value: boolean) => void;
    showSwitch?: boolean;
    onPress?: () => void;
    rightContent?: React.ReactNode;
  }) => {
    const Icon = icon;

    return (
      <TouchableOpacity
        style={[styles.settingItem, { borderBottomColor: colors.border }]}
        onPress={onPress}
        disabled={!onPress && !onToggle}
      >
        <View style={styles.settingContent}>
          <View style={[styles.settingIcon, { backgroundColor: colors.card }]}>
            <Icon size={20} color={colors.textSecondary} />
          </View>
          <View style={styles.settingText}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>
              {title}
            </Text>
            {description && (
              <Text
                style={[
                  styles.settingDescription,
                  { color: colors.textSecondary },
                ]}
              >
                {description}
              </Text>
            )}
          </View>
        </View>
        {rightContent ||
          (showSwitch && onToggle ? (
            <Switch
              value={value}
              onValueChange={onToggle}
              trackColor={{ false: colors.border, true: colors.primary + '40' }}
              thumbColor={value ? colors.primary : colors.textSecondary}
            />
          ) : (
            <ChevronRight size={20} color={colors.textSecondary} />
          ))}
      </TouchableOpacity>
    );
  };

  const PasswordInput = ({
    label,
    value,
    onChangeText,
    showPassword,
    onToggleShow,
    placeholder,
    showStrength = false,
  }: {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    showPassword: boolean;
    onToggleShow: () => void;
    placeholder: string;
    showStrength?: boolean;
  }) => {
    const strength = showStrength ? getPasswordStrength(value) : 0;
    const strengthInfo = getPasswordStrengthText(strength);

    return (
      <View style={styles.passwordInputContainer}>
        <Text style={[styles.passwordLabel, { color: colors.text }]}>
          {label}
        </Text>
        <View
          style={[
            styles.passwordInputWrapper,
            { borderColor: colors.border, backgroundColor: colors.surface },
          ]}
        >
          <TextInput
            style={[styles.passwordInput, { color: colors.text }]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.passwordToggle}
            onPress={onToggleShow}
          >
            {showPassword ? (
              <EyeOff size={20} color={colors.textSecondary} />
            ) : (
              <Eye size={20} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
        </View>
        {showStrength && value.length > 0 && (
          <View style={styles.passwordStrength}>
            <View style={styles.strengthBar}>
              {[1, 2, 3, 4, 5].map((level) => (
                <View
                  key={level}
                  style={[
                    styles.strengthSegment,
                    currentLanguage === languages[0].code && [
                      styles.selectedLanguageOption,
                      {
                        borderColor: colors.primary,
                        backgroundColor: colors.primary + '20',
                      },
                    ],
                  ]}
                />
              ))}
            </View>
            <Text style={[styles.strengthText, { color: strengthInfo.color }]}>
              {strengthInfo.text}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>
          {t('settings.title')}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={[styles.content, { backgroundColor: colors.background }]}
      >
        {/* Security Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('settings.security')}
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <SettingItem
              icon={Key}
              title={t('settings.changePassword')}
              description={t('settings.updatePassword')}
              showSwitch={false}
              onPress={() => setShowPasswordModal(true)}
            />
          </View>
        </View>

        {/* Language & Region Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('settings.languageRegion')}
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <SettingItem
              icon={Globe}
              title={t('settings.language')}
              description={`${t('settings.currentLanguage')}: ${
                currentLang?.nativeName || 'English'
              }`}
              showSwitch={false}
              onPress={() => setShowLanguageModal(true)}
              rightContent={
                <View style={styles.languagePreview}>
                  <Text style={styles.languageFlag}>{currentLang?.flag}</Text>
                  <ChevronRight size={20} color={colors.textSecondary} />
                </View>
              }
            />
          </View>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('settings.notifications')}
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <SettingItem
              icon={Bell}
              title={t('settings.pushNotifications')}
              description="Receive notifications on your device"
              value={notifications.pushNotifications}
              onToggle={(value) =>
                updateNotificationSetting('pushNotifications', value)
              }
            />

            <SettingItem
              icon={Mail}
              title={t('settings.emailNotifications')}
              description="Receive updates via email"
              value={notifications.emailNotifications}
              onToggle={(value) =>
                updateNotificationSetting('emailNotifications', value)
              }
            />

            <SettingItem
              icon={MessageSquare}
              title={t('settings.smsNotifications')}
              description="Receive text message alerts"
              value={notifications.smsNotifications}
              onToggle={(value) =>
                updateNotificationSetting('smsNotifications', value)
              }
            />
          </View>
        </View>

        {/* Notification Types Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Notification Types
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <SettingItem
              icon={Bell}
              title={t('settings.requestUpdates')}
              description={
                user.role === 'trucker'
                  ? 'Get notified when providers respond to your requests'
                  : 'Get notified about new requests in your area'
              }
              value={notifications.requestUpdates}
              onToggle={(value) =>
                updateNotificationSetting('requestUpdates', value)
              }
            />

            <SettingItem
              icon={Shield}
              title={t('settings.securityAlerts')}
              description="Important security and account notifications"
              value={notifications.securityAlerts}
              onToggle={(value) =>
                updateNotificationSetting('securityAlerts', value)
              }
            />

            <SettingItem
              icon={Mail}
              title={t('settings.marketingEmails')}
              description="Promotional offers and feature updates"
              value={notifications.marketingEmails}
              onToggle={(value) =>
                updateNotificationSetting('marketingEmails', value)
              }
            />
          </View>
        </View>

        {/* App Preferences Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('settings.appPreferences')}
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <SettingItem
              icon={Moon}
              title={t('settings.darkMode')}
              description="Switch to dark theme"
              value={isDarkMode}
              onToggle={toggleDarkMode}
            />
          </View>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('settings.support')}
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <SettingItem
              icon={HelpCircle}
              title={t('settings.helpCenter')}
              description="Get help and support"
              showSwitch={false}
              onPress={() =>
                Alert.alert(
                  'Help Center',
                  'Contact support at support@rigsnap.com'
                )
              }
            />

            <SettingItem
              icon={Shield}
              title={t('settings.privacyPolicy')}
              description="Review our privacy policy"
              showSwitch={false}
              onPress={() => router.push('/privacy-policy')}
            />
          </View>
        </View>

        {/* Danger Zone Section */}
        <View style={styles.section}>
          <Text style={[styles.dangerSectionTitle, { color: colors.error }]}>
            {t('settings.dangerZone')}
          </Text>
          <View
            style={[
              styles.card,
              styles.dangerCard,
              { backgroundColor: colors.surface, borderColor: colors.error },
            ]}
          >
            <SettingItem
              icon={Trash2}
              title={t('settings.deleteAccount')}
              description="Permanently delete your account and all data"
              showSwitch={false}
              onPress={showDeleteAccountConfirmation}
            />
          </View>
        </View>

        {/* Notification Summary */}
        <View
          style={[
            styles.summaryCard,
            {
              backgroundColor: colors.success + '20',
              borderColor: colors.success + '40',
            },
          ]}
        >
          <View style={styles.summaryHeader}>
            <Check size={20} color={colors.success} />
            <Text style={[styles.summaryTitle, { color: colors.success }]}>
              Notification Summary
            </Text>
          </View>
          <Text style={[styles.summaryText, { color: colors.success }]}>
            You`&apos;`ll receive notifications via{' '}
            {[
              notifications.pushNotifications && 'push notifications',
              notifications.emailNotifications && 'email',
              notifications.smsNotifications && 'SMS',
            ]
              .filter(Boolean)
              .join(', ') || 'none of the selected methods'}
            .
          </Text>
          {user.role === 'trucker' && (
            <Text style={[styles.summarySubtext, { color: colors.success }]}>
              As a trucker, you&apos;ll be notified when service providers
              respond to your requests.
            </Text>
          )}
          {user.role === 'provider' && (
            <Text style={[styles.summarySubtext, { color: colors.success }]}>
              As a service provider, you&apos;ll be notified about new requests
              in your service area.
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Password Change Modal */}
      <Modal
        visible={showPasswordModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Change Password
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowPasswordModal(false);
                setPasswordData({
                  currentPassword: '',
                  newPassword: '',
                  confirmPassword: '',
                });
                setShowPasswords({
                  current: false,
                  new: false,
                  confirm: false,
                });
              }}
              style={styles.closeButton}
            >
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={[
              styles.modalContent,
              { backgroundColor: colors.background },
            ]}
          >
            <View style={styles.passwordForm}>
              <PasswordInput
                label="Current Password"
                value={passwordData.currentPassword}
                onChangeText={(text) =>
                  setPasswordData((prev) => ({
                    ...prev,
                    currentPassword: text,
                  }))
                }
                showPassword={showPasswords.current}
                onToggleShow={() =>
                  setShowPasswords((prev) => ({
                    ...prev,
                    current: !prev.current,
                  }))
                }
                placeholder="Enter your current password"
              />

              <PasswordInput
                label="New Password"
                value={passwordData.newPassword}
                onChangeText={(text) =>
                  setPasswordData((prev) => ({ ...prev, newPassword: text }))
                }
                showPassword={showPasswords.new}
                onToggleShow={() =>
                  setShowPasswords((prev) => ({ ...prev, new: !prev.new }))
                }
                placeholder="Enter your new password"
                showStrength={true}
              />

              <PasswordInput
                label="Confirm New Password"
                value={passwordData.confirmPassword}
                onChangeText={(text) =>
                  setPasswordData((prev) => ({
                    ...prev,
                    confirmPassword: text,
                  }))
                }
                showPassword={showPasswords.confirm}
                onToggleShow={() =>
                  setShowPasswords((prev) => ({
                    ...prev,
                    confirm: !prev.confirm,
                  }))
                }
                placeholder="Confirm your new password"
              />

              <View style={styles.passwordRequirements}>
                <Text
                  style={[styles.requirementsTitle, { color: colors.text }]}
                >
                  Password Requirements:
                </Text>
                <Text
                  style={[
                    styles.requirementItem,
                    { color: colors.textSecondary },
                  ]}
                >
                  • At least 8 characters long
                </Text>
                <Text
                  style={[
                    styles.requirementItem,
                    { color: colors.textSecondary },
                  ]}
                >
                  • Contains uppercase and lowercase letters
                </Text>
                <Text
                  style={[
                    styles.requirementItem,
                    { color: colors.textSecondary },
                  ]}
                >
                  • Contains at least one number
                </Text>
                <Text
                  style={[
                    styles.requirementItem,
                    { color: colors.textSecondary },
                  ]}
                >
                  • Contains at least one special character
                </Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: colors.card }]}
              onPress={() => {
                setShowPasswordModal(false);
                setPasswordData({
                  currentPassword: '',
                  newPassword: '',
                  confirmPassword: '',
                });
                setShowPasswords({
                  current: false,
                  new: false,
                  confirm: false,
                });
              }}
            >
              <Text
                style={[
                  styles.cancelButtonText,
                  { color: colors.textSecondary },
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                [
                  styles.changePasswordButton,
                  { backgroundColor: colors.primary },
                ],
                (!passwordData.currentPassword ||
                  !passwordData.newPassword ||
                  !passwordData.confirmPassword ||
                  isChangingPassword) &&
                  styles.changePasswordButtonDisabled,
              ]}
              onPress={handlePasswordChange}
              disabled={
                !passwordData.currentPassword ||
                !passwordData.newPassword ||
                !passwordData.confirmPassword ||
                isChangingPassword
              }
            >
              {isChangingPassword ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Lock size={16} color="white" />
                  <Text style={styles.changePasswordButtonText}>
                    Change Password
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Select Language
            </Text>
            <TouchableOpacity
              onPress={() => setShowLanguageModal(false)}
              style={styles.closeButton}
            >
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={[
              styles.languageList,
              { backgroundColor: colors.background },
            ]}
          >
            {languages.map((language) => (
              <TouchableOpacity
                key={language.code}
                style={[
                  [
                    styles.languageOption,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ],
                  currentLanguage === language.code && [
                    styles.selectedLanguageOption,
                    {
                      borderColor: colors.primary,
                      backgroundColor: colors.primary + '20',
                    },
                  ],
                ]}
                onPress={() => handleLanguageChange(language.code)}
              >
                <View style={styles.languageOptionContent}>
                  <Text style={styles.languageFlag}>{language.flag}</Text>
                  <View style={styles.languageNames}>
                    <Text
                      style={[
                        [styles.languageName, { color: colors.text }],
                        currentLanguage === language.code && [
                          styles.selectedLanguageName,
                          { color: colors.primary },
                        ],
                      ]}
                    >
                      {language.name}
                    </Text>
                    <Text
                      style={[
                        styles.languageNativeName,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {language.nativeName}
                    </Text>
                  </View>
                </View>
                {currentLanguage === language.code && (
                  <Check size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        visible={showDeleteModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Delete Account</Text>
            <TouchableOpacity
              onPress={() => {
                setShowDeleteModal(false);
                setDeleteConfirmation('');
              }}
              style={styles.closeButton}
            >
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.deleteWarning}>
              <AlertTriangle size={48} color="#ef4444" />
              <Text style={styles.deleteWarningTitle}>
                This action cannot be undone
              </Text>
              <Text style={styles.deleteWarningText}>
                Deleting your{' '}
                {user.role === 'trucker' ? 'trucker' : 'service provider'}{' '}
                account will permanently remove:
              </Text>
            </View>

            <View style={styles.deleteConsequences}>
              <View style={styles.consequenceItem}>
                <Trash2 size={16} color="#ef4444" />
                <Text style={styles.consequenceText}>
                  All your personal information and profile data
                </Text>
              </View>
              <View style={styles.consequenceItem}>
                <Trash2 size={16} color="#ef4444" />
                <Text style={styles.consequenceText}>
                  {user.role === 'trucker'
                    ? 'All your service requests and chat history'
                    : 'All your job history and chat conversations'}
                </Text>
              </View>
              <View style={styles.consequenceItem}>
                <Trash2 size={16} color="#ef4444" />
                <Text style={styles.consequenceText}>
                  Your ratings and reviews
                </Text>
              </View>
              <View style={styles.consequenceItem}>
                <Trash2 size={16} color="#ef4444" />
                <Text style={styles.consequenceText}>
                  {user.role === 'trucker'
                    ? 'Any active service requests will be cancelled'
                    : 'Any active jobs will be cancelled (may incur penalty fees)'}
                </Text>
              </View>
              <View style={styles.consequenceItem}>
                <Trash2 size={16} color="#ef4444" />
                <Text style={styles.consequenceText}>
                  Access to your RigSnap account
                </Text>
              </View>
            </View>

            <View style={styles.deleteConfirmationSection}>
              <Text style={styles.confirmationLabel}>
                To confirm deletion, type{' '}
                <Text style={styles.confirmationKeyword}>DELETE</Text> below:
              </Text>
              <TextInput
                style={styles.confirmationInput}
                value={deleteConfirmation}
                onChangeText={setDeleteConfirmation}
                placeholder="Type DELETE to confirm"
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>

            <View style={styles.deleteAlternatives}>
              <Text style={styles.alternativesTitle}>
                Before you delete your account:
              </Text>
              <Text style={styles.alternativesText}>
                • Consider temporarily deactivating instead of deleting
              </Text>
              <Text style={styles.alternativesText}>
                • Contact support if you`&apos;`re having issues:
                support@rigsnap.com
              </Text>
              <Text style={styles.alternativesText}>
                • Download your data if you want to keep a copy
              </Text>
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setShowDeleteModal(false);
                setDeleteConfirmation('');
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.deleteAccountButton,
                (deleteConfirmation.toLowerCase() !== 'delete' ||
                  isDeletingAccount) &&
                  styles.deleteAccountButtonDisabled,
              ]}
              onPress={handleDeleteAccount}
              disabled={
                deleteConfirmation.toLowerCase() !== 'delete' ||
                isDeletingAccount
              }
            >
              {isDeletingAccount ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Trash2 size={16} color="white" />
                  <Text style={styles.deleteAccountButtonText}>
                    Delete Account
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  languagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  languageFlag: {
    fontSize: 20,
  },
  summaryCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  summarySubtext: {
    fontSize: 12,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
    padding: 24,
  },
  passwordForm: {
    gap: 24,
  },
  passwordInputContainer: {
    marginBottom: 8,
  },
  passwordLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
  },
  passwordToggle: {
    padding: 16,
  },
  passwordStrength: {
    marginTop: 8,
  },
  strengthBar: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  strengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '500',
  },
  passwordRequirements: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  requirementItem: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 2,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 24,
    gap: 12,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  changePasswordButton: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  changePasswordButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  changePasswordButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  languageList: {
    flex: 1,
    padding: 24,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedLanguageOption: {
    borderWidth: 2,
  },
  languageOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  languageNames: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  selectedLanguageName: {
    fontWeight: '600',
  },
  languageNativeName: {
    fontSize: 14,
  },
  dangerSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  dangerCard: {
    borderWidth: 2,
  },
  deleteWarning: {
    alignItems: 'center',
    marginBottom: 24,
  },
  deleteWarningTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ef4444',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  deleteWarningText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  deleteConsequences: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  consequenceItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  consequenceText: {
    fontSize: 14,
    color: '#dc2626',
    lineHeight: 20,
    flex: 1,
  },
  deleteConfirmationSection: {
    marginBottom: 24,
  },
  confirmationLabel: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmationKeyword: {
    fontWeight: 'bold',
    color: '#ef4444',
  },
  confirmationInput: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#ef4444',
  },
  deleteAlternatives: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  alternativesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0369a1',
    marginBottom: 12,
  },
  alternativesText: {
    fontSize: 14,
    color: '#0369a1',
    lineHeight: 20,
    marginBottom: 4,
  },
  deleteAccountButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteAccountButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  deleteAccountButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
