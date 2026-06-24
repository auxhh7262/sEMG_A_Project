#ifndef SYSTEM_STATE_MACHINE_H
#define SYSTEM_STATE_MACHINE_H

#include <Arduino.h>
#include "0_Base/Globals.h"

class StateManager {
public:
    void init();

    bool transitionTo(SystemState_t newState);
    SystemState_t getState() const;
    const char* getStateName() const;

    void startCalibPhase(uint16_t durationSec);
    bool isCalibPhaseComplete() const;
    uint8_t getCalibProgress() const;  // 0~100

    void setError(const char* msg);
    const char* getErrorMsg() const;

private:
    SystemState_t _state, _prevState;
    uint32_t _phaseStartMs;
    uint16_t _phaseDurationMs;
    bool _phaseActive;
    char _errorMsg[64];

    bool _validTransition(SystemState_t from, SystemState_t to);
};

#endif // SYSTEM_STATE_MACHINE_H
