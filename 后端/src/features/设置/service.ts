import 配置 from '../../infra/config';
import type { SettingsRepository } from './repository';
import type { AIConfig, SystemConfig, UIConfig } from './types';

const 允许密钥剪贴板读取设置键 = 'security.allowSecretClipboardPaste';

/**
 * 设置服务
 * 统一管理所有系统配置
 */
export class 设置服务 {
  constructor(private repository: SettingsRepository) { }

  /**
   * 加载 AI 相关配置（优先数据库，其次 .env）
   */
  async loadPersistedAIConfig(): Promise<void> {
    const [appId, apiKey, apiSecret] = await Promise.all([
      this.读取并迁移环境变量('asr.xunfei.appId', 'XUNFEI_ASR_APP_ID'),
      this.读取并迁移环境变量('asr.xunfei.apiKey', 'XUNFEI_ASR_API_KEY'),
      this.读取并迁移环境变量('asr.xunfei.apiSecret', 'XUNFEI_ASR_API_SECRET'),
    ]);

    if (!配置.asr.xunfei) {
      配置.asr.xunfei = { appId: '', apiKey: '', apiSecret: '' };
    }

    配置.asr.xunfei.appId = appId;
    配置.asr.xunfei.apiKey = apiKey;
    配置.asr.xunfei.apiSecret = apiSecret;

    if (!配置.tts.aliyun) {
      配置.tts.aliyun = {
        apiKey: '',
        model: 'qwen3-tts-instruct-flash-realtime',
        baseUrl: 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime',
        voice: 'Cherry',
        responseFormat: 'mp3',
        sampleRate: 24000,
        instructions: '',
        optimizeInstructions: false,
      };
    }

    配置.tts.aliyun.apiKey = await this.读取并迁移环境变量('tts.aliyun.apiKey', 'ALIYUN_TTS_API_KEY');
    配置.tts.aliyun.model = await this.读取并迁移环境变量('tts.aliyun.model', 'ALIYUN_TTS_MODEL') || 配置.tts.aliyun.model;
    配置.tts.aliyun.voice = await this.读取并迁移环境变量('tts.aliyun.voice', 'ALIYUN_TTS_VOICE') || 配置.tts.aliyun.voice;
    const responseFormat = await this.读取并迁移环境变量('tts.aliyun.responseFormat', 'ALIYUN_TTS_RESPONSE_FORMAT');
    if (responseFormat === 'pcm' || responseFormat === 'wav' || responseFormat === 'mp3' || responseFormat === 'opus') {
      配置.tts.aliyun.responseFormat = responseFormat;
    }
    const sampleRate = Number(await this.读取并迁移环境变量('tts.aliyun.sampleRate', 'ALIYUN_TTS_SAMPLE_RATE'));
    if ([8000, 16000, 24000, 48000].includes(sampleRate as 8000 | 16000 | 24000 | 48000)) {
      配置.tts.aliyun.sampleRate = sampleRate as 8000 | 16000 | 24000 | 48000;
    }
    配置.tts.aliyun.instructions = await this.读取并迁移环境变量('tts.aliyun.instructions', 'ALIYUN_TTS_INSTRUCTIONS');
    配置.tts.aliyun.optimizeInstructions = this.解析布尔设置(
      await this.读取并迁移环境变量('tts.aliyun.optimizeInstructions', 'ALIYUN_TTS_OPTIMIZE_INSTRUCTIONS'),
    );
  }

  async getAIConfig(): Promise<AIConfig> {
    const xunfei = 配置.asr.xunfei || { appId: '', apiKey: '', apiSecret: '' };
    const aliyunTts = 配置.tts.aliyun || {
      apiKey: '',
      model: 'qwen3-tts-instruct-flash-realtime',
      voice: 'Cherry',
      responseFormat: 'mp3' as const,
      sampleRate: 24000 as const,
      instructions: '',
      optimizeInstructions: false,
    };
    return {
      xunfeiAsr: {
        hasAppId: xunfei.appId.length > 0,
        appIdLength: xunfei.appId.length,
        hasApiKey: xunfei.apiKey.length > 0,
        apiKeyLength: xunfei.apiKey.length,
        hasApiSecret: xunfei.apiSecret.length > 0,
        apiSecretLength: xunfei.apiSecret.length,
      },
      aliyunTts: {
        hasApiKey: aliyunTts.apiKey.length > 0,
        apiKeyLength: aliyunTts.apiKey.length,
        model: aliyunTts.model,
        voice: aliyunTts.voice,
        responseFormat: aliyunTts.responseFormat,
        sampleRate: aliyunTts.sampleRate,
        instructions: aliyunTts.instructions || '',
        optimizeInstructions: Boolean(aliyunTts.optimizeInstructions),
      },
    };
  }

  async updateAIConfig(data: Partial<{
    xunfeiAsr: {
      appId?: string;
      apiKey?: string;
      apiSecret?: string;
    };
    aliyunTts: {
      apiKey?: string;
      model?: string;
      voice?: string;
      responseFormat?: 'pcm' | 'wav' | 'mp3' | 'opus';
      sampleRate?: 8000 | 16000 | 24000 | 48000;
      instructions?: string;
      optimizeInstructions?: boolean;
    };
  }>): Promise<{ success: boolean }> {
    const 任务列表: Promise<void>[] = [];

    if (!配置.asr.xunfei) {
      配置.asr.xunfei = { appId: '', apiKey: '', apiSecret: '' };
    }

    const xunfei = data.xunfeiAsr;

    if (xunfei && typeof xunfei.appId === 'string') {
      const value = xunfei.appId.trim();
      配置.asr.xunfei.appId = value;
      任务列表.push(this.更新设置值('asr.xunfei.appId', value));
    }
    if (xunfei && typeof xunfei.apiKey === 'string') {
      const value = xunfei.apiKey.trim();
      配置.asr.xunfei.apiKey = value;
      任务列表.push(this.更新设置值('asr.xunfei.apiKey', value));
    }
    if (xunfei && typeof xunfei.apiSecret === 'string') {
      const value = xunfei.apiSecret.trim();
      配置.asr.xunfei.apiSecret = value;
      任务列表.push(this.更新设置值('asr.xunfei.apiSecret', value));
    }
    if (!配置.tts.aliyun) {
      配置.tts.aliyun = {
        apiKey: '',
        model: 'qwen3-tts-instruct-flash-realtime',
        baseUrl: 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime',
        voice: 'Cherry',
        responseFormat: 'mp3',
        sampleRate: 24000,
        instructions: '',
        optimizeInstructions: false,
      };
    }

    if (data.aliyunTts) {
      const aliyunTts = data.aliyunTts;
      if (typeof aliyunTts.apiKey === 'string') {
        const value = aliyunTts.apiKey.trim();
        配置.tts.aliyun.apiKey = value;
        任务列表.push(this.更新设置值('tts.aliyun.apiKey', value));
      }
      if (typeof aliyunTts.model === 'string') {
        const value = aliyunTts.model.trim();
        配置.tts.aliyun.model = value || 配置.tts.aliyun.model;
        if (value) 任务列表.push(this.更新设置值('tts.aliyun.model', value));
      }
      if (typeof aliyunTts.voice === 'string') {
        const value = aliyunTts.voice.trim();
        配置.tts.aliyun.voice = value || 配置.tts.aliyun.voice;
        if (value) 任务列表.push(this.更新设置值('tts.aliyun.voice', value));
      }
      if (aliyunTts.responseFormat === 'pcm' || aliyunTts.responseFormat === 'wav' || aliyunTts.responseFormat === 'mp3' || aliyunTts.responseFormat === 'opus') {
        配置.tts.aliyun.responseFormat = aliyunTts.responseFormat;
        任务列表.push(this.更新设置值('tts.aliyun.responseFormat', aliyunTts.responseFormat));
      }
      if ([8000, 16000, 24000, 48000].includes(Number(aliyunTts.sampleRate))) {
        const value = Number(aliyunTts.sampleRate) as 8000 | 16000 | 24000 | 48000;
        配置.tts.aliyun.sampleRate = value;
        任务列表.push(this.更新设置值('tts.aliyun.sampleRate', String(value)));
      }
      if (typeof aliyunTts.instructions === 'string') {
        const value = aliyunTts.instructions.trim();
        配置.tts.aliyun.instructions = value;
        任务列表.push(this.更新设置值('tts.aliyun.instructions', value));
      }
      if (typeof aliyunTts.optimizeInstructions === 'boolean') {
        配置.tts.aliyun.optimizeInstructions = aliyunTts.optimizeInstructions;
        任务列表.push(this.更新设置值('tts.aliyun.optimizeInstructions', aliyunTts.optimizeInstructions ? 'true' : ''));
      }
    }

    await Promise.all(任务列表);

    return { success: true };
  }

  /**
   * 获取 UI 配置
   */
  async getUIConfig(): Promise<UIConfig> {
    const settings = await this.repository.getSettings([
      'ui.serverUrl',
      'ui.maxHistory',
      'ui.controlLayout',
    ]);

    const serverUrl = settings['ui.serverUrl'] || '';
    const mhRaw = settings['ui.maxHistory'];
    const maxHistory = mhRaw ? parseInt(mhRaw, 10) || 10 : 10;

    let controlLayout: UIConfig['controlLayout'] = null;
    const layoutRaw = settings['ui.controlLayout'];
    if (layoutRaw) {
      try {
        controlLayout = JSON.parse(layoutRaw);
      } catch {
        controlLayout = null;
      }
    }

    // Web 前端专用 WebSocket 配置（已移除手改支持，由 controller 层自动派生）

    return {
      serverUrl,
      maxHistory,
      controlLayout,
    };
  }

  /**
   * 获取系统配置
   */
  async getSystemConfig(): Promise<SystemConfig> {
    const allowSecretClipboardPaste = this.解析布尔设置(
      await this.repository.getSetting(允许密钥剪贴板读取设置键),
    );

    return {
      allowSecretClipboardPaste,
    };
  }

  /**
   * 更新 UI 配置
   */
  async updateUIConfig(data: Partial<{
    serverUrl: string;
    webWsBusinessUrl: string;
    webWsAudioUploadUrl: string;
    webWsAudioDownloadUrl: string;
    maxHistory: number | number[];
    controlLayout: Record<string, { x: number; y: number }> | string;
  }>): Promise<void> {
    const 任务列表: Promise<void>[] = [];

    if (typeof data.serverUrl === 'string') {
      const value = data.serverUrl.trim();
      if (value.length > 0) {
        任务列表.push(this.repository.setSetting('ui.serverUrl', value));
      } else {
        任务列表.push(this.repository.deleteSetting('ui.serverUrl'));
      }
    }

    // Web 前端专用 WebSocket 配置（已移除手改支持，改为自动派生）

    if (data.maxHistory !== undefined) {
      const mh = Array.isArray(data.maxHistory)
        ? Number(data.maxHistory[0])
        : Number(data.maxHistory);
      if (!Number.isNaN(mh)) {
        任务列表.push(this.repository.setSetting('ui.maxHistory', String(mh)));
      }
    }

    if (data.controlLayout !== undefined) {
      const layoutValue = typeof data.controlLayout === 'string'
        ? data.controlLayout
        : JSON.stringify(data.controlLayout || {});
      任务列表.push(this.repository.setSetting('ui.controlLayout', layoutValue));
    }

    await Promise.all(任务列表);
  }

  /**
   * 更新系统配置
   */
  async updateSystemConfig(data: Partial<{
    allowSecretClipboardPaste: boolean;
  }>): Promise<void> {
    if (typeof data.allowSecretClipboardPaste !== 'boolean') {
      return;
    }

    if (data.allowSecretClipboardPaste) {
      await this.repository.setSetting(允许密钥剪贴板读取设置键, 'true');
      return;
    }

    await this.repository.deleteSetting(允许密钥剪贴板读取设置键);
  }

  private async 更新设置值(key: string, value: string): Promise<void> {
    if (value.length > 0) {
      await this.repository.setSetting(key, value);
      return;
    }
    await this.repository.deleteSetting(key);
  }

  private async 读取并迁移环境变量(dbKey: string, envKey: string): Promise<string> {
    const persisted = await this.repository.getSetting(dbKey);
    if (persisted !== undefined) {
      return persisted;
    }

    const envValue = (process.env[envKey] || '').trim();
    if (envValue) {
      await this.repository.setSetting(dbKey, envValue);
    }
    return envValue;
  }

  private 解析布尔设置(value?: string): boolean {
    if (!value) {
      return false;
    }

    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1';
  }
}


