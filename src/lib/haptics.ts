import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/** Gentle tap — chip selections, toggles, minor actions */
export const hapticLight = (): void => {
  void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
};

/** Solid tap — adding items, submitting forms */
export const hapticMedium = (): void => {
  void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
};

/** Success buzz — Pro upgrade, streak milestone */
export const hapticSuccess = (): void => {
  void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
};
