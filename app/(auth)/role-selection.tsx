import * as React from 'react';
import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { Truck, Shield, Check } from 'lucide-react-native';

export default function RoleSelectionScreen() {
  const params = useLocalSearchParams();
  const [selectedRole, setSelectedRole] = useState<
    'trucker' | 'provider' | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);
  const { signup } = useAuth();

  // Trucker specific fields
  const [truckType, setTruckType] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');

  // Provider specific fields
  const [services, setServices] = useState<string[]>([]);
  const [serviceRadius, setServiceRadius] = useState('25');
  const [certifications, setCertifications] = useState('');

  const serviceOptions = ['towing', 'repair', 'mechanic'];

  const toggleService = (service: string) => {
    setServices((prev) =>
      prev.includes(service)
        ? prev.filter((s) => s !== service)
        : [...prev, service]
    );
  };

  const handleComplete = async () => {
    if (!selectedRole) {
      Alert.alert('Error', 'Please select your role');
      return;
    }

    if (selectedRole === 'trucker' && (!truckType || !licenseNumber)) {
      Alert.alert('Error', 'Please fill in all trucker details');
      return;
    }

    if (selectedRole === 'provider' && services.length === 0) {
      Alert.alert('Error', 'Please select at least one service');
      return;
    }

    setIsLoading(true);
    try {
      const userData = {
        ...params,
        role: selectedRole,
        ...(selectedRole === 'trucker'
          ? {
              truckType,
              licenseNumber,
            }
          : {
              services,
              serviceRadius: parseInt(serviceRadius),
              certifications: certifications
                .split(',')
                .map((c) => c.trim())
                .filter((c) => c),
            }),
      };

      const success = await signup(userData);
      if (success) {
        router.replace('/(tabs)');
      } else {
        Alert.alert('Error', 'Account creation failed. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose Your Role</Text>
          <Text style={styles.subtitle}>Select how youll be using RigSnap</Text>
        </View>

        <View style={styles.roleCards}>
          <TouchableOpacity
            style={[
              styles.roleCard,
              selectedRole === 'trucker' && styles.selectedCard,
            ]}
            onPress={() => setSelectedRole('trucker')}
          >
            <View style={styles.roleHeader}>
              <View style={styles.roleIcon}>
                <Truck
                  size={32}
                  color={selectedRole === 'trucker' ? '#2563eb' : '#6b7280'}
                />
              </View>
              <View style={styles.roleInfo}>
                <Text
                  style={[
                    styles.roleTitle,
                    selectedRole === 'trucker' && styles.selectedText,
                  ]}
                >
                  Trucker
                </Text>
                <Text style={styles.roleDescription}>
                  Request help when you need towing, repairs, or mobile mechanic
                  services
                </Text>
              </View>
              {selectedRole === 'trucker' && (
                <Check size={24} color="#2563eb" />
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.roleCard,
              selectedRole === 'provider' && styles.selectedCard,
            ]}
            onPress={() => setSelectedRole('provider')}
          >
            <View style={styles.roleHeader}>
              <View style={styles.roleIcon}>
                <Shield
                  size={32}
                  color={selectedRole === 'provider' ? '#ea580c' : '#6b7280'}
                />
              </View>
              <View style={styles.roleInfo}>
                <Text
                  style={[
                    styles.roleTitle,
                    selectedRole === 'provider' && styles.selectedText,
                  ]}
                >
                  Service Provider
                </Text>
                <Text style={styles.roleDescription}>
                  Provide towing, repair, and mechanic services to truckers in
                  need
                </Text>
              </View>
              {selectedRole === 'provider' && (
                <Check size={24} color="#ea580c" />
              )}
            </View>
          </TouchableOpacity>
        </View>

        {selectedRole === 'trucker' && (
          <View style={styles.additionalFields}>
            <Text style={styles.fieldsTitle}>Trucker Details</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Truck Type</Text>
              <TextInput
                style={styles.input}
                value={truckType}
                onChangeText={setTruckType}
                placeholder="e.g., Semi-Trailer, Box Truck, Flatbed"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>License Number</Text>
              <TextInput
                style={styles.input}
                value={licenseNumber}
                onChangeText={setLicenseNumber}
                placeholder="e.g., CDL-TX-123456"
                autoCapitalize="characters"
              />
            </View>
          </View>
        )}

        {selectedRole === 'provider' && (
          <View style={styles.additionalFields}>
            <Text style={styles.fieldsTitle}>Service Provider Details</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Services Offered</Text>
              <View style={styles.serviceOptions}>
                {serviceOptions.map((service) => (
                  <TouchableOpacity
                    key={service}
                    style={[
                      styles.serviceOption,
                      services.includes(service) && styles.selectedService,
                    ]}
                    onPress={() => toggleService(service)}
                  >
                    <Text
                      style={[
                        styles.serviceText,
                        services.includes(service) &&
                          styles.selectedServiceText,
                      ]}
                    >
                      {service.charAt(0).toUpperCase() + service.slice(1)}
                    </Text>
                    {services.includes(service) && (
                      <Check size={16} color="white" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Service Radius (miles)</Text>
              <TextInput
                style={styles.input}
                value={serviceRadius}
                onChangeText={setServiceRadius}
                placeholder="25"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Certifications (optional)</Text>
              <TextInput
                style={styles.input}
                value={certifications}
                onChangeText={setCertifications}
                placeholder="e.g., ASE Certified, DOT Inspector"
                multiline
              />
              <Text style={styles.helperText}>
                Separate multiple certifications with commas
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.completeButton,
            (!selectedRole || isLoading) && styles.buttonDisabled,
          ]}
          onPress={handleComplete}
          disabled={!selectedRole || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.completeButtonText}>Create Account</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  roleCards: {
    marginBottom: 24,
  },
  roleCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  selectedCard: {
    borderColor: '#2563eb',
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleIcon: {
    marginRight: 16,
  },
  roleInfo: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  selectedText: {
    color: '#2563eb',
  },
  roleDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  additionalFields: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  fieldsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
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
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#f9fafb',
  },
  serviceOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  serviceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  selectedService: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  serviceText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
    marginRight: 8,
  },
  selectedServiceText: {
    color: 'white',
  },
  helperText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  completeButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#94a3b8',
  },
  completeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
