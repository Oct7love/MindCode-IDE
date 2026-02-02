#define MEDIAN_SIZE 5

uint16_t ADC_MedianFilter(void)
{
    uint16_t buf[MEDIAN_SIZE];
    
    // 采集
    for (uint8_t i