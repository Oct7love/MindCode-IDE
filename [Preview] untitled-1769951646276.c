#define SAMPLE_COUNT 10

uint16_t ADC_AverageFilter(void)
{
    uint32_t sum = 0;
    for (uint8_t i = 0; i < SAMPLE_COUNT; i++) {
        sum += ADC_Read();
    }
    return (uint16_t)(sum / SAMPLE_COUNT);
}