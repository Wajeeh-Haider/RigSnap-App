import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';

type AlertType = 'success' | 'error' | 'info';

interface InScreenAlertProps {
  visible: boolean;
  message: string;
  type?: AlertType;
  onClose: () => void;
  duration?: number;
}

export default function InScreenAlert({
  visible,
  message,
  type = 'info',
  onClose,
  duration = 5000,
}: InScreenAlertProps) {
  const { colors, isDarkMode } = useTheme();

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [visible, duration, onClose]);

  if (!visible || !message) return null;

  const palette =
    type === 'success'
      ? {
          bg: isDarkMode ? 'rgba(34,197,94,0.18)' : '#dcfce7',
          border: isDarkMode ? 'rgba(34,197,94,0.5)' : '#86efac',
          text: isDarkMode ? '#bbf7d0' : '#166534',
        }
      : type === 'error'
        ? {
            bg: isDarkMode ? 'rgba(239,68,68,0.18)' : '#fee2e2',
            border: isDarkMode ? 'rgba(239,68,68,0.5)' : '#fca5a5',
            text: isDarkMode ? '#fecaca' : '#991b1b',
          }
        : {
            bg: isDarkMode ? 'rgba(59,130,246,0.18)' : '#dbeafe',
            border: isDarkMode ? 'rgba(59,130,246,0.5)' : '#93c5fd',
            text: isDarkMode ? '#bfdbfe' : '#1e3a8a',
          };

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={[styles.message, { color: palette.text }]} numberOfLines={3}>
        {message}
      </Text>
      <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
        <X size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 8,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  message: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
    lineHeight: 18,
  },
  closeBtn: {
    marginLeft: 8,
    padding: 4,
  },
});
