import React, { useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Logger from './src/services/loggerService';

const App: React.FC = () => {
  const isDarkMode = useColorScheme() === 'dark';

  const backgroundStyle = {
    backgroundColor: isDarkMode ? '#000' : '#fff',
  };

  useEffect(() => {
    // 앱 시작 로그
    Logger.info('앱 시작됨', { 
      version: '1.0.0',
      platform: 'android',
      darkMode: isDarkMode 
    });

    // 테스트 로그들
    Logger.debug('디버그 메시지 테스트');
    Logger.warn('경고 메시지 테스트');
    
    return () => {
      Logger.info('앱 종료됨');
    };
  }, [isDarkMode]);

  const handleTestLogs = () => {
    Logger.info('테스트 버튼 클릭됨');
    Logger.logSubscriptionAction('생성', 'T우주 구독', { amount: 50000 });
    Logger.logPresetAction('적용', 'T우주 프리셋', { coupons: 3 });
    Logger.logNotificationAction('스케줄링', { type: '결제 알림', days: 1 });
    
    Alert.alert('로그 테스트', '로그가 기록되었습니다!');
  };

  const handleViewLogs = async () => {
    try {
      const logContent = await Logger.getLogContent();
      const logDirectory = Logger.getLogDirectory();
      
      Alert.alert(
        '로그 정보',
        `로그 저장 위치: ${logDirectory}\n\n최근 로그 (100자):\n${logContent.slice(-100)}...`,
        [{ text: '확인' }]
      );
    } catch (error) {
      Alert.alert('오류', '로그를 읽을 수 없습니다.');
    }
  };

  const handleExportLogs = async () => {
    try {
      const exportPath = await Logger.exportLogs();
      Alert.alert(
        '로그 내보내기 완료',
        `로그가 내보내졌습니다:\n${exportPath}`,
        [{ text: '확인' }]
      );
    } catch (error) {
      Alert.alert('오류', '로그 내보내기에 실패했습니다.');
    }
  };

  return (
    <SafeAreaView style={[backgroundStyle, {flex: 1}]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={backgroundStyle.backgroundColor}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={backgroundStyle}>
        <View style={styles.container}>
          <Text style={styles.title}>구독 관리 앱</Text>
          <Text style={styles.subtitle}>React Native 앱이 성공적으로 실행되었습니다!</Text>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>기능 목록</Text>
            <Text style={styles.item}>• 구독 상품 관리</Text>
            <Text style={styles.item}>• T우주 프리셋</Text>
            <Text style={styles.item}>• 네이버플러스 프리셋</Text>
            <Text style={styles.item}>• 알림 설정</Text>
            <Text style={styles.item}>• 데이터 백업/복원</Text>
            <Text style={styles.item}>• 로컬 로그 저장 (Documents/subscri)</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>로그 테스트</Text>
            
            <TouchableOpacity style={styles.button} onPress={handleTestLogs}>
              <Text style={styles.buttonText}>테스트 로그 생성</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.button} onPress={handleViewLogs}>
              <Text style={styles.buttonText}>로그 확인</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.button} onPress={handleExportLogs}>
              <Text style={styles.buttonText}>로그 내보내기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  section: {
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 8,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  item: {
    fontSize: 14,
    marginBottom: 8,
    color: '#555',
  },
  button: {
    backgroundColor: '#007bff',
    padding: 12,
    borderRadius: 6,
    marginBottom: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default App;