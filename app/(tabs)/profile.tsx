import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { User, Settings, MapPin, Phone, Mail, Star, Calendar, Truck, Shield, CreditCard as Edit3, Save, X, Globe, ChevronRight } from 'lucide-react-native';
import { CreditCard, Plus, Trash2 } from 'lucide-react-native';

export default function ProfileScreen() {
  const { user, logout, updateProfile } = useAuth();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editedUser, setEditedUser] = useState(user);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([
    {
      id: '1',
      type: 'visa',
      last4: '4242',
      expiryMonth: '12',
      expiryYear: '2025',
      isDefault: true
    },
    {
      id: '2',
      type: 'mastercard',
      last4: '5555',
      expiryMonth: '08',
      expiryYear: '2026',
      isDefault: false
    }
  ]);
  const [newCard, setNewCard] = useState({
    number: '',
    expiryMonth: '',
    expiryYear: '',
    cvc: '',
    name: ''
  });

  if (!user) return null;

  const handleEdit = () => {
    setEditedUser({ ...user });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditedUser(user);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!editedUser) return;

    // Validate required fields
    if (!editedUser.firstName || !editedUser.location) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    try {
      const result = await updateProfile({
        firstName: editedUser.firstName,
        lastName: editedUser.lastName,
        phone: editedUser.phone,
        location: editedUser.location,
        truckType: editedUser.truckType,
        licenseNumber: editedUser.licenseNumber,
        services: editedUser.services,
        serviceRadius: editedUser.serviceRadius,
        certifications: editedUser.certifications
      });

      if (result.success) {
        setIsEditing(false);
        Alert.alert('Success', 'Profile updated successfully!');
      } else {
        Alert.alert('Error', result.error || 'Failed to update profile');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            logout();
            router.replace('/(auth)/login');
          }
        }
      ]
    );
  };

  const handleAddCard = () => {
    if (!newCard.number || !newCard.expiryMonth || !newCard.expiryYear || !newCard.cvc || !newCard.name) {
      Alert.alert('Error', 'Please fill in all card details');
      return;
    }

    const cardType = newCard.number.startsWith('4') ? 'visa' : 
                    newCard.number.startsWith('5') ? 'mastercard' : 'card';
    
    const newPaymentMethod = {
      id: Date.now().toString(),
      type: cardType,
      last4: newCard.number.slice(-4),
      expiryMonth: newCard.expiryMonth,
      expiryYear: newCard.expiryYear,
      isDefault: paymentMethods.length === 0
    };

    setPaymentMethods(prev => [...prev, newPaymentMethod]);
    setNewCard({ number: '', expiryMonth: '', expiryYear: '', cvc: '', name: '' });
    setShowPaymentModal(false);
    Alert.alert('Success', 'Payment method added successfully!');
  };

  const handleDeleteCard = (cardId: string) => {
    const card = paymentMethods.find(c => c.id === cardId);
    if (!card) return;

    Alert.alert(
      'Delete Payment Method',
      `Are you sure you want to delete the ${card.type.toUpperCase()} ending in ${card.last4}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setPaymentMethods(prev => prev.filter(c => c.id !== cardId));
            Alert.alert('Success', 'Payment method deleted successfully!');
          }
        }
      ]
    );
  };

  const handleSetDefault = (cardId: string) => {
    setPaymentMethods(prev => prev.map(card => ({
      ...card,
      isDefault: card.id === cardId
    })));
    Alert.alert('Success', 'Default payment method updated!');
  };

  const getCardIcon = (type: string) => {
    return CreditCard;
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };
  const isTrucker = user.role === 'trucker';

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <View style={styles.avatarContainer}>
            <View style={[styles.logoContainer, { backgroundColor: isTrucker ? '#2563eb' : '#ea580c' }]}>
              {isTrucker ? (
                <Truck size={40} color="white" />
              ) : (
                <Shield size={40} color="white" />
              )}
            </View>
          </View>
          
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: colors.text }]}>
              {user.firstName} {user.lastName}
            </Text>
            <View style={styles.roleContainer}>
              <Text style={[
                styles.userRole,
                { color: isTrucker ? '#2563eb' : '#ea580c' }
              ]}>
                {isTrucker ? 'Trucker' : 'Service Provider'}
              </Text>
            </View>
            
            <View style={styles.ratingContainer}>
              <Star size={16} color="#f59e0b" fill="#f59e0b" />
              <Text style={[styles.rating, { color: colors.text }]}>{user.rating.toFixed(1)}</Text>
              <Text style={[styles.ratingText, { color: colors.textSecondary }]}>{t('profile.rating')}</Text>
            </View>
          </View>
        </View>

        <View style={styles.headerActions}>
          {!isEditing ? (
            <TouchableOpacity style={[styles.editButton, { backgroundColor: colors.primary + '20' }]} onPress={handleEdit}>
              <Edit3 size={20} color="#2563eb" />
            </TouchableOpacity>
          ) : (
            <View style={styles.editActions}>
              <TouchableOpacity 
                style={[styles.cancelButton, { backgroundColor: colors.card }]} 
                onPress={handleCancel}
                disabled={isLoading}
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.saveButton, { backgroundColor: colors.primary }, isLoading && styles.saveButtonDisabled]} 
                onPress={handleSave}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Save size={20} color="white" />
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <View style={[styles.content, { backgroundColor: colors.background }]}>
        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.personalInformation')}</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.infoRow}>
              <User size={20} color={colors.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('profile.name')}</Text>
                {isEditing ? (
                  <View style={styles.nameInputs}>
                    <TextInput
                      style={[styles.input, styles.nameInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                      value={editedUser?.firstName || ''}
                      onChangeText={(text) => setEditedUser(prev => prev ? { ...prev, firstName: text } : null)}
                      placeholder="First name"
                      placeholderTextColor={colors.textSecondary}
                    />
                    <TextInput
                      style={[styles.input, styles.nameInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                      value={editedUser?.lastName || ''}
                      onChangeText={(text) => setEditedUser(prev => prev ? { ...prev, lastName: text } : null)}
                      placeholder="Last name"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                ) : (
                  <Text style={[styles.infoValue, { color: colors.text }]}>{user.firstName} {user.lastName}</Text>
                )}
              </View>
            </View>

            <View style={styles.infoRow}>
              <Mail size={20} color={colors.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('profile.email')}</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{user.email}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Phone size={20} color={colors.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('profile.phone')}</Text>
                {isEditing ? (
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={editedUser?.phone || ''}
                    onChangeText={(text) => setEditedUser(prev => prev ? { ...prev, phone: text } : null)}
                    placeholder="Phone number"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="phone-pad"
                  />
                ) : (
                  <Text style={[styles.infoValue, { color: colors.text }]}>{user.phone || t('profile.notProvided')}</Text>
                )}
              </View>
            </View>

            <View style={styles.infoRow}>
              <MapPin size={20} color={colors.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('profile.location')}</Text>
                {isEditing ? (
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    value={editedUser?.location || ''}
                    onChangeText={(text) => setEditedUser(prev => prev ? { ...prev, location: text } : null)}
                    placeholder="Location"
                    placeholderTextColor={colors.textSecondary}
                  />
                ) : (
                  <Text style={[styles.infoValue, { color: colors.text }]}>{user.location}</Text>
                )}
              </View>
            </View>

            <View style={styles.infoRow}>
              <Calendar size={20} color={colors.textSecondary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('profile.memberSince')}</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {new Date(user.joinDate).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric'
                  })}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Role-specific Information */}
        {isTrucker ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.truckerInformation')}</Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.infoRow}>
                <Truck size={20} color="#2563eb" />
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('profile.truckType')}</Text>
                  {isEditing ? (
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                      value={editedUser?.truckType || ''}
                      onChangeText={(text) => setEditedUser(prev => prev ? { ...prev, truckType: text } : null)}
                      placeholder="Truck type"
                      placeholderTextColor={colors.textSecondary}
                    />
                  ) : (
                    <Text style={[styles.infoValue, { color: colors.text }]}>{user.truckType || t('profile.notSpecified')}</Text>
                  )}
                </View>
              </View>

              <View style={styles.infoRow}>
                <User size={20} color="#2563eb" />
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('profile.licenseNumber')}</Text>
                  {isEditing ? (
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                      value={editedUser?.licenseNumber || ''}
                      onChangeText={(text) => setEditedUser(prev => prev ? { ...prev, licenseNumber: text } : null)}
                      placeholder="License number"
                      placeholderTextColor={colors.textSecondary}
                      autoCapitalize="characters"
                    />
                  ) : (
                    <Text style={[styles.infoValue, { color: colors.text }]}>{user.licenseNumber || t('profile.notProvided')}</Text>
                  )}
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.serviceProviderInformation')}</Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.infoRow}>
                <Shield size={20} color="#ea580c" />
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('profile.servicesOffered')}</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {user.services && user.services.length > 0 
                      ? user.services.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')
                      : t('profile.notSpecified')
                    }
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <MapPin size={20} color="#ea580c" />
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('profile.serviceRadius')}</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {user.serviceRadius ? `${user.serviceRadius} ${t('profile.miles')}` : t('profile.notSpecified')}
                  </Text>
                </View>
              </View>

              {user.certifications && user.certifications.length > 0 && (
                <View style={styles.infoRow}>
                  <Star size={20} color="#ea580c" />
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{t('profile.certifications')}</Text>
                    <Text style={[styles.infoValue, { color: colors.text }]}>
                      {user.certifications.join(', ')}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Payment Methods */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.paymentMethods')}</Text>
            <TouchableOpacity 
              style={[styles.addButton, { backgroundColor: colors.primary + '20' }]}
              onPress={() => setShowPaymentModal(true)}
            >
              <Plus size={16} color={colors.primary} />
              <Text style={[styles.addButtonText, { color: colors.primary }]}>Add Card</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            {paymentMethods.length === 0 ? (
              <View style={styles.emptyPayment}>
                <CreditCard size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyPaymentText, { color: colors.text }]}>No payment methods added</Text>
                <Text style={[styles.emptyPaymentSubtext, { color: colors.textSecondary }]}>Add a credit or debit card to get started</Text>
              </View>
            ) : (
              paymentMethods.map((method) => {
                const CardIcon = getCardIcon(method.type);
                return (
                  <View key={method.id} style={[styles.paymentMethod, { borderBottomColor: colors.border }]}>
                    <View style={styles.paymentMethodContent}>
                      <View style={[styles.paymentMethodIcon, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <CardIcon size={24} color={method.type === 'visa' ? '#1a1f71' : method.type === 'mastercard' ? '#eb001b' : '#6b7280'} />
                      </View>
                      <View style={styles.paymentMethodInfo}>
                        <Text style={[styles.paymentMethodTitle, { color: colors.text }]}>
                          {method.type.toUpperCase()} •••• {method.last4}
                        </Text>
                        <Text style={[styles.paymentMethodExpiry, { color: colors.textSecondary }]}>
                          Expires {method.expiryMonth}/{method.expiryYear}
                        </Text>
                        {method.isDefault && (
                          <Text style={[styles.defaultBadge, { color: colors.success }]}>Default</Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.paymentMethodActions}>
                      {!method.isDefault && (
                        <TouchableOpacity
                          style={[styles.setDefaultButton, { backgroundColor: colors.background }]}
                          onPress={() => handleSetDefault(method.id)}
                        >
                          <Text style={[styles.setDefaultText, { color: colors.textSecondary }]}>Set Default</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[styles.deleteButton, { backgroundColor: colors.error + '20' }]}
                        onPress={() => handleDeleteCard(method.id)}
                      >
                        <Trash2 size={16} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>
        {/* Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.settings')}</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <TouchableOpacity 
              style={[styles.settingRow, { borderBottomColor: colors.border }]}
              onPress={() => router.push('/account-settings')}
            >
              <View style={styles.settingContent}>
                <Settings size={20} color={colors.textSecondary} />
                <Text style={[styles.settingText, { color: colors.text }]}>{t('profile.accountSettings')}</Text>
              </View>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.settingRow, { borderBottomColor: colors.border }]}
              onPress={() => router.push('/account-settings')}
            >
              <View style={styles.settingContent}>
                <Globe size={20} color={colors.textSecondary} />
                <Text style={[styles.settingText, { color: colors.text }]}>{t('profile.languageRegion')}</Text>
              </View>
              <ChevronRight size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={[styles.logoutButton, { backgroundColor: colors.error }]} onPress={handleLogout}>
          <Text style={styles.logoutText}>{t('profile.signOut')}</Text>
        </TouchableOpacity>
      </View>

      {/* Add Payment Method Modal */}
      <Modal
        visible={showPaymentModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Payment Method</Text>
            <TouchableOpacity 
              onPress={() => {
                setShowPaymentModal(false);
                setNewCard({ number: '', expiryMonth: '', expiryYear: '', cvc: '', name: '' });
              }}
              style={styles.closeButton}
            >
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.cardForm}>
              <View style={[styles.cardPreview, { backgroundColor: colors.primary }]}>
                <CreditCard size={32} color="#2563eb" />
                <Text style={styles.cardPreviewText}>
                  {newCard.number ? `•••• •••• •••• ${newCard.number.slice(-4)}` : '•••• •••• •••• ••••'}
                </Text>
                <Text style={styles.cardPreviewExpiry}>
                  {newCard.expiryMonth && newCard.expiryYear ? `${newCard.expiryMonth}/${newCard.expiryYear}` : 'MM/YY'}
                </Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>Cardholder Name</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  value={newCard.name}
                  onChangeText={(text) => setNewCard(prev => ({ ...prev, name: text }))}
                  placeholder="John Doe"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.text }]}>Card Number</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  value={formatCardNumber(newCard.number)}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/\s/g, '');
                    if (cleaned.length <= 16) {
                      setNewCard(prev => ({ ...prev, number: cleaned }));
                    }
                  }}
                  placeholder="1234 5678 9012 3456"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  maxLength={19}
                />
              </View>

              <View style={styles.formRow}>
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>Expiry Month</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                    value={newCard.expiryMonth}
                    onChangeText={(text) => {
                      if (text.length <= 2 && /^\d*$/.test(text)) {
                        const month = parseInt(text);
                        if (text === '' || (month >= 1 && month <= 12)) {
                          setNewCard(prev => ({ ...prev, expiryMonth: text }));
                        }
                      }
                    }}
                    placeholder="12"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>Expiry Year</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                    value={newCard.expiryYear}
                    onChangeText={(text) => {
                      if (text.length <= 4 && /^\d*$/.test(text)) {
                        setNewCard(prev => ({ ...prev, expiryYear: text }));
                      }
                    }}
                    placeholder="2025"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    maxLength={4}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>CVC</Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                    value={newCard.cvc}
                    onChangeText={(text) => {
                      if (text.length <= 4 && /^\d*$/.test(text)) {
                        setNewCard(prev => ({ ...prev, cvc: text }));
                      }
                    }}
                    placeholder="123"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    maxLength={4}
                    secureTextEntry
                  />
                </View>
              </View>

              <View style={[styles.securityNotice, { backgroundColor: colors.success + '20', borderColor: colors.success + '40' }]}>
                <Text style={[styles.securityText, { color: colors.success }]}>
                  🔒 Your payment information is encrypted and secure. We use industry-standard security measures to protect your data.
                </Text>
              </View>
            </View>
          </ScrollView>

          <View style={[styles.modalActions, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: colors.card }]}
              onPress={() => {
                setShowPaymentModal(false);
                setNewCard({ number: '', expiryMonth: '', expiryYear: '', cvc: '', name: '' });
              }}
            >
              <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.addCardButton, { backgroundColor: colors.primary },
                (!newCard.number || !newCard.expiryMonth || !newCard.expiryYear || !newCard.cvc || !newCard.name) && styles.addCardButtonDisabled
              ]}
              onPress={handleAddCard}
              disabled={!newCard.number || !newCard.expiryMonth || !newCard.expiryYear || !newCard.cvc || !newCard.name}
            >
              <CreditCard size={16} color="white" />
              <Text style={styles.addCardButtonText}>Add Card</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  roleContainer: {
    marginBottom: 8,
  },
  userRole: {
    fontSize: 16,
    fontWeight: '600',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  ratingText: {
    fontSize: 14,
  },
  headerActions: {
    marginLeft: 16,
  },
  editButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  content: {
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    borderWidth: 1,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(107, 114, 128, 0.2)',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  nameInputs: {
    flexDirection: 'row',
    gap: 8,
  },
  nameInput: {
    flex: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '500',
  },
  logoutButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  logoutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyPayment: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyPaymentText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 4,
  },
  emptyPaymentSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  paymentMethod: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  paymentMethodContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentMethodIcon: {
    width: 48,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  paymentMethodExpiry: {
    fontSize: 14,
    marginBottom: 4,
  },
  defaultBadge: {
    fontSize: 12,
    fontWeight: '600',
  },
  paymentMethodActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setDefaultButton: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  setDefaultText: {
    fontSize: 12,
    fontWeight: '500',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 6,
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
  cardForm: {
    gap: 20,
  },
  cardPreview: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 8,
  },
  cardPreviewText: {
    fontSize: 18,
    color: 'white',
    fontWeight: '600',
    marginTop: 16,
    letterSpacing: 2,
  },
  cardPreviewExpiry: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 8,
  },
  formGroup: {
    flex: 1,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  securityNotice: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  securityText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 24,
    gap: 12,
    borderTopWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  addCardButton: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addCardButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  addCardButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});