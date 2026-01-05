import PushNotification from 'react-native-push-notification';
import { Subscription } from '../../../shared/types';

export class NotificationService {
  // 알림 초기화
  static initialize() {
    PushNotification.configure({
      onRegister: function (token) {
        console.log('TOKEN:', token);
      },
      onNotification: function (notification) {
        console.log('NOTIFICATION:', notification);
      },
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },
      popInitialNotification: true,
      requestPermissions: true,
    });
  }

  // 결제일 알림 스케줄링
  static schedulePaymentAlert(subscription: Subscription, daysBefore: number = 1) {
    if (!subscription.paymentDate) return;

    const alertDate = new Date(subscription.paymentDate);
    alertDate.setDate(alertDate.getDate() - daysBefore);

    PushNotification.localNotificationSchedule({
      id: `payment-${subscription.id}`,
      title: '결제 예정 알림',
      message: `${subscription.name} 결제일이 ${daysBefore}일 남았습니다.`,
      date: alertDate,
      repeatType: 'month',
    });
  }

  // 혜택 만료 알림 스케줄링
  static scheduleBenefitAlert(subscription: Subscription, daysBefore: number = 3) {
    subscription.subProducts.forEach((subProduct) => {
      if (subProduct.expiryDate && !subProduct.isUsed) {
        const alertDate = new Date(subProduct.expiryDate);
        alertDate.setDate(alertDate.getDate() - daysBefore);

        PushNotification.localNotificationSchedule({
          id: `benefit-${subProduct.id}`,
          title: '혜택 만료 예정',
          message: `${subProduct.name}이(가) ${daysBefore}일 후 만료됩니다.`,
          date: alertDate,
        });
      }
    });
  }

  // 모든 알림 스케줄링
  static scheduleAllNotifications(
    subscription: Subscription,
    settings: { paymentAlert?: number; benefitAlert?: number } = {}
  ) {
    const { paymentAlert = 1, benefitAlert = 3 } = settings;

    this.schedulePaymentAlert(subscription, paymentAlert);
    this.scheduleBenefitAlert(subscription, benefitAlert);
  }

  // 특정 구독의 모든 알림 취소
  static cancelSubscriptionNotifications(subscriptionId: string) {
    PushNotification.cancelLocalNotification(`payment-${subscriptionId}`);
    // 서브 상품 알림들도 취소해야 하지만, ID를 모르므로 전체 취소 후 재설정하는 방식 권장
  }
}