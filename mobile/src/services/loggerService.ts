import RNFS from 'react-native-fs';
import { logger, configLoggerType, consoleTransport } from 'react-native-logs';
import { Timber } from './timberService';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class LoggerService {
  private logger: any;
  private logDirectory: string;
  private logFileName: string;
  private maxLogFiles: number = 7; // 최대 7일치 로그 보관

  constructor() {
    // 여러 경로를 시도하여 가장 적합한 경로 선택
    this.logDirectory = this.getBestLogDirectory();
    this.logFileName = this.getLogFileName();
    
    // 로그 디렉토리 생성을 먼저 수행
    this.createLogDirectorySync();
    
    // 그 다음 로거 초기화
    this.initializeLogger();
  }

  private getBestLogDirectory(): string {
    // 우선순위에 따라 경로 선택
    const possiblePaths = [
      `${RNFS.DownloadDirectoryPath}/subscri`,           // Downloads/subscri (가장 접근하기 쉬움)
      `${RNFS.ExternalDirectoryPath}/subscri`,           // 외부 앱 전용 폴더
      `${RNFS.DocumentDirectoryPath}/subscri`,           // 내부 Documents 폴더
    ];

    // 첫 번째로 사용 가능한 경로 반환
    return possiblePaths[0]; // Downloads 폴더 우선 사용
  }

  private createLogDirectorySync(): void {
    // 비동기 작업을 즉시 실행
    this.createLogDirectory().catch(error => {
      console.error('로그 디렉토리 생성 실패:', error);
    });
  }

  private getLogFileName(): string {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD 형식
    return `app-${dateStr}.log`;
  }

  private async createLogDirectory(): Promise<void> {
    try {
      const exists = await RNFS.exists(this.logDirectory);
      if (!exists) {
        await RNFS.mkdir(this.logDirectory);
        console.log(`로그 디렉토리 생성: ${this.logDirectory}`);
      }
      
      // 오래된 로그 파일 정리
      await this.cleanupOldLogs();
    } catch (error) {
      console.error('로그 디렉토리 생성 실패:', error);
    }
  }

  private async cleanupOldLogs(): Promise<void> {
    try {
      const files = await RNFS.readDir(this.logDirectory);
      const logFiles = files
        .filter(file => file.name.endsWith('.log'))
        .sort((a, b) => b.mtime!.getTime() - a.mtime!.getTime()); // 최신순 정렬

      // 최대 개수를 초과하는 오래된 파일들 삭제
      if (logFiles.length > this.maxLogFiles) {
        const filesToDelete = logFiles.slice(this.maxLogFiles);
        for (const file of filesToDelete) {
          await RNFS.unlink(file.path);
          console.log(`오래된 로그 파일 삭제: ${file.name}`);
        }
      }
    } catch (error) {
      console.error('로그 파일 정리 실패:', error);
    }
  }

  private initializeLogger(): void {
    const logFilePath = `${this.logDirectory}/${this.logFileName}`;
    
    // fileAsyncTransport 제거하고 consoleTransport만 사용
    const defaultConfig: configLoggerType = {
      severity: __DEV__ ? 'debug' : 'info',
      transport: [
        consoleTransport
      ],
      transportOptions: {
        colors: {
          info: 'blueBright',
          warn: 'yellowBright',
          error: 'redBright'
        }
      }
    };

    this.logger = logger.createLogger(defaultConfig);
    
    // 초기화 로그 작성
    console.log(`Logger 초기화 완료 - 로그 파일: ${logFilePath}`);
  }

  // 로그 메서드들
  debug(message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const fullMessage = `[${timestamp}] ${message}`;
    
    // 콘솔에 출력
    this.logger.debug(fullMessage, ...args);
    
    // 수동으로 파일에 저장
    this.writeLogManually('debug', message).catch(console.error);
    
    // Timber로 Android logcat에 출력
    Timber.debug('SubscriManager', fullMessage);
  }

  info(message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const fullMessage = `[${timestamp}] ${message}`;
    
    this.logger.info(fullMessage, ...args);
    this.writeLogManually('info', message).catch(console.error);
    Timber.info('SubscriManager', fullMessage);
  }

  warn(message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const fullMessage = `[${timestamp}] ${message}`;
    
    this.logger.warn(fullMessage, ...args);
    this.writeLogManually('warn', message).catch(console.error);
    Timber.warn('SubscriManager', fullMessage);
  }

  error(message: string, error?: any, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const fullMessage = `[${timestamp}] ${message}`;
    
    if (error) {
      this.logger.error(fullMessage, error, ...args);
      this.writeLogManually('error', `${message} | Error: ${JSON.stringify(error)}`).catch(console.error);
      Timber.error('SubscriManager', `${fullMessage} | Error: ${JSON.stringify(error)}`);
    } else {
      this.logger.error(fullMessage, ...args);
      this.writeLogManually('error', message).catch(console.error);
      Timber.error('SubscriManager', fullMessage);
    }
  }

  // 구독 관련 특화 로그 메서드들
  logSubscriptionAction(action: string, subscriptionName: string, details?: any): void {
    this.info(`구독 액션: ${action} - ${subscriptionName}`, details);
    Timber.logSubscription(action, subscriptionName, details);
  }

  logPresetAction(action: string, presetName: string, details?: any): void {
    this.info(`프리셋 액션: ${action} - ${presetName}`, details);
    Timber.logPreset(action, presetName, details);
  }

  logNotificationAction(action: string, details?: any): void {
    this.info(`알림 액션: ${action}`, details);
    Timber.logNotification(action, details);
  }

  logApiCall(method: string, url: string, status?: number, error?: any): void {
    if (error) {
      this.error(`API 호출 실패: ${method} ${url}`, error);
    } else {
      this.info(`API 호출: ${method} ${url} - Status: ${status}`);
    }
    Timber.logApiCall(method, url, status, error);
  }

  // 로그 파일 관리 메서드들
  async ensureLogFile(): Promise<void> {
    try {
      const logFilePath = this.getCurrentLogFile();
      const exists = await RNFS.exists(logFilePath);
      
      if (!exists) {
        // 로그 파일이 없으면 생성
        const initialContent = `[${new Date().toISOString()}] 로그 파일 생성\n`;
        await RNFS.writeFile(logFilePath, initialContent, 'utf8');
        console.log(`로그 파일 생성: ${logFilePath}`);
      }
    } catch (error) {
      console.error('로그 파일 생성 실패:', error);
    }
  }

  async writeLogManually(level: string, message: string): Promise<void> {
    try {
      await this.ensureLogFile();
      const logFilePath = this.getCurrentLogFile();
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
      
      await RNFS.appendFile(logFilePath, logEntry, 'utf8');
    } catch (error) {
      console.error('수동 로그 작성 실패:', error);
    }
  }

  async getLogFiles(): Promise<string[]> {
    try {
      const files = await RNFS.readDir(this.logDirectory);
      return files
        .filter(file => file.name.endsWith('.log'))
        .map(file => file.name)
        .sort()
        .reverse(); // 최신순
    } catch (error) {
      this.error('로그 파일 목록 조회 실패', error);
      return [];
    }
  }

  async getLogContent(fileName?: string): Promise<string> {
    try {
      const targetFile = fileName || this.logFileName;
      const filePath = `${this.logDirectory}/${targetFile}`;
      
      const exists = await RNFS.exists(filePath);
      if (!exists) {
        return '로그 파일이 존재하지 않습니다.';
      }

      return await RNFS.readFile(filePath, 'utf8');
    } catch (error) {
      this.error('로그 파일 읽기 실패', error);
      return '로그 파일을 읽을 수 없습니다.';
    }
  }

  async exportLogs(): Promise<string> {
    try {
      const files = await this.getLogFiles();
      let allLogs = '';

      for (const fileName of files) {
        const content = await this.getLogContent(fileName);
        allLogs += `\n=== ${fileName} ===\n${content}\n`;
      }

      const exportPath = `${this.logDirectory}/exported-logs-${Date.now()}.txt`;
      await RNFS.writeFile(exportPath, allLogs, 'utf8');
      
      this.info(`로그 내보내기 완료: ${exportPath}`);
      return exportPath;
    } catch (error) {
      this.error('로그 내보내기 실패', error);
      throw error;
    }
  }

  async clearLogs(): Promise<void> {
    try {
      const files = await RNFS.readDir(this.logDirectory);
      const logFiles = files.filter(file => file.name.endsWith('.log'));

      for (const file of logFiles) {
        await RNFS.unlink(file.path);
      }

      this.info('모든 로그 파일 삭제 완료');
    } catch (error) {
      this.error('로그 파일 삭제 실패', error);
      throw error;
    }
  }

  getLogDirectory(): string {
    return this.logDirectory;
  }

  getCurrentLogFile(): string {
    return `${this.logDirectory}/${this.logFileName}`;
  }
}

// 싱글톤 인스턴스 생성
export const Logger = new LoggerService();

// 전역 에러 핸들러 설정
if (!__DEV__) {
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    Logger.error('Console Error:', ...args);
    originalConsoleError(...args);
  };

  // React Native의 전역 에러 핸들러 (안전하게 처리)
  try {
    const ErrorUtils = require('react-native/Libraries/Core/ErrorUtils');
    if (ErrorUtils && ErrorUtils.setGlobalHandler) {
      ErrorUtils.setGlobalHandler((error: any, isFatal: boolean) => {
        Logger.error(`Global Error (Fatal: ${isFatal}):`, error);
      });
    }
  } catch (e) {
    console.warn('ErrorUtils를 설정할 수 없습니다:', e);
  }
}

export default Logger;