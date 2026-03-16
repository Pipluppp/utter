import * as Haptics from 'expo-haptics';

export const hapticSubmit = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
export const hapticSuccess = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
export const hapticError = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
export const hapticDelete = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
export const hapticLight = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
