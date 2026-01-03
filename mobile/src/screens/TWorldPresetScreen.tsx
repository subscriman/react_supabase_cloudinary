import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import DatePicker from 'react-native-date-picker';
import { SubscriptionPreset } from '../../../shared/types';
import { SubscriptionService } from '../services/subscriptionService';
import { NotificationService } from '../services/notificationService';

interface TWorldPresetScreenProps {
  navigation: any;
  route: {
    params: {
      preset: SubscriptionPreset;
    };
  };
}

const TWorldPresetScreen: React.FC<TWorldPresetScreenProps> = ({ navigation, route }) => {
  const { preset } = route.params;
  const [startDate, setStartDate] = useState(new Date());
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [paymentAmount, setPaymentAmount] = useState('');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showPaymentDatePicker, setShowPaymentDatePicker] = useState(false);
  const [coupons, setCoupons] = useState([
    { id: 1, name: '배달의민족 3천원 쿠폰 #1', receivedDate: new Date(), isUsed: false },
    { id: 2, name: '배달의민족 3천원 쿠폰 #2', receivedDate: new Date(), isUsed: false },
    { id: 3, name: '배달의민족 3천원 쿠폰 #3', receivedDate: new Date(), isUsed: false },
  ]);

  const handleCouponDateChange = (couponId: number, date: Date) => {
    setCoupons(prev => prev.map(coupon => 
      coupon.id === couponId 
        ? { ...coupon, receivedDate: date }
        : coupon
    ));
  };

  const handleCouponToggle = (couponId: number) => {
    setCoupons(prev => prev.map(coupon => 
      coupon.id === couponId 
        ? { ...coupon, isUsed: !coupon.isUsed }
        : coupon
    ));
  };

  const handleRegister = async () => {
    try {
      // 사용자 ID 가져오기 (실제로는 인증 상태에서)
      const userId = 'current-user-id'; // TODO: 실제 사용자 ID

      // 구독 상품 생성
      const subscriptionData = {
        ...preset.template.subscription,
        user_id: userId,
        start_date: startDate,
        payment_date: paymentDate,
        payment_amount: parseFloat(paymentAmount) || undefined,
      };

      const subscription = await SubscriptionService.createSubscription(subscriptionData);
      if (!subscription) {
        Alert.alert('오류', '구독 상품 등록에 실패했습니다.');
        return;
      }

      // 쿠폰들을 서브 상품으로 등록
      for (const coupon of coupons) {
        const expiryDate = new Date(coupon.receivedDate);
        expiryDate.setDate(expiryDate.getDate() + 30); // 30일 후 만료

        await SubscriptionService.addSubProduct({
          subscription_id: subscription.id,
          name: coupon.name,
          type: 'coupon',
          quantity: 1,
          expiry_date: expiryDate,
          validity_period: 30,
          is_used: coupon.isUsed,
          description: '3천원 할인 쿠폰',
        });
      }

      // 알림 스케줄링
      NotificationService.scheduleAllNotifications(subscription, {
        paymentAlert: 1,
        benefitAlert: 3, // 쿠폰 만료 3일 전 알림
      });

      Alert.alert(
        '등록 완료',
        'T우주 구독이 성공적으로 등록되었습니다.',
        [
          {
            text: '확인',
            onPress: () => navigation.navigate('MySubscriptions'),
          },
        ]
      );
    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert('오류', '등록 중 오류가 발생했습니다.');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>T우주 - 배달의민족</Text>
        <Text style={styles.description}>
          배달의민족 3천원 쿠폰 3장이 제공되는 T우주 구독을 설정하세요.
        </Text>
      </View>

      {/* 기본 정보 입력 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>기본 정보</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>구독 시작일</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowStartDatePicker(true)}
          >
            <Text style={styles.dateText}>
              {startDate.toLocaleDateString('ko-KR')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>결제일</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowPaymentDatePicker(true)}
          >
            <Text style={styles.dateText}>
              {paymentDate.toLocaleDateString('ko-KR')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>결제 금액 (선택사항)</Text>
          <TextInput
            style={styles.textInput}
            value={paymentAmount}
            onChangeText={setPaymentAmount}
            placeholder="예: 50000"
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* 쿠폰 관리 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>배달의민족 쿠폰 관리</Text>
        <Text style={styles.sectionDescription}>
          각 쿠폰의 수령일을 설정하면 만료일(30일 후)을 자동으로 계산합니다.
        </Text>

        {coupons.map((coupon) => (
          <View key={coupon.id} style={styles.couponCard}>
            <View style={styles.couponHeader}>
              <Text style={styles.couponName}>{coupon.name}</Text>
              <TouchableOpacity
                style={[
                  styles.couponToggle,
                  coupon.isUsed && styles.couponToggleUsed,
                ]}
                onPress={() => handleCouponToggle(coupon.id)}
              >
                <Text style={styles.couponToggleText}>
                  {coupon.isUsed ? '사용완료' : '미사용'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.couponInfo}>
              <Text style={styles.couponLabel}>수령일:</Text>
              <TouchableOpacity
                style={styles.couponDateButton}
                onPress={() => {
                  // 쿠폰별 날짜 선택 구현
                  Alert.alert('날짜 선택', '쿠폰 수령일을 선택하세요.');
                }}
              >
                <Text style={styles.couponDateText}>
                  {coupon.receivedDate.toLocaleDateString('ko-KR')}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.couponInfo}>
              <Text style={styles.couponLabel}>만료일:</Text>
              <Text style={styles.couponExpiryText}>
                {new Date(coupon.receivedDate.getTime() + 30 * 24 * 60 * 60 * 1000)
                  .toLocaleDateString('ko-KR')}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* 등록 버튼 */}
      <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
        <Text style={styles.registerButtonText}>등록 완료</Text>
      </TouchableOpacity>

      {/* 날짜 선택기 */}
      <DatePicker
        modal
        open={showStartDatePicker}
        date={startDate}
        mode="date"
        onConfirm={(date) => {
          setShowStartDatePicker(false);
          setStartDate(date);
        }}
        onCancel={() => setShowStartDatePicker(false)}
      />

      <DatePicker
        modal
        open={showPaymentDatePicker}
        date={paymentDate}
        mode="date"
        onConfirm={(date) => {
          setShowPaymentDatePicker(false);
          setPaymentDate(date);
        }}
        onCancel={() => setShowPaymentDatePicker(false)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#6c757d',
    lineHeight: 20,
  },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 8,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212529',
    marginBottom: 8,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 6,
    padding: 12,
    backgroundColor: '#fff',
  },
  dateText: {
    fontSize: 14,
    color: '#212529',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  couponCard: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
  },
  couponHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  couponName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#212529',
    flex: 1,
  },
  couponToggle: {
    backgroundColor: '#28a745',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  couponToggleUsed: {
    backgroundColor: '#6c757d',
  },
  couponToggleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  couponInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  couponLabel: {
    fontSize: 12,
    color: '#6c757d',
    width: 60,
  },
  couponDateButton: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  couponDateText: {
    fontSize: 12,
    color: '#212529',
  },
  couponExpiryText: {
    fontSize: 12,
    color: '#dc3545',
    fontWeight: '500',
  },
  registerButton: {
    backgroundColor: '#007bff',
    margin: 16,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TWorldPresetScreen;