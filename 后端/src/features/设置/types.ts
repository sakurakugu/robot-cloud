
/**
 * UI 配置
 */
export interface UIConfig {
    serverUrl: string;
    maxHistory: number;
    controlLayout: Record<string, { x: number; y: number }> | null;
}

/**
 * 系统配置
 */
export interface SystemConfig {
    allowSecretClipboardPaste: boolean;
}

export interface AIConfig {
    xunfeiAsr: {
        hasAppId: boolean;
        appIdLength: number;
        hasApiKey: boolean;
        apiKeyLength: number;
        hasApiSecret: boolean;
        apiSecretLength: number;
    };
    aliyunTts: {
        hasApiKey: boolean;
        apiKeyLength: number;
        model: string;
        voice: string;
        responseFormat: 'pcm' | 'wav' | 'mp3' | 'opus';
        sampleRate: 8000 | 16000 | 24000 | 48000;
        instructions: string;
        optimizeInstructions: boolean;
    };
}

export interface UpdateAIConfigDTO {
    xunfeiAsr?: {
        appId?: string;
        apiKey?: string;
        apiSecret?: string;
    };
    aliyunTts?: {
        apiKey?: string;
        model?: string;
        voice?: string;
        responseFormat?: 'pcm' | 'wav' | 'mp3' | 'opus';
        sampleRate?: 8000 | 16000 | 24000 | 48000;
        instructions?: string;
        optimizeInstructions?: boolean;
    };
}
