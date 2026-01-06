import { NativeModules } from 'react-native';

interface TimberModuleInterface {
  d(tag: string, message: string): void;
  i(tag: string, message: string): void;
  w(tag: string, message: string): void;
  e(tag: string, message: string): void;
  v(tag: string, message: string): void;
}

const { TimberModule } = NativeModules;

class TimberService {
  private static instance: TimberService;
  private timberModule: TimberModuleInterface;

  private constructor() {
    this.timberModule = TimberModule;
  }

  public static getInstance(): TimberService {
    if (!TimberService.instance) {
      TimberService.instance = new TimberService();
    }
    return TimberService.instance;
  }

  // Debug 로그
  debug(tag: string, message: string): void {
    if (this.timberModule) {
      this.timberModule.d(tag, message);
    }
  }

  // Info 로그
  info(tag: string, message: string): void {
    if (this.timberModule) {
      this.timberModule.i(tag, message);
    }
  }

  // Warning 로그
  warn(tag: string, message: string): void {
    if (this.timberModule) {
      this.timberModule.w(tag, message);
    }
  }

  // Error 로그
  error(tag: string, message: string): void {
    if (this.timberModule) {
      this.timberModule.e(tag, message);
    }
  }

  // Verbose 로그
  verbose(tag: string, message: string): void {
    if (this.timberModule) {
      this.timberModule.v(tag, message);
    }
  }

  // 구독 관련 로그
  logSubscription(action: string, subscriptionName: string, details?: any): void {
    const message = `${action} - ${subscriptionName}${details ? ` | ${JSON.stringify(details)}` : ''}`;
    this.info('Subscription', message);
  }

  // 프리셋 관련 로그
  logPreset(action: string, presetName: string, details?: any): void {
    const message = `${action} - ${presetName}${details ? ` | ${JSON.stringify(details)}` : ''}`;
    this.info('Preset', message);
  }

  // 알림 관련 로그
  logNotification(action: string, details?: any): void {
    const message = `${action}${details ? ` | ${JSON.stringify(details)}` : ''}`;
    this.info('Notification', message);
  }

  // API 호출 로그
  logApiCall(method: string, url: string, status?: number, error?: any): void {
    if (error) {
      this.error('API', `${method} ${url} - Error: ${JSON.stringify(error)}`);
    } else {
      this.info('API', `${method} ${url} - Status: ${status}`);
    }
  }

  // 앱 생명주기 로그
  logAppLifecycle(event: string, details?: any): void {
    const message = `${event}${details ? ` | ${JSON.stringify(details)}` : ''}`;
    this.info('AppLifecycle', message);
  }

  // 사용자 액션 로그
  logUserAction(action: string, screen: string, details?: any): void {
    const message = `${action} on ${screen}${details ? ` | ${JSON.stringify(details)}` : ''}`;
    this.info('UserAction', message);
  }
}

export const Timber = TimberService.getInstance();
export default Timber;