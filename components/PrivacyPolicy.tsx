import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { ArrowLeft, Shield, Eye, Database, Share2, Lock, Mail, Phone } from 'lucide-react-native';

export default function PrivacyPolicyScreen() {
  const { colors } = useTheme();

  const PolicySection = ({ 
    icon, 
    title, 
    children 
  }: { 
    icon: any, 
    title: string, 
    children: React.ReactNode 
  }) => {
    const Icon = icon;
    return (
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: colors.primary + '20' }]}>
            <Icon size={20} color={colors.primary} />
          </View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        </View>
        <View style={styles.sectionContent}>
          {children}
        </View>
      </View>
    );
  };

  const PolicyText = ({ children }: { children: string }) => (
    <Text style={[styles.policyText, { color: colors.textSecondary }]}>{children}</Text>
  );

  const PolicyList = ({ items }: { items: string[] }) => (
    <View style={styles.listContainer}>
      {items.map((item, index) => (
        <View key={index} style={styles.listItem}>
          <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
          <Text style={[styles.listText, { color: colors.textSecondary }]}>{item}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Privacy Policy</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <Text style={[styles.introTitle, { color: colors.text }]}>Your Privacy Matters</Text>
          <Text style={[styles.introText, { color: colors.textSecondary }]}>
            At RigSnap, we're committed to protecting your privacy and being transparent about how we collect, 
            use, and share your information. This policy explains our practices in clear, simple terms.
          </Text>
          <Text style={[styles.lastUpdated, { color: colors.textSecondary }]}>
            Last updated: January 2025
          </Text>
        </View>

        <PolicySection icon={Database} title="Information We Collect">
          <PolicyText>
            We collect information you provide directly to us and information we gather automatically when you use our services.
          </PolicyText>
          
          <Text style={[styles.subheading, { color: colors.text }]}>Information You Provide:</Text>
          <PolicyList items={[
            'Account information (name, email, phone number, role)',
            'Profile details (location, truck type, license number, services offered)',
            'Service requests and job descriptions',
            'Messages and communications with other users',
            'Payment information (processed securely by our payment partners)',
            'Photos and documents you upload',
            'Feedback and ratings you provide'
          ]} />

          <Text style={[styles.subheading, { color: colors.text }]}>Information We Collect Automatically:</Text>
          <PolicyList items={[
            'Location data (when you grant permission)',
            'Device information and identifiers',
            'Usage patterns and app interactions',
            'Log data and error reports',
            'IP address and network information'
          ]} />
        </PolicySection>

        <PolicySection icon={Eye} title="How We Use Your Information">
          <PolicyText>
            We use your information to provide, improve, and protect our services.
          </PolicyText>
          
          <PolicyList items={[
            'Connect truckers with service providers in their area',
            'Process payments and manage transactions',
            'Send notifications about requests, messages, and account activity',
            'Provide customer support and respond to inquiries',
            'Improve our services and develop new features',
            'Ensure platform safety and prevent fraud',
            'Comply with legal obligations and enforce our terms'
          ]} />
        </PolicySection>

        <PolicySection icon={Share2} title="Information Sharing">
          <PolicyText>
            We share your information only in specific circumstances and never sell your personal data.
          </PolicyText>
          
          <Text style={[styles.subheading, { color: colors.text }]}>We Share Information:</Text>
          <PolicyList items={[
            'With other users as necessary to facilitate services (name, location, contact info)',
            'With payment processors to handle transactions securely',
            'With service providers who help us operate our platform',
            'When required by law or to protect rights and safety',
            'In connection with a business transfer or acquisition',
            'With your explicit consent for other purposes'
          ]} />

          <Text style={[styles.subheading, { color: colors.text }]}>We Do NOT:</Text>
          <PolicyList items={[
            'Sell your personal information to third parties',
            'Share your location without your permission',
            'Use your messages for advertising purposes',
            'Share payment details with other users'
          ]} />
        </PolicySection>

        <PolicySection icon={Lock} title="Data Security">
          <PolicyText>
            We implement industry-standard security measures to protect your information.
          </PolicyText>
          
          <PolicyList items={[
            'Encryption of data in transit and at rest',
            'Secure authentication and access controls',
            'Regular security audits and monitoring',
            'PCI DSS compliance for payment processing',
            'Employee training on data protection',
            'Incident response procedures for security breaches'
          ]} />

          <PolicyText>
            While we strive to protect your information, no method of transmission over the internet 
            is 100% secure. We encourage you to use strong passwords and keep your account information confidential.
          </PolicyText>
        </PolicySection>

        <PolicySection icon={Shield} title="Your Rights and Choices">
          <PolicyText>
            You have control over your personal information and how it's used.
          </PolicyText>
          
          <Text style={[styles.subheading, { color: colors.text }]}>You Can:</Text>
          <PolicyList items={[
            'Access and update your profile information at any time',
            'Control location sharing and notification preferences',
            'Delete your account and associated data',
            'Request a copy of your personal data',
            'Opt out of marketing communications',
            'Contact us with privacy concerns or questions'
          ]} />

          <Text style={[styles.subheading, { color: colors.text }]}>Data Retention:</Text>
          <PolicyText>
            We retain your information for as long as your account is active or as needed to provide services. 
            When you delete your account, we remove your personal information within 30 days, except where 
            required by law or for legitimate business purposes.
          </PolicyText>
        </PolicySection>

        <PolicySection icon={Phone} title="Contact Information">
          <PolicyText>
            If you have questions about this privacy policy or our data practices, please contact us:
          </PolicyText>
          
          <View style={[styles.contactCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.contactItem}>
              <Mail size={16} color={colors.primary} />
              <Text style={[styles.contactText, { color: colors.text }]}>privacy@rigsnap.com</Text>
            </View>
            <View style={styles.contactItem}>
              <Phone size={16} color={colors.primary} />
              <Text style={[styles.contactText, { color: colors.text }]}>1-800-RIGSNAP</Text>
            </View>
            <View style={styles.contactItem}>
              <Mail size={16} color={colors.primary} />
              <Text style={[styles.contactText, { color: colors.text }]}>
                RigSnap Privacy Team{'\n'}
                123 Tech Street{'\n'}
                Austin, TX 78701
              </Text>
            </View>
          </View>
        </PolicySection>

        <View style={[styles.footer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            This privacy policy is effective as of January 2025 and may be updated from time to time. 
            We'll notify you of any material changes through the app or via email.
          </Text>
          
          <View style={[styles.footerActions, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '40' }]}>
            <Shield size={20} color={colors.primary} />
            <View style={styles.footerActionText}>
              <Text style={[styles.footerActionTitle, { color: colors.primary }]}>Questions or Concerns?</Text>
              <Text style={[styles.footerActionDescription, { color: colors.primary }]}>
                Our privacy team is here to help. Contact us anytime at privacy@rigsnap.com
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
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
  },
  intro: {
    padding: 24,
    paddingBottom: 16,
  },
  introTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  introText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  lastUpdated: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  section: {
    margin: 24,
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  subheading: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  policyText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 12,
  },
  listContainer: {
    marginBottom: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bullet: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
    marginTop: 2,
  },
  listText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  contactCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginTop: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  contactText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  footer: {
    margin: 24,
    marginTop: 8,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  footerText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  footerActionText: {
    flex: 1,
  },
  footerActionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  footerActionDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
});