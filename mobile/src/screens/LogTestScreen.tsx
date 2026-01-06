import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Logger } from '../services/loggerService';
import RNFS from 'react-native-fs';

const LogTestScreen: React.FC = () => {
  const [logContent, setLogContent] = useState<string>('');
  const [logDirectory, setLogDirectory] = useState<string>('');
  const [logFiles, setLogFiles] = useState<string[]>([]);

  const generateTestLogs = async () => {
    try {
      Logger.info('테스트 로그 생성 시작');
      Logger.debug('디버그 테스트 메시지');
      Logger.warn('경고 테스트 메시지');
      Logger.error('에러 테스트 메시지');
      
      Logger.logSubscriptionAction('생성', 'Netflix', { price: 15000 });
      Logger.logPresetAction('선택', 'T우주 프리셋', { userId: 'test123' });
      Logger.logApiCall('GET', '/api/test', 200);
      
      Alert.alert('성공', '테스트 로그가 생성되었습니다.');
    } catch (error) {
      Alert.alert('오류', `로그 생성 실패: ${error}`);
    }
  };

  const checkLogDirectory = async () => {
    try {
      const logDir = Logger.getLogDirectory();
      setLogDirectory(logDir);
      
      // 다양한 RNFS 경로들 확인
      console.log('=== RNFS 경로 정보 ===');
      console.log('DocumentDirectoryPath:', RNFS.DocumentDirectoryPath);
      console.log('DownloadDirectoryPath:', RNFS.DownloadDirectoryPath);
      console.log('ExternalDirectoryPath:', RNFS.ExternalDirectoryPath);
      console.log('ExternalStorageDirectoryPath:', RNFS.ExternalStorageDirectoryPath);
      console.log('현재 로그 디렉토리:', logDir);
      
      const exists = await RNFS.exists(logDir);
      if (!exists) {
        Alert.alert('정보', `로그 디렉토리가 존재하지 않습니다: ${logDir}`);
        return;
      }
      
      const files = await RNFS.readDir(logDir);
      const logFileNames = files
        .filter(file => file.name.endsWith('.log'))
        .map(file => `${file.name} (${Math.round(file.size / 1024)}KB)`);
      
      setLogFiles(logFileNames);
      
      if (logFileNames.length === 0) {
        Alert.alert('정보', '로그 파일이 없습니다.');
      } else {
        Alert.alert('성공', `${logFileNames.length}개의 로그 파일을 찾았습니다.`);
      }
    } catch (error) {
      Alert.alert('오류', `디렉토리 확인 실패: ${error}`);
    }
  };

  const viewLogContent = async () => {
    try {
      const content = await Logger.getLogContent();
      setLogContent(content);
      
      if (content === '로그 파일이 존재하지 않습니다.') {
        Alert.alert('정보', '로그 파일이 존재하지 않습니다.');
      } else {
        Alert.alert('성공', '로그 내용을 불러왔습니다.');
      }
    } catch (error) {
      Alert.alert('오류', `로그 읽기 실패: ${error}`);
    }
  };

  const createLogDirectoryManually = async () => {
    try {
      const logDir = Logger.getLogDirectory();
      const exists = await RNFS.exists(logDir);
      
      if (!exists) {
        await RNFS.mkdir(logDir);
        Alert.alert('성공', `로그 디렉토리를 생성했습니다: ${logDir}`);
      } else {
        Alert.alert('정보', '로그 디렉토리가 이미 존재합니다.');
      }
    } catch (error) {
      Alert.alert('오류', `디렉토리 생성 실패: ${error}`);
    }
  };

  const writeTestFile = async () => {
    try {
      const logDir = Logger.getLogDirectory();
      const testFilePath = `${logDir}/test-manual.log`;
      const testContent = `[${new Date().toISOString()}] 수동 테스트 로그 파일\n`;
      
      await RNFS.writeFile(testFilePath, testContent, 'utf8');
      Alert.alert('성공', `테스트 파일을 생성했습니다: ${testFilePath}`);
    } catch (error) {
      Alert.alert('오류', `파일 생성 실패: ${error}`);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>로그 테스트</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>로그 디렉토리 정보</Text>
        <Text style={styles.info}>경로: {logDirectory || '확인 중...'}</Text>
        <Text style={styles.info}>파일 개수: {logFiles.length}개</Text>
        {logFiles.map((file, index) => (
          <Text key={index} style={styles.fileInfo}>• {file}</Text>
        ))}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={generateTestLogs}>
          <Text style={styles.buttonText}>테스트 로그 생성</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={checkLogDirectory}>
          <Text style={styles.buttonText}>로그 디렉토리 확인</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={viewLogContent}>
          <Text style={styles.buttonText}>로그 내용 확인</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={createLogDirectoryManually}>
          <Text style={styles.buttonText}>디렉토리 수동 생성</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={writeTestFile}>
          <Text style={styles.buttonText}>테스트 파일 생성</Text>
        </TouchableOpacity>
      </View>

      {logContent ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>로그 내용</Text>
          <ScrollView style={styles.logContainer}>
            <Text style={styles.logText}>{logContent}</Text>
          </ScrollView>
        </View>
      ) : null}
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
  },
  section: {
    margin: 20,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 12,
  },
  info: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
  },
  fileInfo: {
    fontSize: 12,
    color: '#495057',
    marginLeft: 8,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  button: {
    backgroundColor: '#007bff',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  logContainer: {
    maxHeight: 300,
    backgroundColor: '#f8f9fa',
    borderRadius: 4,
    padding: 12,
  },
  logText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#212529',
  },
});

export default LogTestScreen;