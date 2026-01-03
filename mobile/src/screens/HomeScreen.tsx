import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { SubscriptionService } from '../services/subscriptionService';
import { SubscriptionPreset } from '../../../shared/types';

interface HomeScreenProps {
  navigation: any;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const [officialPresets, setOfficialPresets] = useState<SubscriptionPreset[]>([]);
  const [banners, setBanners] = useState<any[]>([]);

  useEffect(() => {
    loadOfficialPresets();
    loadBanners();
  }, []);

  const loadOfficialPresets = async () => {
    const presets = await SubscriptionService.getPresets(true);
    setOfficialPresets(presets);
  };

  const loadBanners = async () => {
    // TODO: 배너 데이터 로드
    setBanners([
      {
        id: 1,
        title: 'T우주',
        image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjEyMCIgZmlsbD0iI0ZGNkI2QiIvPjx0ZXh0IHg9IjE1MCIgeT0iNzAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyNCIgZmlsbD0iI0ZGRkZGRiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuq1rOuPhOyEsOu5hDwvdGV4dD48L3N2Zz4=',
        provider: 'SKT',
      },
      {
        id: 2,
        title: '네이버플러스',
        image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjEyMCIgZmlsbD0iIzRFQ0RDNCIvPjx0ZXh0IHg9IjE1MCIgeT0iNzAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgZmlsbD0iI0ZGRkZGRiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuuEpOydtOuyhO2UjOufrOyKpDwvdGV4dD48L3N2Zz4=',
        provider: '네이버',
      },
    ]);
  };

  const handlePresetSelect = (preset: SubscriptionPreset) => {
    if (preset.name.includes('T우주')) {
      navigation.navigate('TWorldPreset', { preset });
    } else {
      navigation.navigate('PresetDetail', { preset });
    }
  };

  const handleDirectRegistration = () => {
    navigation.navigate('CreateSubscription');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>구독 관리</Text>
        <Text style={styles.subtitle}>구독 상품을 선택하거나 직접 등록하세요</Text>
      </View>

      {/* 메이저 사업자 배너 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>인기 구독 서비스</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {banners.map((banner) => (
            <TouchableOpacity
              key={banner.id}
              style={styles.bannerCard}
              onPress={() => {
                const preset = officialPresets.find(p => p.provider === banner.provider);
                if (preset) {
                  handlePresetSelect(preset);
                } else {
                  Alert.alert('준비중', '해당 서비스의 프리셋을 준비중입니다.');
                }
              }}
            >
              <Image source={{ uri: banner.image }} style={styles.bannerImage} />
              <Text style={styles.bannerTitle}>{banner.title}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 공식 프리셋 목록 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>공식 프리셋</Text>
        {officialPresets.map((preset) => (
          <TouchableOpacity
            key={preset.id}
            style={styles.presetCard}
            onPress={() => handlePresetSelect(preset)}
          >
            <View style={styles.presetInfo}>
              <Text style={styles.presetName}>{preset.name}</Text>
              <Text style={styles.presetDescription}>{preset.description}</Text>
              <View style={styles.presetStats}>
                <Text style={styles.presetStat}>👍 {preset.likes}</Text>
                <Text style={styles.presetStat}>📥 {preset.downloads}</Text>
              </View>
            </View>
            <Text style={styles.presetArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 직접 등록 버튼 */}
      <TouchableOpacity
        style={styles.directRegisterButton}
        onPress={handleDirectRegistration}
      >
        <Text style={styles.directRegisterText}>상품 직접 등록 (목록에 없어요)</Text>
      </TouchableOpacity>

      {/* 하단 네비게이션 버튼들 */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('MySubscriptions')}
        >
          <Text style={styles.actionButtonText}>내 구독 관리</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('UserPresets')}
        >
          <Text style={styles.actionButtonText}>사용자 프리셋</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6c757d',
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 12,
  },
  bannerCard: {
    marginRight: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bannerImage: {
    width: 120,
    height: 60,
    borderRadius: 6,
    marginBottom: 8,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  presetCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  presetInfo: {
    flex: 1,
  },
  presetName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  presetDescription: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 8,
  },
  presetStats: {
    flexDirection: 'row',
    gap: 12,
  },
  presetStat: {
    fontSize: 12,
    color: '#6c757d',
  },
  presetArrow: {
    fontSize: 20,
    color: '#6c757d',
  },
  directRegisterButton: {
    margin: 20,
    backgroundColor: '#007bff',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  directRegisterText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#6c757d',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default HomeScreen;