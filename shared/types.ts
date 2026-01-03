// 구독 상품 관련 타입 정의

export interface Subscription {
  id: string;
  name: string;
  provider: string;
  startDate?: Date;
  paymentDate?: Date;
  paymentAmount?: number;
  paymentMethod?: string;
  expiryDate?: Date;
  isActive: boolean;
  subProducts: SubProduct[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SubProduct {
  id: string;
  subscriptionId: string;
  name: string;
  type: 'coupon' | 'benefit' | 'service';
  quantity?: number;
  expiryDate?: Date;
  validityPeriod?: number; // days
  isUsed: boolean;
  description?: string;
}

export interface SubscriptionPreset {
  id: string;
  name: string;
  provider: string;
  description: string;
  isOfficial: boolean; // 관리자 등록 여부
  createdBy: string;
  likes: number;
  downloads: number;
  template: {
    subscription: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>;
    subProducts: Omit<SubProduct, 'id' | 'subscriptionId'>[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  provider: 'google' | 'kakao' | 'naver';
  subscriptions: Subscription[];
  createdAt: Date;
}

export interface NotificationSettings {
  id: string;
  userId: string;
  subscriptionId: string;
  type: 'payment' | 'expiry' | 'benefit';
  daysBeforeAlert: number;
  isEnabled: boolean;
}

// T우주 배달의민족 예시 프리셋
export const TWORLD_BAEMIN_PRESET: SubscriptionPreset = {
  id: 'tworld-baemin',
  name: 'T우주 - 배달의민족',
  provider: 'T우주',
  description: '배달의민족 3천원 쿠폰 3장 제공',
  isOfficial: true,
  createdBy: 'admin',
  likes: 0,
  downloads: 0,
  template: {
    subscription: {
      name: 'T우주',
      provider: 'SKT',
      isActive: true,
      subProducts: []
    },
    subProducts: [
      {
        name: '배달의민족 3천원 쿠폰 #1',
        type: 'coupon',
        quantity: 1,
        validityPeriod: 30,
        isUsed: false,
        description: '3천원 할인 쿠폰'
      },
      {
        name: '배달의민족 3천원 쿠폰 #2',
        type: 'coupon',
        quantity: 1,
        validityPeriod: 30,
        isUsed: false,
        description: '3천원 할인 쿠폰'
      },
      {
        name: '배달의민족 3천원 쿠폰 #3',
        type: 'coupon',
        quantity: 1,
        validityPeriod: 30,
        isUsed: false,
        description: '3천원 할인 쿠폰'
      }
    ]
  },
  createdAt: new Date(),
  updatedAt: new Date()
};