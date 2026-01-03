import PushNotification from 'react-native-push-notification';
import { Subscription, SubProduct } from '../../../shared/types';

export class NotificationService {
  static init() {
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

    PushNotification.createChannel(
      {
        channelId: 'subscription-alerts',
        channelName: '구독 알림',
        channelDescription: '구독 상품 결제일 및 만료일 알림',
        playSound: true,
        soundName: 'default',
        importance: 4,
        vibrate: true,
      },
      (created) => console.log(`createChannel returned '${created}'`)
    );
  }

  static schedulePaymentNotification(subscription: Subscription, daysBeforeAlert: number = 1) {
    if (!subscription.paymentDate) return;

    const alertDate = new Date(subscription.paymentDate);
    alertDate.setDate(alertDate.getDate() - daysBeforeAlert);

    if (alertDate <= new Date()) return; // 이미 지난 날짜면 스케줄하지 않음

    PushNotification.localNotificationSchedule({
      id: `payment-${subscription.id}`,
      channelId: 'subscription-alerts',
      title: '결제일 알림',
      message: `${subscription.name} 결제일이 ${daysBeforeAlert}일 남았습니다.`,
      date: alertDate,
      allowWhileIdle: true,
    });
  }

  static scheduleExpiryNotification(subscription: Subscription, daysBeforeAlert: number = 1) {
    if (!subscription.expiryDate) return;

    const alertDate = new Date(subscription.expiryDate);
    alertDate.setDate(alertDate.getDate() - daysBeforeAlert);

    if (alertDate <= new Date()) return;

    PushNotification.localNotificationSchedule({
      id: `expiry-${subscription.id}`,
      channelId: 'subscription-alerts',
      title: '만료일 알림',
      message: `${subscription.name} 만료일이 ${daysBeforeAlert}일 남았습니다.`,
      date: alertDate,
      allowWhileIdle: true,
    });
  }

  static scheduleBenefitNotification(subProduct: SubProduct, daysBeforeAlert: number = 1) {
    if (!subProduct.expiryDate) return;

    const alertDate = new Date(subProduct.expiryDate);
    alertDate.setDate(alertDate.getDate() - daysBeforeAlert);

    if (alertDate <= new Date()) return;

    PushNotification.localNotificationSchedule({
      id: `benefit-${subProduct.id}`,
      channelId: 'subscription-alerts',
      title: '혜택 만료 알림',
      message: `${subProduct.name} 혜택이 ${daysBeforeAlert}일 후 만료됩니다.`,
      date: alertDate,
      allowWhileIdle: true,
    });
  }

  static cancelNotification(id: string) {
    PushNotification.cancelLocalNotifications({ id });
  }

  static cancelAllNotifications() {
    PushNotification.cancelAllLocalNotifications();
  }

  // 구독 상품의 모든 알림 스케줄링
  static scheduleAllNotifications(subscription: Subscription, settings: {
    paymentAlert?: number;
    expiryAlert?: number;
    benefitAlert?: number;
  } = {}) {
    const {
      paymentAlert = 1,
      expiryAlert = 1,
      benefitAlert = 1
    } = settings;

    // 결제일 알림
    this.schedulePaymentNotification(subscription, paymentAlert);
    
    // 만료일 알림
    this.scheduleExpiryNotification(subscription, expiryAlert);

    // 서브 상품 혜택 알림
    subscription.subProducts?.forEach(subProduct => {
      this.scheduleBenefitNotification(subProduct, benefitAlert);
    });
  }
}