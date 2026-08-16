// Web stub for react-native-keyboard-controller (native-only)
import React from 'react';

export const KeyboardProvider = ({ children }) => children;
export const KeyboardAwareScrollView = ({ children, ...props }) =>
  React.createElement('div', props, children);
export const useKeyboardController = () => ({});
export const useReanimatedKeyboardAnimation = () => ({ height: { value: 0 }, progress: { value: 0 } });
export default { KeyboardProvider };
