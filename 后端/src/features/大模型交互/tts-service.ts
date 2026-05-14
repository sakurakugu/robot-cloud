import WebSocket from 'ws';
import 配置 from '../../infra/config';
import { apiKeyManager } from '../../infra/config/apikey-manager';
import { logger } from '../../infra/logger';
import { AudioResponse, TTSOptions } from '../../shared/types';
import { uuidv7 } from '../../shared/utils/helpers';

type 音频格式 = 'pcm' | 'wav' | 'mp3' | 'opus';

type 流式分片 = {
  seq: number;
  base64: string;
  format: 音频格式;
  sampleRate: number;
};

const 兼容音色映射: Record<string, string> = {
  'female-soft': 'Cherry',
  'female-bright': 'Serena',
  'male-deep': 'Ethan',
  'male-bright': 'Neil',
  child: 'Mia',
  robotic: 'Neil',
};

class 语音合成服务 {
  constructor() {
    if (配置.tts.provider !== 'aliyun') {
      logger.warn('[TTS] 当前仅实现阿里云实时 TTS', { provider: 配置.tts.provider });
    }
  }

  async synthesize(text: string, options?: TTSOptions): Promise<AudioResponse> {
    return this.synthesizeStream(text, options);
  }

  async synthesizeStream(
    text: string,
    options?: TTSOptions,
    onChunk?: (chunk: 流式分片) => void,
  ): Promise<AudioResponse> {
    const cfg = 配置.tts.aliyun;
    if (!cfg) {
      throw new Error('阿里云 TTS配置未启用');
    }

    const apiKey = apiKeyManager.get('aliyun');
    if (!apiKey) {
      throw new Error('阿里云 TTS API密钥未配置');
    }

    const cleanedText = String(text || '').trim();
    if (!cleanedText) {
      return {
        buffer: '',
        format: cfg.responseFormat || 'pcm',
        duration: 0,
        sampleRate: cfg.sampleRate || 24000,
      };
    }

    const model = cfg.model || 'qwen3-tts-instruct-flash-realtime';
    const wsUrl = this.构建实时TTS地址(cfg.baseUrl, model);
    const format = onChunk ? 'pcm' : (cfg.responseFormat || 'pcm');
    const sampleRate = cfg.sampleRate || 24000;

    return new Promise<AudioResponse>((resolve, reject) => {
      const ws = new WebSocket(wsUrl, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'X-DashScope-DataInspection': 'disable',
        },
      });

      const chunks: Uint8Array[] = [];
      let streamSeq = 0;
      let settled = false;
      let sessionReady = false;
      let textCommitted = false;

      const timeoutMs = 90_000;
      const timeout = setTimeout(() => {
        完成失败(new Error(`阿里云TTS超时（${timeoutMs}ms）`));
      }, timeoutMs);

      const 清理 = () => {
        clearTimeout(timeout);
        try {
          ws.close();
        } catch {}
      };

      const 完成成功 = () => {
        if (settled) {
          return;
        }
        settled = true;
        清理();
        const buffer = Buffer.concat(chunks as Uint8Array[]);
        resolve({
          buffer: buffer.toString('base64'),
          format,
          duration: 0,
          sampleRate,
        });
      };

      const 完成失败 = (error: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        清理();
        reject(error);
      };

      const 发送事件 = (payload: Record<string, unknown>) => {
        ws.send(JSON.stringify({
          event_id: uuidv7(),
          ...payload,
        }));
      };

      const 构建会话参数 = (): Record<string, unknown> => {
        const session: Record<string, unknown> = {
          model,
          voice: this.归一化音色(options?.voice || cfg.voice || 'Cherry'),
          response_format: format,
          sample_rate: sampleRate,
        };

        if (cfg.instructions) {
          session.instructions = cfg.instructions;
          session.optimize_instructions = Boolean(cfg.optimizeInstructions);
        }

        const speechRate = this.转换倍率(options?.speed);
        const pitchRate = this.转换倍率(options?.pitch);
        const volume = this.转换音量(options?.volume);

        if (speechRate !== undefined) {
          session.speech_rate = speechRate;
        }
        if (pitchRate !== undefined) {
          session.pitch_rate = pitchRate;
        }
        if (volume !== undefined) {
          session.volume = volume;
        }

        return session;
      };

      ws.on('open', () => {
        logger.info('[阿里云TTS] WebSocket 连接成功', {
          model,
          voice: this.归一化音色(options?.voice || cfg.voice || 'Cherry'),
          format,
          sampleRate,
          wsUrl,
        });
        发送事件({
          type: 'session.update',
          session: 构建会话参数(),
        });
      });

      ws.on('message', (data: WebSocket.RawData) => {
        try {
          const message = JSON.parse(data.toString());

          switch (message.type) {
            case 'session.updated':
              sessionReady = true;
              logger.info('[阿里云TTS] 会话初始化完成', { model, wsUrl });
              发送事件({
                type: 'input_text_buffer.append',
                text: cleanedText,
              });
              发送事件({
                type: 'input_text_buffer.commit',
              });
              textCommitted = true;
              return;

            case 'response.audio.delta': {
              const base64 = String(message.delta || '');
              if (!base64) {
                return;
              }
              const chunk = Buffer.from(base64, 'base64');
              chunks.push(Uint8Array.from(chunk));
              if (onChunk) {
                streamSeq += 1;
                onChunk({
                  seq: streamSeq,
                  base64,
                  format,
                  sampleRate,
                });
              }
              return;
            }

            case 'response.done':
              完成成功();
              return;

            case 'error': {
              const errorMessage = String(
                message.error?.message
                || message.message
                || message.header?.error_message
                || '阿里云TTS失败',
              );
              logger.error('[阿里云TTS] 服务端返回错误', new Error(errorMessage), {
                model,
                wsUrl,
                payload: message,
              });
              完成失败(new Error(errorMessage));
              return;
            }

            default:
              return;
          }
        } catch (error) {
          完成失败(error instanceof Error ? error : new Error(String(error)));
        }
      });

      ws.on('error', (error) => {
        完成失败(new Error(`阿里云TTS连接错误: ${error.message}`));
      });

      ws.on('close', (code, reasonBuffer) => {
        if (settled) {
          return;
        }
        const reason = reasonBuffer.toString();
        logger.warn('[阿里云TTS] WebSocket 关闭', {
          model,
          wsUrl,
          code,
          reason,
          sessionReady,
          textCommitted,
        });
        if (!sessionReady) {
          完成失败(new Error(`阿里云TTS会话未初始化就断开连接 [code=${code}${reason ? `, reason=${reason}` : ''}]`));
          return;
        }
        if (!textCommitted) {
          完成失败(new Error(`阿里云TTS文本未提交就断开连接 [code=${code}${reason ? `, reason=${reason}` : ''}]`));
          return;
        }
        完成成功();
      });
    });
  }

  private 转换倍率(value?: number): number | undefined {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return undefined;
    }
    return Math.max(0.5, Math.min(2, Number((1 + value / 100).toFixed(2))));
  }

  private 转换音量(value?: number): number | undefined {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return undefined;
    }
    return Math.max(0, Math.min(100, Math.round(50 + value)));
  }

  private 归一化音色(value?: string): string {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return 'Cherry';
    }
    return 兼容音色映射[normalized] || normalized;
  }

  private 构建实时TTS地址(baseUrl: string | undefined, model: string): string {
    const 默认地址 = 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime';
    const 原始地址 = String(baseUrl || '').trim() || 默认地址;
    const url = new URL(原始地址);

    if (url.pathname.endsWith('/inference')) {
      url.pathname = url.pathname.replace(/\/inference$/, '/realtime');
    }

    if (!url.searchParams.get('model')) {
      url.searchParams.set('model', model);
    }

    return url.toString();
  }
}

export default 语音合成服务;

export { 语音合成服务 as TTSService };
