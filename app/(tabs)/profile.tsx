import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import {
  StripeProvider,
  useStripe,
  useConfirmSetupIntent,
  CardForm,
} from '@stripe/stripe-react-native';
import { paymentMethodService } from '@/utils/paymentOperations';
import {
  PaymentMethod,
  STRIPE_PUBLISHABLE_KEY,
  createSetupIntent,
} from '@/utils/stripe';
import {
  User,
  Settings,
  MapPin,
  Phone,
  Mail,
  Star,
  Calendar,
  Truck,
  Shield,
  CreditCard as Edit3,
  Save,
  X,
  Globe,
  ChevronRight,
  CreditCard,
  Plus,
  Trash2,
} from 'lucide-react-native';

export default function ProfileScreen() {
  const { user, logout, updateProfile } = useAuth();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { confirmSetupIntent } = useConfirmSetupIntent();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editedUser, setEditedUser] = useState(user);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showStripeCardModal, setShowStripeCardModal] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(false);
  const [cardFormComplete, setCardFormComplete] = useState(false);
  const [newCard, setNewCard] = useState({
    number: '',
    expiryMonth: '',
    expiryYear: '',
    cvc: '',
    name: '',
  });

  // Fetch payment methods on component mount
  useEffect(() => {
    if (user?.id) {
      fetchPaymentMethods();
    }
  }, [user?.id]);

  if (!user) return null;

  const fetchPaymentMethods = async () => {
    if (!user?.id) return;

    setIsLoadingPaymentMethods(true);
    try {
      const methods = await paymentMethodService.fetchUserPaymentMethods(
        user.id
      );
      setPaymentMethods(methods);
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      Alert.alert('Error', 'Failed to load payment methods');
    } finally {
      setIsLoadingPaymentMethods(false);
    }
  };

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
        certifications: editedUser.certifications,
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
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleAddCard = async () => {
    if (!cardFormComplete || !newCard.name) {
      Alert.alert(
        'Error',
        'Please fill in all card details and cardholder name'
      );
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'User not found');
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Create a SetupIntent on the backend
      const setupIntentResponse = await createSetupIntent(user.id);

      if (!setupIntentResponse.success || !setupIntentResponse.client_secret) {
        Alert.alert('Error', 'Failed to initialize payment setup');
        setIsLoading(false);
        return;
      }

      // Step 2: Confirm the SetupIntent with the card details
      const { error, setupIntent } = await confirmSetupIntent(
        setupIntentResponse.client_secret,
        {
          paymentMethodType: 'Card',
          paymentMethodData: {
            billingDetails: {
              name: newCard.name,
            },
          },
        }
      );

      if (error) {
        console.error('Setup intent error:', error);
        Alert.alert('Payment Error', error.message);
        setIsLoading(false);
        return;
      }

      if (setupIntent?.status !== 'Succeeded') {
        Alert.alert('Error', 'Payment method setup failed');
        setIsLoading(false);
        return;
      }

      // Step 3: Save the payment method to our database
      const paymentMethod = setupIntent.paymentMethod;
      if (!paymentMethod?.id) {
        Alert.alert('Error', 'Failed to create payment method');
        setIsLoading(false);
        return;
      }

      const cardBrand = paymentMethod.Card?.brand || 'unknown';
      const last4 = paymentMethod.Card?.last4 || '****';
      const expMonth = paymentMethod.Card?.expMonth || 0;
      const expYear = paymentMethod.Card?.expYear || 0;
      const isFirstCard = paymentMethods.length === 0;

      const result = await paymentMethodService.addPaymentMethod(
        user.id,
        paymentMethod.id, // Use real Stripe payment method ID
        cardBrand,
        last4,
        expMonth,
        expYear,
        newCard.name,
        isFirstCard
      );

      if (result.success) {
        await fetchPaymentMethods(); // Refresh the list
        setNewCard({
          number: '',
          expiryMonth: '',
          expiryYear: '',
          cvc: '',
          name: '',
        });
        setCardFormComplete(false);
        setShowPaymentModal(false);
        Alert.alert('Success', 'Payment method added successfully!');
      } else {
        Alert.alert('Error', result.error || 'Failed to save payment method');
      }
    } catch (error) {
      console.error('Error adding payment method:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Component for Stripe card form
  const StripeCardComponent = () => {
    const { confirmSetupIntent } = useConfirmSetupIntent();

    const handleSaveCard = async () => {
      if (!cardFormComplete || !user?.id) {
        Alert.alert('Error', 'Please complete the card form');
        return;
      }

      setIsLoading(true);

      try {
        // Step 1: Create setup intent
        const setupIntentResult = await createSetupIntent(user.id);

        if (!setupIntentResult.success || !setupIntentResult.client_secret) {
          Alert.alert(
            'Error',
            setupIntentResult.error || 'Failed to create setup intent'
          );
          return;
        }

        // Step 2: Confirm setup intent with card
        const { setupIntent, error } = await confirmSetupIntent(
          setupIntentResult.client_secret,
          {
            paymentMethodType: 'Card',
          }
        );

        if (error) {
          Alert.alert('Error', error.message);
          return;
        }

        if (setupIntent?.paymentMethodId) {
          // Step 3: Save payment method to database
          const paymentMethod = setupIntent.paymentMethod;
          const isFirstCard = paymentMethods.length === 0;

          const result = await paymentMethodService.addPaymentMethod(
            user.id,
            setupIntent.paymentMethodId,
            paymentMethod?.Card?.brand || 'unknown',
            paymentMethod?.Card?.last4 || '0000',
            paymentMethod?.Card?.expMonth || 12,
            paymentMethod?.Card?.expYear || 2025,
            paymentMethod?.billingDetails?.name || 'Unknown',
            isFirstCard
          );

          if (result.success) {
            await fetchPaymentMethods();
            setShowStripeCardModal(false);
            setCardFormComplete(false);
            Alert.alert('Success', 'Payment method added successfully!');
          } else {
            Alert.alert(
              'Error',
              result.error || 'Failed to save payment method'
            );
          }
        }
      } catch (error) {
        console.error('Error adding payment method:', error);
        Alert.alert('Error', 'An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <Modal
        visible={showStripeCardModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowStripeCardModal(false)}
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <View
            style={[styles.modalHeader, { borderBottomColor: colors.border }]}
          >
            <TouchableOpacity
              onPress={() => setShowStripeCardModal(false)}
              style={styles.cancelButton}
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
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Add Payment Method
            </Text>
            <TouchableOpacity
              onPress={handleSaveCard}
              disabled={!cardFormComplete || isLoading}
              style={[
                styles.saveButton,
                {
                  backgroundColor:
                    cardFormComplete && !isLoading ? '#2563eb' : colors.border,
                },
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={[styles.saveButtonText, { color: 'white' }]}>
                  Save
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.cardFormContainer}>
            <Text style={[styles.cardFormTitle, { color: colors.text }]}>
              Card Details
            </Text>
            <Text
              style={[styles.cardFormSubtitle, { color: colors.textSecondary }]}
            >
              Your card information is encrypted and secure
            </Text>

            <CardForm
              placeholders={{
                number: '4242 4242 4242 4242',
              }}
              cardStyle={{
                backgroundColor: 'white',
                textColor: colors.text,
                placeholderColor: colors.textSecondary,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 8,
              }}
              style={{ width: '100%', height: 200, marginTop: 20 }}
              onFormComplete={(cardDetails) => {
                setCardFormComplete(cardDetails.complete);
              }}
            />
          </View>
        </View>
      </Modal>
    );
  };

  const handleDeleteCard = (cardId: string) => {
    const card = paymentMethods.find((c) => c.id === cardId);
    if (!card) return;

    Alert.alert(
      'Delete Payment Method',
      `Are you sure you want to delete the ${card.card_brand.toUpperCase()} ending in ${
        card.last4
      }?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              const result = await paymentMethodService.removePaymentMethod(
                card.id,
                card.stripe_payment_method_id
              );

              if (result.success) {
                await fetchPaymentMethods(); // Refresh the list
                Alert.alert('Success', 'Payment method deleted successfully!');
              } else {
                Alert.alert(
                  'Error',
                  result.error || 'Failed to delete payment method'
                );
              }
            } catch (error) {
              console.error('Error deleting payment method:', error);
              Alert.alert('Error', 'An unexpected error occurred');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleSetDefault = async (cardId: string) => {
    setIsLoading(true);
    try {
      const result = await paymentMethodService.setDefaultPaymentMethod(cardId);

      if (result.success) {
        await fetchPaymentMethods(); // Refresh the list
        Alert.alert('Success', 'Default payment method updated!');
      } else {
        Alert.alert(
          'Error',
          result.error || 'Failed to update default payment method'
        );
      }
    } catch (error) {
      console.error('Error setting default payment method:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const getCardIcon = (type: string) => {
    return CreditCard;
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
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
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <View style={styles.headerContent}>
            <View style={styles.avatarContainer}>
              <View
                style={[
                  styles.logoContainer,
                  { backgroundColor: isTrucker ? '#2563eb' : '#ea580c' },
                ]}
              >
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
                <Text
                  style={[
                    styles.userRole,
                    { color: isTrucker ? '#2563eb' : '#ea580c' },
                  ]}
                >
                  {isTrucker ? 'Trucker' : 'Service Provider'}
                </Text>
              </View>

              <View style={styles.ratingContainer}>
                <Star size={16} color="#f59e0b" fill="#f59e0b" />
                <Text style={[styles.rating, { color: colors.text }]}>
                  {user.rating.toFixed(1)}
                </Text>
                <Text
                  style={[styles.ratingText, { color: colors.textSecondary }]}
                >
                  {t('profile.rating')}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.headerActions}>
            {!isEditing ? (
              <TouchableOpacity
                style={[
                  styles.editButton,
                  { backgroundColor: colors.primary + '20' },
                ]}
                onPress={handleEdit}
              >
                <Edit3 size={20} color="#2563eb" />
              </TouchableOpacity>
            ) : (
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={[
                    styles.cancelButton,
                    { backgroundColor: colors.card },
                  ]}
                  onPress={handleCancel}
                  disabled={isLoading}
                >
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    { backgroundColor: colors.primary },
                    isLoading && styles.saveButtonDisabled,
                  ]}
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
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('profile.personalInformation')}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.infoRow}>
                <User size={20} color={colors.textSecondary} />
                <View style={styles.infoContent}>
                  <Text
                    style={[styles.infoLabel, { color: colors.textSecondary }]}
                  >
                    {t('profile.name')}
                  </Text>
                  {isEditing ? (
                    <View style={styles.nameInputs}>
                      <TextInput
                        style={[
                          styles.input,
                          styles.nameInput,
                          {
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                            color: colors.text,
                          },
                        ]}
                        value={editedUser?.firstName || ''}
                        onChangeText={(text) =>
                          setEditedUser((prev) =>
                            prev ? { ...prev, firstName: text } : null
                          )
                        }
                        placeholder="First name"
                        placeholderTextColor={colors.textSecondary}
                      />
                      <TextInput
                        style={[
                          styles.input,
                          styles.nameInput,
                          {
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                            color: colors.text,
                          },
                        ]}
                        value={editedUser?.lastName || ''}
                        onChangeText={(text) =>
                          setEditedUser((prev) =>
                            prev ? { ...prev, lastName: text } : null
                          )
                        }
                        placeholder="Last name"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                  ) : (
                    <Text style={[styles.infoValue, { color: colors.text }]}>
                      {user.firstName} {user.lastName}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.infoRow}>
                <Mail size={20} color={colors.textSecondary} />
                <View style={styles.infoContent}>
                  <Text
                    style={[styles.infoLabel, { color: colors.textSecondary }]}
                  >
                    {t('profile.email')}
                  </Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {user.email}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Phone size={20} color={colors.textSecondary} />
                <View style={styles.infoContent}>
                  <Text
                    style={[styles.infoLabel, { color: colors.textSecondary }]}
                  >
                    {t('profile.phone')}
                  </Text>
                  {isEditing ? (
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.background,
                          borderColor: colors.border,
                          color: colors.text,
                        },
                      ]}
                      value={editedUser?.phone || ''}
                      onChangeText={(text) =>
                        setEditedUser((prev) =>
                          prev ? { ...prev, phone: text } : null
                        )
                      }
                      placeholder="Phone number"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="phone-pad"
                    />
                  ) : (
                    <Text style={[styles.infoValue, { color: colors.text }]}>
                      {user.phone || t('profile.notProvided')}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.infoRow}>
                <MapPin size={20} color={colors.textSecondary} />
                <View style={styles.infoContent}>
                  <Text
                    style={[styles.infoLabel, { color: colors.textSecondary }]}
                  >
                    {t('profile.location')}
                  </Text>
                  {isEditing ? (
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.background,
                          borderColor: colors.border,
                          color: colors.text,
                        },
                      ]}
                      value={editedUser?.location || ''}
                      onChangeText={(text) =>
                        setEditedUser((prev) =>
                          prev ? { ...prev, location: text } : null
                        )
                      }
                      placeholder="Location"
                      placeholderTextColor={colors.textSecondary}
                    />
                  ) : (
                    <Text style={[styles.infoValue, { color: colors.text }]}>
                      {user.location}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.infoRow}>
                <Calendar size={20} color={colors.textSecondary} />
                <View style={styles.infoContent}>
                  <Text
                    style={[styles.infoLabel, { color: colors.textSecondary }]}
                  >
                    {t('profile.memberSince')}
                  </Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {new Date(user.joinDate).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Role-specific Information */}
          {isTrucker ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('profile.truckerInformation')}
              </Text>
              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <View style={styles.infoRow}>
                  <Truck size={20} color="#2563eb" />
                  <View style={styles.infoContent}>
                    <Text
                      style={[
                        styles.infoLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {t('profile.truckType')}
                    </Text>
                    {isEditing ? (
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                            color: colors.text,
                          },
                        ]}
                        value={editedUser?.truckType || ''}
                        onChangeText={(text) =>
                          setEditedUser((prev) =>
                            prev ? { ...prev, truckType: text } : null
                          )
                        }
                        placeholder="Truck type"
                        placeholderTextColor={colors.textSecondary}
                      />
                    ) : (
                      <Text style={[styles.infoValue, { color: colors.text }]}>
                        {user.truckType || t('profile.notSpecified')}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <User size={20} color="#2563eb" />
                  <View style={styles.infoContent}>
                    <Text
                      style={[
                        styles.infoLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {t('profile.licenseNumber')}
                    </Text>
                    {isEditing ? (
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                            color: colors.text,
                          },
                        ]}
                        value={editedUser?.licenseNumber || ''}
                        onChangeText={(text) =>
                          setEditedUser((prev) =>
                            prev ? { ...prev, licenseNumber: text } : null
                          )
                        }
                        placeholder="License number"
                        placeholderTextColor={colors.textSecondary}
                        autoCapitalize="characters"
                      />
                    ) : (
                      <Text style={[styles.infoValue, { color: colors.text }]}>
                        {user.licenseNumber || t('profile.notProvided')}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('profile.serviceProviderInformation')}
              </Text>
              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <View style={styles.infoRow}>
                  <Shield size={20} color="#ea580c" />
                  <View style={styles.infoContent}>
                    <Text
                      style={[
                        styles.infoLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {t('profile.servicesOffered')}
                    </Text>
                    <Text style={[styles.infoValue, { color: colors.text }]}>
                      {user.services && user.services.length > 0
                        ? user.services
                            .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                            .join(', ')
                        : t('profile.notSpecified')}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <MapPin size={20} color="#ea580c" />
                  <View style={styles.infoContent}>
                    <Text
                      style={[
                        styles.infoLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {t('profile.serviceRadius')}
                    </Text>
                    <Text style={[styles.infoValue, { color: colors.text }]}>
                      {user.serviceRadius
                        ? `${user.serviceRadius} ${t('profile.miles')}`
                        : t('profile.notSpecified')}
                    </Text>
                  </View>
                </View>

                {user.certifications && user.certifications.length > 0 && (
                  <View style={styles.infoRow}>
                    <Star size={20} color="#ea580c" />
                    <View style={styles.infoContent}>
                      <Text
                        style={[
                          styles.infoLabel,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {t('profile.certifications')}
                      </Text>
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
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('profile.paymentMethods')}
              </Text>
              <TouchableOpacity
                style={[
                  styles.addButton,
                  { backgroundColor: colors.primary + '20' },
                ]}
                onPress={() => setShowPaymentModal(true)}
              >
                <Plus size={16} color={colors.primary} />
                <Text style={[styles.addButtonText, { color: colors.primary }]}>
                  Add Card
                </Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              {paymentMethods.length === 0 ? (
                <View style={styles.emptyPayment}>
                  <CreditCard size={48} color={colors.textSecondary} />
                  <Text
                    style={[styles.emptyPaymentText, { color: colors.text }]}
                  >
                    No payment methods added
                  </Text>
                  <Text
                    style={[
                      styles.emptyPaymentSubtext,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Add a credit or debit card to get started
                  </Text>
                </View>
              ) : isLoadingPaymentMethods ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text
                    style={[
                      styles.loadingText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Loading payment methods...
                  </Text>
                </View>
              ) : (
                paymentMethods.map((method) => {
                  const CardIcon = getCardIcon(method.card_brand);
                  return (
                    <View
                      key={method.id}
                      style={[
                        styles.paymentMethod,
                        { borderBottomColor: colors.border },
                      ]}
                    >
                      <View style={styles.paymentMethodContent}>
                        <View
                          style={[
                            styles.paymentMethodIcon,
                            {
                              backgroundColor: colors.background,
                              borderColor: colors.border,
                            },
                          ]}
                        >
                          <CardIcon
                            size={24}
                            color={
                              method.card_brand === 'visa'
                                ? '#1a1f71'
                                : method.card_brand === 'mastercard'
                                ? '#eb001b'
                                : '#6b7280'
                            }
                          />
                        </View>
                        <View style={styles.paymentMethodInfo}>
                          <Text
                            style={[
                              styles.paymentMethodTitle,
                              { color: colors.text },
                            ]}
                          >
                            {method.card_brand.toUpperCase()} ••••{' '}
                            {method.last4}
                          </Text>
                          <Text
                            style={[
                              styles.paymentMethodExpiry,
                              { color: colors.textSecondary },
                            ]}
                          >
                            Expires{' '}
                            {method.exp_month.toString().padStart(2, '0')}/
                            {method.exp_year}
                          </Text>
                          {method.is_default && (
                            <Text
                              style={[
                                styles.defaultBadge,
                                { color: colors.success },
                              ]}
                            >
                              Default
                            </Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.paymentMethodActions}>
                        {!method.is_default && (
                          <TouchableOpacity
                            style={[
                              styles.setDefaultButton,
                              { backgroundColor: colors.background },
                            ]}
                            onPress={() => handleSetDefault(method.id)}
                            disabled={isLoading}
                          >
                            <Text
                              style={[
                                styles.setDefaultText,
                                { color: colors.textSecondary },
                              ]}
                            >
                              Set Default
                            </Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={[
                            styles.deleteButton,
                            { backgroundColor: colors.error + '20' },
                          ]}
                          onPress={() => handleDeleteCard(method.id)}
                          disabled={isLoading}
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
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('profile.settings')}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <TouchableOpacity
                style={[
                  styles.settingRow,
                  { borderBottomColor: colors.border },
                ]}
                onPress={() => router.push('/account-settings')}
              >
                <View style={styles.settingContent}>
                  <Settings size={20} color={colors.textSecondary} />
                  <Text style={[styles.settingText, { color: colors.text }]}>
                    {t('profile.accountSettings')}
                  </Text>
                </View>
                <ChevronRight size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.settingRow,
                  { borderBottomColor: colors.border },
                ]}
                onPress={() => router.push('/account-settings')}
              >
                <View style={styles.settingContent}>
                  <Globe size={20} color={colors.textSecondary} />
                  <Text style={[styles.settingText, { color: colors.text }]}>
                    {t('profile.languageRegion')}
                  </Text>
                </View>
                <ChevronRight size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Logout */}
          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: colors.error }]}
            onPress={handleLogout}
          >
            <Text style={styles.logoutText}>{t('profile.signOut')}</Text>
          </TouchableOpacity>
        </View>

        <Modal
          visible={showPaymentModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowPaymentModal(false)}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
          >
            <View
              style={[
                styles.modalContainer,
                { backgroundColor: colors.background, flex: 1 },
              ]}
            >
              {/* ---------- HEADER ---------- */}
              <View
                style={[
                  styles.modalHeader,
                  {
                    backgroundColor: colors.surface,
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Add Payment Method
                </Text>

                <TouchableOpacity
                  onPress={() => {
                    setShowPaymentModal(false);
                    setNewCard({
                      number: '',
                      expiryMonth: '',
                      expiryYear: '',
                      cvc: '',
                      name: '',
                    });
                  }}
                  style={styles.closeButton}
                >
                  <X size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* ---------- CONTENT + ACTIONS (SCROLLABLE) ---------- */}
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  padding: 16,
                  flexGrow: 1,
                  justifyContent: 'space-between',
                }}
              >
                {/* ---------- FORM CONTENT ---------- */}
                <View>
                  {/* Cardholder Name */}
                  <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { color: colors.text }]}>
                      Cardholder Name
                    </Text>

                    <TextInput
                      style={[
                        styles.formInput,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                          color: colors.text,
                        },
                      ]}
                      value={newCard.name}
                      onChangeText={(text) =>
                        setNewCard((prev) => ({ ...prev, name: text }))
                      }
                      placeholder="John Doe"
                      placeholderTextColor={colors.textSecondary}
                      autoCapitalize="words"
                    />
                  </View>

                  {/* Card Form */}
                  <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { color: colors.text }]}>
                      Card Details
                    </Text>

                    <CardForm
                      placeholders={{
                        number: '1234 5678 9012 3456',
                        cvc: 'CVC',
                      }}
                      cardStyle={{
                        backgroundColor: colors.surface,
                        textColor: colors.text,
                        placeholderColor: colors.textSecondary,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: colors.border,
                        fontSize: 16,
                      }}
                      style={{
                        width: '100%',
                        height: 250,
                      }}
                      onFormComplete={(cardDetails) => {
                        setCardFormComplete(cardDetails.complete);
                      }}
                    />
                  </View>

                  {/* Security Notice */}
                  <View
                    style={[
                      styles.securityNotice,
                      {
                        backgroundColor: colors.success + '15',
                        borderColor: colors.success + '30',
                      },
                    ]}
                  >
                    <Text
                      style={[styles.securityText, { color: colors.success }]}
                    >
                      Your payment information is encrypted and secure.
                    </Text>
                  </View>
                </View>

                {/* ---------- ACTION BUTTONS (NOW SCROLLABLE) ---------- */}
                <View style={{ gap: 12, marginTop: 24 ,flexDirection: 'row'}}>
                  <TouchableOpacity
                    style={[
                      styles.cancelButton,
                      { backgroundColor: colors.card },
                    ]}
                    onPress={() => {
                      setShowPaymentModal(false);
                      setNewCard({
                        number: '',
                        expiryMonth: '',
                        expiryYear: '',
                        cvc: '',
                        name: '',
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
                      styles.addCardButton,
                      { backgroundColor: colors.primary },
                      (!cardFormComplete || !newCard.name || isLoading) &&
                        styles.addCardButtonDisabled,
                    ]}
                    onPress={handleAddCard}
                    disabled={!cardFormComplete || !newCard.name || isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <CreditCard size={16} color="white" />
                    )}

                    <Text style={styles.addCardButtonText}>
                      {isLoading ? 'Adding Card...' : 'Add Card'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* <StripeCardComponent /> */}
      </ScrollView>
    </StripeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 10,
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
    width: 64,
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
    paddingTop: 10,
    paddingBottom: 10,
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
    marginTop: 16,
  },
  securityContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  securityIcon: {
    fontSize: 16,
  },
  securityText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
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
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardInputContainer: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  cardFormContainer: {
    padding: 24,
    flex: 1,
  },
  cardFormTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardFormSubtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
});
