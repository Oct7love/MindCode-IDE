#include "main.h"

extern ADC_HandleTypeDef hadc1;

// 单次读取
uint16_t ADC_Read(void)
{
    HAL_ADC_Start(&hadc1);
    if (HAL_ADC_PollForConversion(&hadc1, 10) == HAL_OK) {
        return HAL_ADC_GetValue(&hadc1);
    }
    return 0;
}