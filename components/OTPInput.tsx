import React, { useRef, useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Text,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';
import { Colors } from '@/constants/colors';

interface OTPInputProps {
  length?: number;
  onComplete: (code: string) => void;
  error?: boolean;
  autoFocus?: boolean;
}

export function OTPInput({ length = 4, onComplete, error = false, autoFocus = true }: OTPInputProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(''));
  const inputs = useRef<(TextInput | null)[]>(Array(length).fill(null));

  // Expose a reset method via ref if needed — for now, parent remounts via key prop

  const handleChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const newValues = [...values];
    newValues[index] = digit;
    setValues(newValues);

    if (digit && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }

    if (newValues.every((v) => v !== '')) {
      onComplete(newValues.join(''));
    }
  };

  const handleKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number,
  ) => {
    if (e.nativeEvent.key === 'Backspace' && !values[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.container}>
      {values.map((val, i) => (
        <TextInput
          key={i}
          ref={(ref) => { inputs.current[i] = ref; }}
          style={[
            styles.input,
            val ? styles.inputFilled : null,
            error ? styles.inputError : null,
          ]}
          value={val}
          onChangeText={(t) => handleChange(t, i)}
          onKeyPress={(e) => handleKeyPress(e, i)}
          keyboardType="number-pad"
          maxLength={1}
          textAlign="center"
          selectionColor={Colors.primary}
          autoFocus={autoFocus && i === 0}
          testID={`otp-input-${i}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  input: {
    width: 48,
    height: 60,
    borderRadius: Colors.radiusSm,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    color: Colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  inputFilled: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(233,30,140,0.1)',
  },
  inputError: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorBg,
  },
});
