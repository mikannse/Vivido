import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';

interface DialogButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface StyledDialogProps {
  visible: boolean;
  title: string;
  message: string;
  buttons: DialogButton[];
  onDismiss?: () => void;
}

const BRAND_GOLD = '#c47030';
const TEXT_PRIMARY = '#3d2c1e';
const TEXT_SECONDARY = '#827066';
const BG_CARD = '#fdfcfb';
const BG_OVERLAY = 'rgba(0, 0, 0, 0.5)';

export const StyledDialog: React.FC<StyledDialogProps> = ({
  visible,
  title,
  message,
  buttons,
  onDismiss,
}) => {
  const getButtonStyle = (style?: 'default' | 'cancel' | 'destructive') => {
    switch (style) {
      case 'cancel':
        return styles.buttonCancel;
      case 'destructive':
        return styles.buttonDestructive;
      default:
        return styles.buttonDefault;
    }
  };

  const getTextStyle = (style?: 'default' | 'cancel' | 'destructive') => {
    switch (style) {
      case 'cancel':
        return styles.textCancel;
      case 'destructive':
        return styles.textDestructive;
      default:
        return styles.textDefault;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.dialog}>
              <View style={styles.content}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.message}>{message}</Text>
              </View>
              <View style={styles.buttonContainer}>
                {buttons.map((button, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.button,
                      getButtonStyle(button.style),
                      index < buttons.length - 1 && styles.buttonBorder,
                    ]}
                    onPress={button.onPress}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.buttonText, getTextStyle(button.style)]}>
                      {button.text}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

// Alert dialog helper - mimics Alert.alert API but uses styled dialog
export const showAlert = (
  title: string,
  message: string,
  buttons?: Array<{
    text?: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }>
): void => {
  // This is a simple wrapper - actual implementation uses the modal state in components
  // Components should use StyledDialog directly with proper state management
  console.warn('showAlert is deprecated. Use StyledDialog component directly.');
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: BG_OVERLAY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialog: {
    width: 280,
    backgroundColor: BG_CARD,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: TEXT_PRIMARY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2ddd8',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonBorder: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#e2ddd8',
  },
  buttonDefault: {},
  buttonCancel: {},
  buttonDestructive: {},
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  textDefault: {
    color: BRAND_GOLD,
  },
  textCancel: {
    color: TEXT_SECONDARY,
  },
  textDestructive: {
    color: '#d32f2f',
  },
});
