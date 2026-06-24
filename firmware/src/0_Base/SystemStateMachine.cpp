#include "SystemStateMachine.h"
#include "0_Base/Logger.h"

void StateManager::init()
{
    _state = ST_BOOT;
    _prevState = ST_BOOT;
    _phaseActive = false;
    _phaseDurationMs = 0;
    _errorMsg[0] = '\0';
}

bool StateManager::_validTransition(SystemState_t from, SystemState_t to)
{
    // [FIX] 允许自转换（RUNNING→RUNNING），避免 reset_calib 等操作误入 ERROR
    if (from == to) return true;
    // 3-state machine: BOOT→RUNNING, ERROR→RUNNING, RUNNING→ERROR
    if (from == ST_BOOT) return (to == ST_RUNNING);
    if (from == ST_RUNNING) return (to == ST_ERROR);
    if (from == ST_ERROR) return (to == ST_RUNNING);
    return false;
}

bool StateManager::transitionTo(SystemState_t newState)
{
    if (!_validTransition(_state, newState)) {
        snprintf(_errorMsg, sizeof(_errorMsg), "Bad transition from %s", getStateName());
        LOG("[STATE] ERROR: %s\n", _errorMsg);
        _prevState = _state;
        _state = ST_ERROR;
        return false;
    }

    LOG("[STATE] %s -> %s\n", getStateName(),
        newState == ST_RUNNING     ? "RUNNING" :
        newState == ST_ERROR       ? "ERROR"  : "???");

    _prevState = _state;
    _state = newState;
    _phaseActive = false;
    _errorMsg[0] = '\0';
    return true;
}

SystemState_t StateManager::getState() const
{
    return _state;
}

const char* StateManager::getStateName() const
{
    switch (_state) {
        case ST_BOOT:        return "BOOT";
        case ST_RUNNING:     return "RUNNING";
        case ST_ERROR:       return "ERROR";
        default:             return "?";
    }
}

void StateManager::startCalibPhase(uint16_t durationSec)
{
    _phaseStartMs = millis();
    _phaseDurationMs = (uint32_t)durationSec * 1000UL;
    _phaseActive = true;
}

bool StateManager::isCalibPhaseComplete() const
{
    if (!_phaseActive) {
        // [DEBUG] 只在前10次打印（避免刷屏）
        static uint8_t _dbgCount = 0;
        if (_dbgCount++ < 10) {
            LOG("[STATE] isCalibPhaseComplete: NOT active (state=%s)\n", getStateName());
        }
        return false;
    }
    uint32_t elapsed = millis() - _phaseStartMs;
    if (elapsed >= _phaseDurationMs) {
        LOG("[STATE] Phase COMPLETE! elapsed=%lu >= dur=%lu\n",
            (unsigned long)elapsed, (unsigned long)_phaseDurationMs);
        return true;
    }
    return false;
}

uint8_t StateManager::getCalibProgress() const
{
    if (!_phaseActive) return 0;
    uint32_t elapsed = millis() - _phaseStartMs;
    if (elapsed >= _phaseDurationMs) return 100;
    // 倒计时百分比（校准阶段通过 3-10 秒）
    uint8_t pct = (uint8_t)((elapsed * 100UL) / _phaseDurationMs);
    return pct;
}

void StateManager::setError(const char* msg)
{
    strncpy(_errorMsg, msg, sizeof(_errorMsg) - 1);
    _errorMsg[sizeof(_errorMsg) - 1] = '\0';
    LOG("[STATE] ERROR: %s\n", _errorMsg);
    _prevState = _state;
    _state = ST_ERROR;
}

const char* StateManager::getErrorMsg() const
{
    return _errorMsg;
}
