import { useCallback } from 'react';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ToastType = 'success' | 'error' | 'info';

export function useToast() {
  const insets = useSafeAreaInsets();

  const show = useCallback(
    (message: string, type: ToastType = 'info') => {
      Toast.show({
        type,
        text1: message,
        position: 'top',
        topOffset: insets.top + 12,
        visibilityTime: 5000,
        autoHide: true,
      });
    },
    [insets.top],
  );

  return {
    showInfo: (message: string) => show(message, 'info'),
    showSuccess: (message: string) => show(message, 'success'),
    showError: (message: string) => show(message, 'error'),
  };
}
