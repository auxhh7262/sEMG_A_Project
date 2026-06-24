// 文件: SignalProcessor.h
// 描述: 肌电信号处理器头文件 (Production Release)
// 版本: V1.0.0
// 日期: 2026-05-12

#ifndef SIGNAL_PROCESSOR_H
#define SIGNAL_PROCESSOR_H

#include <stdint.h>

// 数学常量定义
#ifndef PI
#define PI 3.1415926535f
#endif

class SignalProcessor {
public:
    // 调试级别枚举
    enum DebugLevel {
        DEBUG_NONE = 0,
        DEBUG_MINIMAL = 1,
        DEBUG_NORMAL = 2,
        DEBUG_VERBOSE = 3,
        DEBUG_FULL = 4
    };

    SignalProcessor();
    void init();

    // ---- ISR安全接口 ----
    void isrPushSample(int16_t sample);
    void updateSampleRateStats();

    // 核心信号处理方法
    float update();
    float getFatigue() const;
    float getActivation() const;

    // 校准接口
    void setCalibration(float relaxRMS_mV, float activeRMS_mV, float relaxMDF_hz);
    void clearCalibration();
    bool isCalibrated() const { return m_isCalibrated; }
    float getRelaxRms() const { return m_relaxRMS_mV; }
    float getActiveRms() const { return m_activeRMS_mV; }
    float getRelaxMdf() const { return m_relaxMDF_hz; }
    float getCurrentRms() const;
    float getCurrentMdf() const;
    void setRelaxBaseline(float relaxRms, float relaxMdf);
    void setActiveReference(float activeRms);
    // [v3.9.24] 校准MDF缓冲区接口
    void recordCalibMdf(float mdf_hz);  // 记录校准阶段MDF值
    void finalizeCalibMdf();             // [新增] 计算峰值和末尾MDF
    float getCalibMdfPeak() const { return m_calibMdfPeak; }
    float getCalibMdfEnd() const { return m_calibMdfEnd; }
    void resetCalibMdfBuffer();
    float getFatigueLevel() const { return m_fatigue; }

    // MDF相关方法
    float calculateMDF();
    float getMDF() const;
    float getSignalQuality() const;
    bool isContracting() const;
    void setFFTWindowSize(uint16_t size);
    void setMDFFrequencyRange(float min_freq, float max_freq);
    void resetEMA();  // [FIX-v3.9.6] 校准阶段切换时重置 EMA

    // 调试和诊断方法
    void enableDebug(bool enable) { m_debugEnabled = enable; m_debugLevel = enable ? DEBUG_NORMAL : DEBUG_NONE; }
    void setDebugLevel(DebugLevel level) { m_debugLevel = level; }
    DebugLevel getDebugLevel() const { return m_debugLevel; }

    // 测试信号注入
    void injectTestSignal(float frequency_hz, float amplitude_mv, uint16_t samples);

    // 获取功率谱总功率
    float getLastTotalPower() const { return m_lastTotalPower; }
    float getRawMDF() const { return m_rawMDF; }

    // 缓冲区状态监控
    uint16_t getBufferAvailable() const { return m_availableSamples; }
    uint16_t getBufferCapacity() const { return RING_BUFFER_SIZE; }
    float getActualSampleRate() const { return m_actualSampleRate; }
    uint32_t getDroppedSamples() const { return m_droppedSamples; }

    void resetBuffer();

    // v2: drain all new samples from ring buffer into user buffer
    // returns number of samples drained (0 if empty)
    uint16_t drainNewSamples(int16_t* outBuf, uint16_t maxCount);
    void resetSampleRateStats();

private:
    // 缓冲区大小定义
    static const uint16_t RING_BUFFER_SIZE = 512;
    static const uint16_t RING_BUFFER_MASK = 511;
    static const uint16_t MAX_FFT_SIZE = 256;
    static const uint16_t DEFAULT_FFT_SIZE = 256;
    static const uint16_t QUALITY_WINDOW_SIZE = 50;

    // 环形缓冲区
    int16_t m_ringBuffer[RING_BUFFER_SIZE];
    volatile uint16_t m_writeIndex;
    uint16_t m_readIndex;

    // 信号处理状态
    float m_fatigue;         // 0-100 (%)
    float m_activation;      // 0-100 (%)
    float m_relaxRMS_mV;
    float m_activeRMS_mV;
    float m_relaxMDF_hz;
    float m_baselineMDF_hz;   // dynamic baseline per contraction
    bool m_wasActive20;       // for contraction onset detection
    float m_contractionStartMDF;  // [v3.9.11] 收缩开始时的MDF，用于疲劳度计算
    bool m_isCalibrated;
    bool m_isContracting;

    // MDF计算相关
    float m_currentMDF;
    float m_lastValidMDF;
    bool m_isMdfValid;
    float m_signalQuality;
    uint16_t m_fftWindowSize;
    float m_mdfMinFreq;
    float m_mdfMaxFreq;

    // 调试和诊断
    float m_lastTotalPower;
    float m_rawMDF;
    bool m_debugEnabled;
    DebugLevel m_debugLevel;

    // 静态FFT缓冲区
    float m_fftInputBuffer[MAX_FFT_SIZE];
    float m_fftImagBuffer[MAX_FFT_SIZE];
    float m_powerSpectrum[MAX_FFT_SIZE / 2];
    float m_fftTwiddleReal[MAX_FFT_SIZE / 2];
    float m_fftTwiddleImag[MAX_FFT_SIZE / 2];
    bool m_fftTwiddleInitialized;

    // 采样率统计
    uint32_t m_lastSampleTime;
    float m_actualSampleRate;
    uint32_t m_sampleCount;
    uint32_t m_sampleTimeAccum;

    // 缓冲区状态跟踪
    volatile uint16_t m_availableSamples;
    uint32_t m_droppedSamples;

    // 状态机辅助变量
    uint16_t m_consecutivePhysioFrames;
    uint16_t m_qualityValidFrames;
    uint16_t m_qualityTotalFrames;
    bool m_qualityWindowFull;

    // 共享快照缓存
    int16_t m_snapshot[MAX_FFT_SIZE];
    float m_snapshotDCBias;
    bool m_snapshotValid;
    uint16_t m_snapshotSize;

    // RMS 预计算系数
    float m_mvPerAdcUnit;

    // 私有方法
    float calculateRMS();
    void takeSnapshotIfNeeded(uint16_t window_size);
    void updateFatigue(float rms, float mdf);
    void evaluateSignalQuality(float rms, float mdf);
    uint16_t safeGetStartIndex(uint16_t window_size);

    void initializeFFTTwiddles();
    static void bitReverse(float* real, float* imag, uint16_t n);
    void fftRealInPlace(float* data_real, float* data_imag, uint16_t n);
    void calculatePowerSpectrum();
    float findMedianFrequency(const float* power_spectrum,
                              uint16_t num_bins,
                              float sample_rate,
                              float min_freq,
                              float max_freq);

    float m_currentRMS;           // 当前实时RMS

    // [v3.9.24] 校准MDF缓冲区
    static const uint16_t CALIB_MDF_BUF_SIZE = 200;
    float m_calibMdfBuffer[CALIB_MDF_BUF_SIZE];  // 校准阶段MDF值环形缓冲
    uint16_t m_calibMdfIndex;                         // 缓冲区写入索引
    uint16_t m_calibMdfCount;                         // 缓冲区有效样本数
    float m_calibMdfPeak;                             // 校准阶段MDF峰值
    float m_calibMdfEnd;                               // 校准阶段结束时MDF
};

#endif // SIGNAL_PROCESSOR_H