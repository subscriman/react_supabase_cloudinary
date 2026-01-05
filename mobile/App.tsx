import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

const App: React.FC = () => {
  const isDarkMode = useColorScheme() === 'dark';

  const backgroundStyle = {
    backgroundColor: isDarkMode ? '#000' : '#fff',
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
});

export default App;