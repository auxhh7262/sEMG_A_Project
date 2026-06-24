// #define MDF_DBG_ENABLED  // 取消注释以启用MDF调试日志（会产生大量串口输出）
#include "0_Base/Board.h"
#include "0_Base/Logger.h"
#include "SignalProcessor.h"

#include <Arduino.h>
#include <cmath>
#include <cstring>

// ==================== 调试日志宏（已修复快捷键缺失问题）====================
#define SIGNAL_PROCESSOR_VERSION "V1.0.0"
#define SIGNAL_PROCESSOR_DATE "2026-05-12"

// ==================== 初始化与重置 ====================
#ifndef RING_BUFFER_SIZE
#define RING_BUFFER_SIZE 512
#endif
#ifndef RING_BUFFER_MASK
#define RING_BUFFER_MASK 511
#endif
#ifndef MAX_FFT_SIZE
#define MAX_FFT_SIZE 256
#endif
#ifndef QUALITY_WINDOW_SIZE
#define QUALITY_WINDOW_SIZE 50
#endif

// ==================== 调试日志宏（已修复快捷键缺失问题）====================
#define SP_LOG(level, fmt, ...) do { \
    if (m_debugEnabled && level <= m_debugLevel) \
        LOG("[SIGNAL] " fmt, ##__VA_ARGS__); \
} while(0)

#define SP_LOG_MINIMAL(fmt, ...) SP_LOG(DEBUG_MINIMAL, fmt, ##__VA_ARGS__)
#define SP_LOG_NORMAL(fmt, ...) SP_LOG(DEBUG_NORMAL, fmt, ##__VA_ARGS__)
#define SP_LOG_VERBOSE(fmt, ...) SP_LOG(DEBUG_VERBOSE, fmt, ##__VA_ARGS__)
#define SP_LOG_FULL(fmt, ...) SP_LOG(DEBUG_FULL, fmt, ##__VA_ARGS__)

// ==================== 初始化与重置 ====================
SignalProcessor::SignalProcessor() :
    m_writeIndex(0), m_readIndex(0),
    m_fatigue(0.0f), m_activation(0.0f),
    m_relaxRMS_mV(0.0f), m_activeRMS_mV(0.0f),  // 0=未校准,避免默认计算出100%activation
    m_relaxMDF_hz(100.0f),
    m_contractionStartMDF(0.0f),  // [v3.9.11]
    m_isCalibrated(false),
    m_isContracting(false),
    m_currentMDF(50.0f), m_lastValidMDF(50.0f), m_isMdfValid(false),
    m_signalQuality(0.0f),
    m_fftWindowSize(DEFAULT_FFT_SIZE),
    m_mdfMinFreq(10.0f), m_mdfMaxFreq(250.0f),
    m_lastTotalPower(0.0f), m_rawMDF(0.0f),
    m_debugEnabled(false), m_debugLevel(DEBUG_NONE),
    m_fftTwiddleInitialized(false),
    m_lastSampleTime(0), m_actualSampleRate(1000.0f),
    m_sampleCount(0), m_sampleTimeAccum(0),
    m_availableSamples(0),
    m_droppedSamples(0),
    m_consecutivePhysioFrames(0),
    m_qualityValidFrames(0), m_qualityTotalFrames(0), m_qualityWindowFull(false),
    m_snapshotDCBias(0.0f), m_snapshotValid(false), m_snapshotSize(0),
    m_mvPerAdcUnit(0.0f),
    m_baselineMDF_hz(0.0f),
    m_wasActive20(false),
    m_currentRMS(0.0f),
    // [v3.9.24] 校准MDF缓冲区初始化
    m_calibMdfIndex(0),
    m_calibMdfCount(0),
    m_calibMdfPeak(0.0f),
    m_calibMdfEnd(0.0f)
{
    memset(m_ringBuffer, 0, sizeof(m_ringBuffer));
    memset(m_fftInputBuffer, 0, sizeof(m_fftInputBuffer));
    memset(m_fftImagBuffer, 0, sizeof(m_fftImagBuffer));
    memset(m_powerSpectrum, 0, sizeof(m_powerSpectrum));
    memset(m_fftTwiddleReal, 0, sizeof(m_fftTwiddleReal));
    memset(m_fftTwiddleImag, 0, sizeof(m_fftTwiddleImag));
    memset(m_snapshot, 0, sizeof(m_snapshot));
}

// ==================== 初始化与重置 ====================
void SignalProcessor::init() {
    m_writeIndex = 0; m_readIndex = 0;
    m_fatigue = 0.0f; m_activation = 0.0f; m_isCalibrated = false;
    m_contractionStartMDF = 0.0f;
    m_isContracting = false;
    m_currentMDF = 0.0f; m_lastValidMDF = 80.0f; m_isMdfValid = false;
    m_signalQuality = 0.0f; m_lastTotalPower = 0.0f; m_rawMDF = 0.0f;
    m_debugEnabled = false; m_debugLevel = DEBUG_NONE;
    m_lastSampleTime = micros();
    m_actualSampleRate = 1000.0f;
    m_sampleCount = 0; m_sampleTimeAccum = 0;
    m_availableSamples = 0; m_droppedSamples = 0;
    m_consecutivePhysioFrames = 0;
    m_qualityValidFrames = 0; m_qualityTotalFrames = 0; m_qualityWindowFull = false;
    m_snapshotDCBias = 0.0f; m_snapshotValid = false; m_snapshotSize = 0;
    
    m_mvPerAdcUnit = ADC_REF_MV / (float)ADC_MAX_VALUE;
    initializeFFTTwiddles();
    SP_LOG_NORMAL("SignalProcessor initialized. Version: %s (%s)\n", SIGNAL_PROCESSOR_VERSION, SIGNAL_PROCESSOR_DATE);
}


// v2: drain all available new samples from ring buffer
uint16_t SignalProcessor::drainNewSamples(int16_t* outBuf, uint16_t maxCount) {
    noInterrupts();
    uint16_t avail = m_availableSamples;
    if (avail == 0) {
        interrupts();
        return 0;
    }
    uint16_t count = (avail < maxCount) ? avail : maxCount;
    // oldest samples first: read from (writeIndex - avail)
    uint16_t startIdx = (m_writeIndex - avail) & RING_BUFFER_MASK;
    for (uint16_t i = 0; i < count; i++) {
        outBuf[i] = m_ringBuffer[(startIdx + i) & RING_BUFFER_MASK];
    }
    m_availableSamples -= count;
    m_readIndex = (startIdx + count) & RING_BUFFER_MASK;
    interrupts();
    return count;
}

void SignalProcessor::resetBuffer() {
    noInterrupts();
    m_writeIndex = 0;
    m_availableSamples = 0;
    interrupts();
    SP_LOG_NORMAL("Buffer reset\n");
}

// ==================== ISR安全环形缓冲区 ====================
uint16_t SignalProcessor::safeGetStartIndex(uint16_t window_size) {
    if (window_size > RING_BUFFER_SIZE) window_size = RING_BUFFER_SIZE;
    uint32_t write_idx = m_writeIndex;
    if (write_idx >= window_size)
        return static_cast<uint16_t>(write_idx - window_size);
    return RING_BUFFER_SIZE - (window_size - static_cast<uint16_t>(write_idx));
}

void SignalProcessor::isrPushSample(int16_t sample) {
    noInterrupts();
    m_ringBuffer[m_writeIndex] = sample;
    m_writeIndex = (m_writeIndex + 1) & RING_BUFFER_MASK;
    if (m_availableSamples < RING_BUFFER_SIZE) {
        m_availableSamples++;
    } else {
        m_droppedSamples++;
    }
    interrupts();
}

// ==================== 采样率统计 ====================
void SignalProcessor::updateSampleRateStats() {
    uint32_t currentTime = micros();
    if (m_lastSampleTime > 0 && m_lastSampleTime < currentTime) {
        uint32_t interval = currentTime - m_lastSampleTime;
        m_sampleTimeAccum += interval;
        m_sampleCount++;
        if (m_sampleCount >= 100) {
            float avgIntervalSec = m_sampleTimeAccum / 1000000.0f / m_sampleCount;
            if (avgIntervalSec > 0.0f) {
                m_actualSampleRate = 1.0f / avgIntervalSec;
            }
            m_sampleCount = 0;
            m_sampleTimeAccum = 0;
        }
    }
    m_lastSampleTime = currentTime;
}

// ==================== 快照缓存 ====================
// [FIX-v3.9.10] 不再原地排序！排序会破坏时序，导致RMS计算错误
// DC偏移用简单均值（512样本已足够稳定，无需裁剪均值）
void SignalProcessor::takeSnapshotIfNeeded(uint16_t window_size) {
    if (m_snapshotValid && m_snapshotSize == window_size) return;
    if (window_size == 0 || window_size > RING_BUFFER_SIZE) return;

    noInterrupts();
    uint16_t start_idx = safeGetStartIndex(window_size);
    float sum = 0.0f;
    for (uint16_t i = 0; i < window_size; i++) {
        m_snapshot[i] = m_ringBuffer[(start_idx + i) & RING_BUFFER_MASK];
        sum += m_snapshot[i];
    }
    interrupts();

    // 简单均值计算DC偏移（保留时序完整性）
    m_snapshotDCBias = (sum / (float)window_size) * m_mvPerAdcUnit;
    m_snapshotSize = window_size;
    m_snapshotValid = true;

    // [DEBUG-v3.9.10b] 原始ADC诊断：打印min/max/mean
    static uint32_t _lastSnapDbgMs = 0;
    if (millis() - _lastSnapDbgMs >= 2000) {
        _lastSnapDbgMs = millis();
        int16_t snapMin = m_snapshot[0], snapMax = m_snapshot[0];
        for (uint16_t i = 1; i < window_size; i++) {
            if (m_snapshot[i] < snapMin) snapMin = m_snapshot[i];
            if (m_snapshot[i] > snapMax) snapMax = m_snapshot[i];
        }
        float snapMean = sum / (float)window_size;
        // [SNAP_DBG] removed - was spamming boot output
        // LOG("[SNAP_DBG] N=%u min=%d max=%d mean=%.1f DCbias=%.2fmV\n",
        //     window_size, snapMin, snapMax, snapMean, m_snapshotDCBias);
    }
}

// ==================== RMS 计算 + P1 疲劳度 ====================
float SignalProcessor::calculateRMS() {
    const uint16_t window_size = m_fftWindowSize;
    if (m_availableSamples < window_size) return 0.0f;
    takeSnapshotIfNeeded(window_size);

    float sum_squares = 0.0f;
    for (uint16_t i = 0; i < window_size; i++) {
        float voltage = m_snapshot[i] * m_mvPerAdcUnit;
        float ac = voltage - m_snapshotDCBias;
        sum_squares += ac * ac;
    }
    return sqrtf(sum_squares / (float)window_size);
}

// ==================== FFT 核心 ====================
void SignalProcessor::initializeFFTTwiddles() {
    if (m_fftTwiddleInitialized) return;
    uint16_t half_n = m_fftWindowSize / 2;
    for (uint16_t i = 0; i < half_n; i++) {
        float theta = -2.0f * PI * i / m_fftWindowSize;
        m_fftTwiddleReal[i] = cosf(theta);
        m_fftTwiddleImag[i] = sinf(theta);
    }
    m_fftTwiddleInitialized = true;
}

void SignalProcessor::bitReverse(float* real, float* imag, uint16_t n) {
    uint16_t j = 0;
    for (uint16_t i = 0; i < n - 1; i++) {
        if (i < j) {
            float tr = real[i], ti = imag[i];
            real[i] = real[j]; imag[i] = imag[j];
            real[j] = tr; imag[j] = ti;
        }
        uint16_t k = n >> 1;
        while (k <= j) { j -= k; k >>= 1; }
        j += k;
    }
}

void SignalProcessor::fftRealInPlace(float* real, float* imag, uint16_t n) {
    bitReverse(real, imag, n);
    for (uint16_t len = 2; len <= n; len <<= 1) {
        uint16_t half_len = len >> 1;
        uint16_t step = n / len;
        for (uint16_t i = 0; i < n; i += len) {
            for (uint16_t j = 0; j < half_len; j++) {
                uint16_t tidx = j * step;
                float wr = m_fftTwiddleReal[tidx];
                float wi = m_fftTwiddleImag[tidx];
                uint16_t u = i + j, v = i + j + half_len;
                float tr = real[v] * wr - imag[v] * wi;
                float ti = real[v] * wi + imag[v] * wr;
                real[v] = real[u] - tr; imag[v] = imag[u] - ti;
                real[u] += tr; imag[u] += ti;
            }
        }
    }
}

// ==================== 功率谱计算 ====================
void SignalProcessor::calculatePowerSpectrum() {
    if (m_fftWindowSize < 2) return;
    if (!m_fftTwiddleInitialized) initializeFFTTwiddles();
    memset(m_fftImagBuffer, 0, sizeof(float) * m_fftWindowSize);

    for (uint16_t i = 0; i < m_fftWindowSize; i++) {
        float v = m_snapshot[i] * m_mvPerAdcUnit - m_snapshotDCBias;
        float w = 0.5f * (1.0f - cosf(2.0f * PI * i / (m_fftWindowSize - 1)));
        m_fftInputBuffer[i] = v * w;
    }

    fftRealInPlace(m_fftInputBuffer, m_fftImagBuffer, m_fftWindowSize);

    uint16_t half_n = m_fftWindowSize / 2;
    m_lastTotalPower = 0.0f;
    bool hasNaN = false;
    
    for (uint16_t i = 0; i < half_n; i++) {
        float real = m_fftInputBuffer[i];
        float imag = m_fftImagBuffer[i];
        float p = (real * real + imag * imag) / (float)m_fftWindowSize;
        // [FIX-v3.9.8] NaN/Inf保护：ADC饱和导致FFT结果异常
        if (!isnan(p) && !isinf(p)) {
            m_powerSpectrum[i] = p;
            m_lastTotalPower += p;
        } else {
            m_powerSpectrum[i] = 0.0f;  // 静默替换异常值
            hasNaN = true;
        }
    }
    if (hasNaN) {
#ifdef MDF_DBG_ENABLED
        LOG("[MDF_DBG] NaN_IN_FFT!");
#endif
    }
}

// ==================== MDF 计算 ====================
float SignalProcessor::findMedianFrequency(
    const float* power_spectrum,
    uint16_t num_bins,
    float sample_rate,
    float min_freq,
    float max_freq
) {
    // [DEBUG] 入口参数诊断
#ifdef MDF_DBG_ENABLED
    LOG("[MDF_DBG] ENTER sr=%.0f fmin=%.0f fmax=%.0f bins=%d",
        (double)sample_rate, (double)min_freq, (double)max_freq, (int)num_bins);
#endif

    // [FIX-v3.9.7] 异常时返回-1.0f（错误标记），不返回m_lastValidMDF
    // 旧代码返回m_lastValidMDF导致自引用循环：
    // resetEMA()设m_lastValidMDF=80.0 → fallback返回80.0 → 被当rawMDF → EMA接受80.0 → 锁死
    if (sample_rate < 100.0f) {
#ifdef MDF_DBG_ENABLED
        LOG("[MDF_DBG] BAD_SR sr=%.1f", (double)sample_rate);
#endif
        return -1.0f;
    }

    float nyquist = sample_rate / 2.0f;
    float effective_max = fmin(max_freq, nyquist);
    float freq_res = sample_rate / m_fftWindowSize;

    float total_power = 0.0f;
    for (uint16_t i = 3; i < num_bins; i++) {
        float freq = i * freq_res;
        if (freq >= min_freq && freq <= effective_max) {
            total_power += power_spectrum[i];
        }
    }
    // [DEBUG] 打印total_power（关键诊断：1e-12f阈值判断）
    if (total_power < 1e-12f) {
#ifdef MDF_DBG_ENABLED
        LOG("[MDF_DBG] LOW_POWER tp=%.8f < 1e-12", (double)total_power);
#endif
        return -1.0f;
    }

    float half_power = total_power * 0.5f;
    float accumulated = 0.0f, prev_accumulated = 0.0f;
    float prev_freq = 0.0f;

    for (uint16_t i = 1; i < num_bins; i++) {
        float freq = i * freq_res;
        if (freq >= min_freq && freq <= effective_max) {
            float bp_val = power_spectrum[i];
            // [FIX-v3.9.8] 跳过NaN/Inf bins
            if (isnan(bp_val) || isinf(bp_val)) continue;
            prev_accumulated = accumulated;
            accumulated += bp_val;
            if (accumulated >= half_power) {
                if (bp_val > 0.0f) {
                    float ratio = (half_power - prev_accumulated) / bp_val;
                    float mdf_result = prev_freq + ratio * freq_res;
#ifdef MDF_DBG_ENABLED
                    LOG("[MDF_DBG] OK tp=%.4f MDF=%.1f", (double)total_power, (double)mdf_result);
#endif
                    return mdf_result;
                }
                return freq;
            }
        }
        prev_freq = freq;
    }
    // [DEBUG] 诊断：为何accumulated未达half_power
#ifdef MDF_DBG_ENABLED
    LOG("[MDF_DBG] LOOP_END tp=%.4f acc=%.4f hp=%.4f bins=%d fmin=%.0f fmax=%.0f",
        (double)total_power, (double)accumulated, (double)half_power,
        (int)num_bins, (double)min_freq, (double)effective_max);
#endif
    return -1.0f;  // [FIX-v3.9.7] 频谱异常无法定位MDF
}

float SignalProcessor::calculateMDF() {
    if (m_availableSamples < m_fftWindowSize) {
        m_isMdfValid = false;
        return 0.0f;
    }

    takeSnapshotIfNeeded(m_fftWindowSize);
    calculatePowerSpectrum();

    // [FIX-v3.9.9] 使用ADC定时器固定采样率，不用m_actualSampleRate
    // m_actualSampleRate测量的是loop迭代速率，不是ADC真实采样率
    // WiFi通信会拖慢loop，导致m_actualSampleRate崩到17-25Hz
    // ADC定时器配置为1000Hz（见main.cpp adc_timer.begin(1000.0f)）
    constexpr float ADC_SAMPLE_RATE = 1000.0f;
    m_rawMDF = findMedianFrequency(
        m_powerSpectrum,
        m_fftWindowSize / 2,
        ADC_SAMPLE_RATE,
        m_mdfMinFreq,
        m_mdfMaxFreq
    );
#ifdef MDF_DBG_ENABLED
    LOG("[MDF_DBG] rawMDF=%.2f curMDF=%.2f lastValid=%.2f",
        (double)m_rawMDF, (double)m_currentMDF, (double)m_lastValidMDF);
#endif

    // [FIX-v3.9.7] findMedianFrequency异常时返回-1.0f，跳过本次EMA更新
    if (m_rawMDF < 0.0f) {
        // FFT无效（功率太小或采样率异常），保持上次有效MDF，不更新EMA
        m_consecutivePhysioFrames = 0;
        // 不修改m_currentMDF/m_lastValidMDF/m_isMdfValid
#ifdef MDF_DBG_ENABLED
        LOG("[MDF_DBG] -> rawMDF<0, return m_currentMDF=%.2f (hold)", (double)m_currentMDF);
#endif
        return m_currentMDF;
    }

    // [FIX-v3.9.6] 放宽上限180→250Hz：肌肉收缩时MDF可达200+Hz
    // 之前180Hz上限导致rawMDF被丢弃，EMA永远输出上次值→MAX阶段锁死
    bool is_physiological = (m_rawMDF >= 10.0f && m_rawMDF <= 250.0f);
    bool is_acceptable = (m_rawMDF >= 8.0f && m_rawMDF < 10.0f);

    if (is_physiological || is_acceptable) {
        m_consecutivePhysioFrames++;
        // ========== MDF EMA α 取值依据 ==========
        // 参考文献:
        // [1] De Luca CJ. The use of surface electromyography in biomechanics.
        //     J Applied Biomechanics, 1997, 13(2):135-163.
        //     → 确立 MDF 为肌肉疲劳评估金标准；推荐使用 0.5-2s 窗口进行频谱估计
        // [2] Merletti R, Knaflitz M, De Luca CJ. Myoelectric manifestations of
        //     fatigue in voluntary and electrically elicited contractions.
        //     J Applied Physiology, 1990, 69(5):1810-1820.
        //     → 证实疲劳过程中 MDF 呈单调下降趋势，下降速率与收缩强度相关
        // [3] Merletti R, Parker PA. Electromyography: Physiology, Engineering,
        //     and Non-Invasive Applications. IEEE Press/Wiley, 2004.
        //     → Ch.9: 频谱估计中 EMA 为实时嵌入式系统的推荐平滑方法
        //
        // α 选择策略：
        // - 收缩期/MDF下降期 α=0.35: 文献[2]表明 MDF 在疲劳时可快速下降
        //   10-30%，需要较大 α 快速跟踪变化，等效时间常数 ≈3帧(150ms)
        // - 稳态期 α=0.15: 对应 0.5-2s 平滑窗口[1]，抑制逐帧波动
        // - 启动过渡(0.5→0.15): 前10帧从快速收敛过渡到稳态平滑，
        //   避免初始值偏差导致的长时间收敛等待
        // ===========================================
        float alpha;
// [FIX-v3.9.6] 收缩状态时使用更高alpha，更快跟踪频谱变化
        if (m_isContracting) {
            alpha = 0.35f;  // 收缩时需要更快响应，避免EMA滞后
        } else if (m_rawMDF < m_lastValidMDF && m_isMdfValid) {
            alpha = 0.35f;  // MDF下降时较快跟踪（疲劳趋势）
        } else {
            if (m_consecutivePhysioFrames >= 10) {
                alpha = 0.15f;  // 稳态下慢速平滑
            } else {
                alpha = 0.5f - 0.35f * (m_consecutivePhysioFrames / 10.0f);
            }
        }
        if (m_isMdfValid && m_lastValidMDF > 0.0f) {
            m_currentMDF = m_lastValidMDF * (1.0f - alpha) + m_rawMDF * alpha;
        } else {
            m_currentMDF = m_rawMDF;
        }
        m_lastValidMDF = m_currentMDF;
        m_isMdfValid = true;
#ifdef MDF_DBG_ENABLED
        LOG("[MDF_DBG] EMA OK: rawMDF=%.2f alpha=%.2f -> m_currentMDF=%.2f",
            (double)m_rawMDF, (double)alpha, (double)m_currentMDF);
#endif
    } else {
        // rawMDF超出[8,250]Hz范围，视为异常
        m_consecutivePhysioFrames = 0;
        if (m_lastValidMDF > 0.0f) {
            m_currentMDF = m_lastValidMDF;
            m_isMdfValid = false;
        } else {
            m_currentMDF = 0.0f;
            m_isMdfValid = false;
        }
    }
    return m_currentMDF;
}

// ==================== 信号质量评估 ====================
void SignalProcessor::evaluateSignalQuality(float rms, float mdf) {
    float quality_score = 0.0f;
    
    if (m_isContracting) {
        if (rms > 0.1f && rms < 5.0f) {
            quality_score += 35.0f;
        } else if (rms > 0.01f) {
            quality_score += 15.0f;
        }
    } else {
        if (rms < 0.5f) {
            quality_score += 35.0f;
        }
    }

    if (m_isMdfValid) {
        quality_score += 35.0f;
    } else {
        quality_score += 15.0f;
    }

    // [v3.9.33] Reset BEFORE increment: window stays exactly QUALITY_WINDOW_SIZE frames
    if (m_qualityTotalFrames >= QUALITY_WINDOW_SIZE) {
        m_qualityTotalFrames = 0;
        m_qualityValidFrames = 0;
    }

    m_qualityTotalFrames++;
    if (m_isMdfValid) {
        m_qualityValidFrames++;
    }

    float continuity = (m_qualityTotalFrames > 0)
        ? (float)m_qualityValidFrames / m_qualityTotalFrames
        : 0.0f;

    quality_score += 30.0f * continuity;
    m_signalQuality = constrain(quality_score, 0.0f, 100.0f);
}

// ==================== 疲劳度 ====================
void SignalProcessor::updateFatigue(float rms, float mdf) {
    if (mdf <= 0.0f) {
        m_fatigue = 0.0f; m_activation = 0.0f; m_isContracting = false;
        return;
    }

    // [v3.9.30] Activation: A% = (RMS - relax_rms) / (active_rms - relax_rms) * 100
    // 输出 0-100%，与 fatigue 设计规则统一
    if (m_activeRMS_mV > m_relaxRMS_mV) {
        m_activation = ((rms - m_relaxRMS_mV) / (m_activeRMS_mV - m_relaxRMS_mV)) * 100.0f;
        m_activation = constrain(m_activation, 0.0f, 100.0f);
    } else {
        m_activation = 0.0f;
    }

    // [v3.9.14] Contraction detection: RMS > 2x relax_rms
    m_isContracting = (rms > m_relaxRMS_mV * 2.0f);

    // [v3.9.25] Fatigue: EMA-smoothed, dynamic baseline per contraction
    float f_raw = 0.0f;
    if (m_relaxMDF_hz > 0.1f) {
        float baseline_mdf = m_baselineMDF_hz > 0.1f ? m_baselineMDF_hz : m_relaxMDF_hz;
        f_raw = (baseline_mdf - mdf) / baseline_mdf * 100.0f;
        f_raw = constrain(f_raw, 0.0f, 100.0f);
    }
    // ========== Fatigue EMA α 取值依据 ==========
    // 疲劳指数公式: FI = (MDF_基线 - MDF_当前) / MDF_基线 × 100%
    // 参考文献:
    // [4] Cifrek M, Medved V, Tonković S, Ostojić S. Surface EMG based
    //     muscle fatigue evaluation in biomechanics.
    //     Clinical Biomechanics, 2009, 24(4):327-340.
    //     → 综述sEMG疲劳评估方法，归一化MDF下降率为标准疲劳指数
    // [5] González-Izal M, Malanda A, Gorostiaga E, Izquierdo M.
    //     Electromyographic models to assess muscle fatigue.
    //     J Electromyography and Kinesiology, 2012, 22(4):501-512.
    //     → 综述多种EMG疲劳模型，验证MDF下降率与主观疲劳量表(Borg)
    //       呈显著相关(r>0.7)
    //
    // α=0.1 选择依据:
    // - 肌肉疲劳是缓慢变化的生理过程(10-60s时间尺度)[1]
    // - α=0.1 对应时间常数 ≈10帧(0.5s@20Hz)，有效抑制逐帧抖动
    // - 适合作为视觉反馈输出：变化平滑、无突兀跳变
    // ==========================================
    // EMA smoothing (alpha=0.1)
    m_fatigue = m_fatigue * 0.9f + f_raw * 0.1f;
    if (m_fatigue < 0.0f) m_fatigue = 0.0f;
    if (m_fatigue > 100.0f) m_fatigue = 100.0f;

    // Dynamic baseline: capture at contraction onset (A crosses 20% upward)
    // m_isContracting set above: rms > 2x relax_rms (≈ A>66%)
    // Use a lower threshold for baseline capture: activation > 20%
    float activation = 0.0f;
    if (m_activeRMS_mV > m_relaxRMS_mV) {
        activation = constrain((rms - m_relaxRMS_mV) / (m_activeRMS_mV - m_relaxRMS_mV) * 100.0f, 0.0f, 100.0f);
    }
    if (!m_wasActive20 && activation > 20.0f) {
        // Contraction onset: capture current MDF as baseline
        m_baselineMDF_hz = mdf;
    }
    m_wasActive20 = (activation > 20.0f);

    static uint32_t fatigue_log_cnt = 0;
    if (++fatigue_log_cnt >= 600) {
        fatigue_log_cnt = 0;
        LOG("[SIG] Fatigue: mdf=%.1f, bl_mdf=%.1f, f_raw=%.1f, f_ema=%.1f, act=%.0f\n",
            mdf, (m_baselineMDF_hz > 0.1f ? m_baselineMDF_hz : m_relaxMDF_hz), f_raw, m_fatigue, activation);
    }
}

// ==================== 对外接口 ====================
float SignalProcessor::update() {
    if (m_availableSamples < m_fftWindowSize) return 0.0f;
    m_snapshotValid = false;

    float rms = calculateRMS();
    if (rms <= 0.0f) return 0.0f;

    // [v3.9.14] 更新当前实时值（用于简化校准）
    // rms is already in mV from calculateRMS()
    m_currentRMS = rms;

    float mdf = calculateMDF();
    evaluateSignalQuality(rms, mdf);
    updateFatigue(rms, mdf);

    return rms;
}

void SignalProcessor::setCalibration(float relaxRMS_mV, float activeRMS_mV, float relaxMDF_hz) {
    m_relaxRMS_mV = relaxRMS_mV;
    m_activeRMS_mV = activeRMS_mV;
    m_relaxMDF_hz = relaxMDF_hz;
    m_baselineMDF_hz = relaxMDF_hz;  // Initialize baseline MDF from calibration
    m_isCalibrated = true;
    m_contractionStartMDF = 0.0f;
}

void SignalProcessor::clearCalibration() {
    m_isCalibrated = false;
    m_fatigue = 0.0f;
    m_activation = 0.0f;
    m_isContracting = false;
    m_contractionStartMDF = 0.0f;
    m_lastValidMDF = 80.0f;
    m_isMdfValid = false;
    m_consecutivePhysioFrames = 0;
}

// [v3.9.14] 简化校准：获取当前实时RMS
float SignalProcessor::getCurrentRms() const {
    // 返回最近计算的RMS值（m_currentRMS由update()更新）
    // 注意：这是线程安全的近似值，精确值需要调用update()后获取
    return m_currentRMS;
}

// [v3.9.14] 简化校准：获取当前实时MDF
float SignalProcessor::getCurrentMdf() const {
    return m_currentMDF;
}

// [v3.9.14] 简化校准：设置放松基线
void SignalProcessor::setRelaxBaseline(float relaxRms, float relaxMdf) {
    m_relaxRMS_mV = relaxRms;
    m_relaxMDF_hz = relaxMdf;
    LOG("[SIG] Relax baseline set: rms=%.3f, mdf=%.1f\n", relaxRms, relaxMdf);
}

// [v3.9.14] 简化校准：设置收缩阶段参考
void SignalProcessor::setActiveReference(float activeRms) {
    m_activeRMS_mV = activeRms;
    LOG("[SIG] Active reference set: rms=%.3f\n", activeRms);
}

// [v3.9.24] 校准MDF缓冲区：记录校准阶段MDF值
void SignalProcessor::recordCalibMdf(float mdf_hz) {
    if (m_calibMdfCount < CALIB_MDF_BUF_SIZE) {
        m_calibMdfBuffer[m_calibMdfCount++] = mdf_hz;
    } else {
        // 缓冲区满，覆盖旧值（环形缓冲区）
        for (uint16_t i = 1; i < CALIB_MDF_BUF_SIZE; i++) {
            m_calibMdfBuffer[i-1] = m_calibMdfBuffer[i];
        }
        m_calibMdfBuffer[CALIB_MDF_BUF_SIZE - 1] = mdf_hz;
    }
    m_calibMdfIndex = m_calibMdfCount;  // 更新索引以保持兼容性
    SP_LOG_FULL("recordCalibMdf: count=%d, mdf=%.1f\n", m_calibMdfCount, mdf_hz);
}

// [v3.9.24] 校准MDF缓冲区：计算峰值和末尾值
void SignalProcessor::finalizeCalibMdf() {
    if (m_calibMdfCount == 0) {
        m_calibMdfPeak = 0.0f;
        m_calibMdfEnd = 0.0f;
        LOG("[SIG] finalizeCalibMdf: buffer empty\n");
        return;
    }
    
    // 计算峰值MDF
    m_calibMdfPeak = m_calibMdfBuffer[0];
    for (uint16_t i = 1; i < m_calibMdfCount; i++) {
        if (m_calibMdfBuffer[i] > m_calibMdfPeak) {
            m_calibMdfPeak = m_calibMdfBuffer[i];
        }
    }
    
    // 计算末尾MDF（最后5点去极值均值）
    int startIdx = max(0, (int)m_calibMdfCount - 5);
    int numPoints = m_calibMdfCount - startIdx;
    
    if (numPoints >= 3) {
        // 去极值均值：去掉最小和最大值，剩下的取平均
        float minVal = m_calibMdfBuffer[startIdx];
        float maxVal = m_calibMdfBuffer[startIdx];
        float sum = m_calibMdfBuffer[startIdx];
        
        for (int i = 1; i < numPoints; i++) {
            float val = m_calibMdfBuffer[startIdx + i];
            sum += val;
            if (val < minVal) minVal = val;
            if (val > maxVal) maxVal = val;
        }
        
        m_calibMdfEnd = (sum - minVal - maxVal) / (numPoints - 2);
    } else {
        // 点数不足，用简单平均
        float sum = 0.0f;
        for (int i = 0; i < numPoints; i++) {
            sum += m_calibMdfBuffer[startIdx + i];
        }
        m_calibMdfEnd = sum / numPoints;
    }
    
    LOG("[SIG] finalizeCalibMdf: peak=%.1f, end=%.1f\n", m_calibMdfPeak, m_calibMdfEnd);
}

// [v3.9.24] 重置校准MDF缓冲区
void SignalProcessor::resetCalibMdfBuffer() {
    m_calibMdfCount = 0;
    m_calibMdfIndex = 0;
    m_calibMdfPeak = 0.0f;
    m_calibMdfEnd = 0.0f;
    LOG("[SIG] Calib MDF buffer reset\n");
}

// [FIX-v3.9.6] 校准阶段切换时重置EMA状态
// REST→MAX切换时频谱形态巨变，EMA残值会严重滞后
void SignalProcessor::resetEMA() {
    m_isMdfValid = false;
    m_lastValidMDF = 0.0f;  // [FIX-v3.9.7] 80.0f→0.0f：防止findMedianFrequency fallback自引用锁死
    m_consecutivePhysioFrames = 0;
    m_currentMDF = 0.0f;
}

float SignalProcessor::getMDF() const { return m_currentMDF; }
float SignalProcessor::getFatigue() const { return m_fatigue; }
float SignalProcessor::getSignalQuality() const { return m_signalQuality; }
float SignalProcessor::getActivation() const { return m_activation; }
bool SignalProcessor::isContracting() const { return m_isContracting; }

void SignalProcessor::setFFTWindowSize(uint16_t size) {
    if (size < 64) size = 64;
    if (size > MAX_FFT_SIZE) size = MAX_FFT_SIZE;
    uint16_t pot = 64;
    while (pot < size && pot < MAX_FFT_SIZE) pot <<= 1;
    m_fftWindowSize = pot;
    m_fftTwiddleInitialized = false;
    initializeFFTTwiddles();
}

void SignalProcessor::setMDFFrequencyRange(float min_freq, float max_freq) {
    m_mdfMinFreq = constrain(min_freq, 0.0f, 250.0f);
    m_mdfMaxFreq = constrain(max_freq, m_mdfMinFreq + 1.0f, 250.0f);
}


