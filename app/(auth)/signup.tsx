import * as React from 'react';
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import {
  Truck,
  Wrench,
  Settings,
  MapPin,
  TriangleAlert as AlertTriangle,
  CircleDot,
  Droplets,
  Zap,
  Image as ImageIcon,
  ChevronDown,
  Globe,
  Check,
  Shield,
  User,
  Mail,
  Phone,
} from 'lucide-react-native';

const roles = [
  {
    id: 'trucker',
    title: 'Trucker',
    description:
      'Request help when you need towing, repairs, or mobile mechanic services',
    icon: Truck,
    color: '#2563eb',
  },
  {
    id: 'provider',
    title: 'Service Provider',
    description:
      'Provide towing, repair, and mechanic services to truckers in need',
    icon: Shield,
    color: '#ea580c',
  },
];

const serviceTypes = [
  {
    id: 'towing',
    name: 'Towing Service',
    description: 'Vehicle breakdown and accident towing',
    icon: Truck,
    color: '#2563eb',
  },
  {
    id: 'repair',
    name: 'Road Service',
    description: 'On-site mechanical repairs and diagnostics',
    icon: Wrench,
    color: '#059669',
  },
  {
    id: 'mechanic',
    name: 'Mechanic Service',
    description: 'Professional diagnostic and repair services',
    icon: Settings,
    color: '#7c3aed',
  },
  {
    id: 'tire_repair',
    name: 'Mobile Tire Repair',
    description: 'Tire replacement, patching, and roadside tire services',
    icon: CircleDot,
    color: '#dc2626',
  },
  {
    id: 'truck_wash',
    name: 'Mobile Truck Wash',
    description: 'Professional mobile truck cleaning and detailing',
    icon: Droplets,
    color: '#0891b2',
  },
  {
    id: 'hose_repair',
    name: 'Hose Repair',
    description: 'Hydraulic and air hose repair and replacement',
    icon: Zap,
    color: '#ea580c',
  },
];

export default function SignupScreen() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    location: '',
    role: '' as 'trucker' | 'provider' | '',
    language: 'en',
    // Trucker specific
    truckType: '',
    licenseNumber: '',
    // Provider specific
    services: [] as string[],
    serviceRadius: '25',
    certifications: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const { signup } = useAuth();
  const { languages, currentLanguage, setLanguage } = useLanguage();

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleService = (serviceId: string) => {
    setFormData((prev) => ({
      ...prev,
      services: prev.services.includes(serviceId)
        ? prev.services.filter((s) => s !== serviceId)
        : [...prev.services, serviceId],
    }));
  };

  const validateForm = () => {
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      confirmPassword,
      location,
      role,
      language,
    } = formData;

    if (
      !firstName ||
      !lastName ||
      !email ||
      !phone ||
      !password ||
      !location ||
      !role ||
      !language
    ) {
      Alert.alert('Error', 'Please fill in all fields');
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }

    // Role-specific validation
    if (
      role === 'trucker' &&
      (!formData.truckType || !formData.licenseNumber)
    ) {
      Alert.alert('Error', 'Please fill in all trucker details');
      return false;
    }

    if (role === 'provider' && formData.services.length === 0) {
      Alert.alert('Error', 'Please select at least one service type');
      return false;
    }

    return true;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const userData = {
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        location: formData.location,
        role: formData.role,
        language: formData.language,
        ...(formData.role === 'trucker'
          ? {
              truckType: formData.truckType,
              licenseNumber: formData.licenseNumber,
            }
          : {}),
        ...(formData.role === 'provider'
          ? {
              services: formData.services,
              serviceRadius: parseInt(formData.serviceRadius),
              certifications: formData.certifications
                .split(',')
                .map((c) => c.trim())
                .filter((c) => c),
            }
          : {}),
      };

      const result = await signup(userData);
      if (result.success) {
        router.replace('/(tabs)');
      } else {
        Alert.alert(
          'Signup Failed',
          result.error || 'Account creation failed. Please try again.'
        );
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedLanguage = languages.find(
    (lang) => lang.code === currentLanguage
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Truck size={40} color="#2563eb" strokeWidth={2} />
            <Text style={styles.title}>Join RigSnap</Text>
          </View>
          <Text style={styles.subtitle}>
            Create your account to get started
          </Text>
        </View>

        <View style={styles.form}>
          {/* Language Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Language</Text>
            <TouchableOpacity
              style={styles.languageSelector}
              onPress={() => {
                // Update form data to match current language when opening modal
                setFormData((prev) => ({ ...prev, language: currentLanguage }));
                setShowLanguageModal(true);
              }}
            >
              <View style={styles.languageContent}>
                <Globe size={20} color="#6b7280" />
                <Text style={styles.languageText}>
                  {selectedLanguage?.flag} {selectedLanguage?.nativeName}
                </Text>
              </View>
              <ChevronDown size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Role Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>I am a</Text>
            <View style={styles.roleContainer}>
              {roles.map((role) => {
                const Icon = role.icon;
                const isSelected = formData.role === role.id;

                return (
                  <TouchableOpacity
                    key={role.id}
                    style={[
                      styles.roleCard,
                      isSelected && {
                        borderColor: role.color,
                        backgroundColor: role.color + '10',
                      },
                    ]}
                    onPress={() => handleInputChange('role', role.id)}
                  >
                    <View style={styles.roleHeader}>
                      <Icon
                        size={24}
                        color={isSelected ? role.color : '#6b7280'}
                      />
                      {isSelected && (
                        <View style={styles.checkmark}>
                          <Check size={16} color={role.color} />
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.roleTitle,
                        isSelected && { color: role.color },
                      ]}
                    >
                      {role.title}
                    </Text>
                    <Text style={styles.roleDescription}>
                      {role.description}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.nameRow}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>First Name</Text>
              <View style={styles.inputContainer}>
                <User size={20} color="#6b7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.inputWithIcon}
                  value={formData.firstName}
                  onChangeText={(value) =>
                    handleInputChange('firstName', value)
                  }
                  placeholder="John"
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Last Name</Text>
              <View style={styles.inputContainer}>
                <User size={20} color="#6b7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.inputWithIcon}
                  value={formData.lastName}
                  onChangeText={(value) => handleInputChange('lastName', value)}
                  placeholder="Driver"
                  autoCapitalize="words"
                />
              </View>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputContainer}>
              <Mail size={20} color="#6b7280" style={styles.inputIcon} />
              <TextInput
                style={styles.inputWithIcon}
                value={formData.email}
                onChangeText={(value) => handleInputChange('email', value)}
                placeholder="john@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone</Text>
            <View style={styles.inputContainer}>
              <Phone size={20} color="#6b7280" style={styles.inputIcon} />
              <TextInput
                style={styles.inputWithIcon}
                value={formData.phone}
                onChangeText={(value) => handleInputChange('phone', value)}
                placeholder="+1-555-0123"
                keyboardType="phone-pad"
                autoComplete="tel"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Location</Text>
            <View style={styles.inputContainer}>
              <MapPin size={20} color="#6b7280" style={styles.inputIcon} />
              <TextInput
                style={styles.inputWithIcon}
                value={formData.location}
                onChangeText={(value) => handleInputChange('location', value)}
                placeholder="Dallas, TX"
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Trucker-specific fields */}
          {formData.role === 'trucker' && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Truck Type</Text>
                <TextInput
                  style={styles.input}
                  value={formData.truckType}
                  onChangeText={(value) =>
                    handleInputChange('truckType', value)
                  }
                  placeholder="e.g., Semi-Trailer, Box Truck, Flatbed"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>License Number</Text>
                <TextInput
                  style={styles.input}
                  value={formData.licenseNumber}
                  onChangeText={(value) =>
                    handleInputChange('licenseNumber', value)
                  }
                  placeholder="e.g., CDL-TX-123456"
                  autoCapitalize="characters"
                />
              </View>
            </>
          )}

          {/* Provider-specific fields */}
          {formData.role === 'provider' && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Services Offered</Text>
                <Text style={styles.helperText}>
                  Select all services you provide
                </Text>
                <View style={styles.servicesGrid}>
                  {serviceTypes.map((service) => {
                    const Icon = service.icon;
                    const isSelected = formData.services.includes(service.id);

                    return (
                      <TouchableOpacity
                        key={service.id}
                        style={[
                          styles.serviceCard,
                          isSelected && {
                            borderColor: service.color,
                            backgroundColor: service.color + '10',
                          },
                        ]}
                        onPress={() => toggleService(service.id)}
                      >
                        <View style={styles.serviceHeader}>
                          <Icon
                            size={20}
                            color={isSelected ? service.color : '#6b7280'}
                          />
                          {isSelected && (
                            <View
                              style={[
                                styles.serviceCheckmark,
                                { backgroundColor: service.color },
                              ]}
                            >
                              <Check size={12} color="white" />
                            </View>
                          )}
                        </View>
                        <Text
                          style={[
                            styles.serviceName,
                            isSelected && { color: service.color },
                          ]}
                        >
                          {service.name}
                        </Text>
                        <Text style={styles.serviceDescription}>
                          {service.description}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Service Radius (miles)</Text>
                <TextInput
                  style={styles.input}
                  value={formData.serviceRadius}
                  onChangeText={(value) =>
                    handleInputChange('serviceRadius', value)
                  }
                  placeholder="25"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Certifications (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={formData.certifications}
                  onChangeText={(value) =>
                    handleInputChange('certifications', value)
                  }
                  placeholder="e.g., ASE Certified, DOT Inspector"
                  multiline
                />
                <Text style={styles.helperText}>
                  Separate multiple certifications with commas
                </Text>
              </View>
            </>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={formData.password}
              onChangeText={(value) => handleInputChange('password', value)}
              placeholder="Minimum 6 characters"
              secureTextEntry
              autoComplete="new-password"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              value={formData.confirmPassword}
              onChangeText={(value) =>
                handleInputChange('confirmPassword', value)
              }
              placeholder="Re-enter your password"
              secureTextEntry
              autoComplete="new-password"
            />
          </View>

          <TouchableOpacity
            style={[styles.signupButton, isLoading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.signupButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login" style={styles.link}>
              <Text style={styles.linkText}>Sign In</Text>
            </Link>
          </View>
        </View>
      </ScrollView>

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Language</Text>
            <TouchableOpacity
              onPress={() => setShowLanguageModal(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.languageList}>
            {languages.map((language) => (
              <TouchableOpacity
                key={language.code}
                style={[
                  styles.languageOption,
                  currentLanguage === language.code &&
                    styles.selectedLanguageOption,
                ]}
                onPress={() => {
                  setLanguage(language.code);
                  handleInputChange('language', language.code);
                  setShowLanguageModal(false);
                }}
              >
                <View style={styles.languageOptionContent}>
                  <Text style={styles.languageFlag}>{language.flag}</Text>
                  <View style={styles.languageNames}>
                    <Text
                      style={[
                        styles.languageName,
                        currentLanguage === language.code &&
                          styles.selectedLanguageName,
                      ]}
                    >
                      {language.name}
                    </Text>
                    <Text style={styles.languageNativeName}>
                      {language.nativeName}
                    </Text>
                  </View>
                </View>
                {currentLanguage === language.code && (
                  <Check size={20} color="#2563eb" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    marginLeft: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  form: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  languageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#f9fafb',
  },
  languageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  languageText: {
    fontSize: 16,
    color: '#374151',
  },
  roleContainer: {
    gap: 12,
  },
  roleCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  roleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  roleDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  nameRow: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    backgroundColor: '#f9fafb',
  },
  inputIcon: {
    marginLeft: 12,
    marginRight: 8,
  },
  inputWithIcon: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    paddingLeft: 0,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#f9fafb',
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  serviceCard: {
    width: '48%',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    minHeight: 120,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceCheckmark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  signupButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  signupButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 16,
    color: '#6b7280',
  },
  link: {
    marginLeft: 4,
  },
  linkText: {
    fontSize: 16,
    color: '#2563eb',
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 60,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#6b7280',
  },
  languageList: {
    flex: 1,
    padding: 24,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 12,
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
    borderColor: '#2563eb',
    backgroundColor: '#dbeafe',
  },
  languageOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  languageFlag: {
    fontSize: 24,
  },
  languageNames: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
    marginBottom: 2,
  },
  selectedLanguageName: {
    color: '#2563eb',
    fontWeight: '600',
  },
  languageNativeName: {
    fontSize: 14,
    color: '#6b7280',
  },
});
