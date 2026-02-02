//打印helloworld
#include <stdio.h>
int main() {
    printf("Hello, World!\n");
    return 0;
}
//写一个adc均值滤波
int adc_mean_filter(int *adc_values, int length) {
    int sum = 0;
    for (int i = 0; i < length; i++) {
        sum += adc_values[i];
    }
    return sum / length;
}
//写一个adc中值滤波
int adc_median_filter(int *adc_values, int length) {
    int median = 0;
    for (int i = 0; i < length; i++) {
        for (int j = i + 1; j < length; j++) {
            if (adc_values[i] > adc_values[j]) {
                int temp = adc_values[i];
                adc_values[i] = adc_values[j];
                adc_values[j] = temp;
            }
        }
    }
    return adc_values[length / 2];
}
//写一个adc方差滤波
int adc_variance_filter(int *adc_values, int length) {
    int variance = 0;   
    int mean = adc_mean_filter(adc_values, length);
    for (int i = 0; i < length; i++) {
        variance += (adc_values[i] - mean) * (adc_values[i] - mean);
    }
    return variance / length;
}
//写一个adc标准差滤波
int adc_standard_deviation_filter(int *adc_values, int length) {
    int standard_deviation = 0;
    int variance = adc_variance_filter(adc_values, length);
    return sqrt(variance);
}
//心率传感器max30102写一个自适应阈值算法
int adaptive_threshold_algorithm(int *adc_values, int length) {
    int threshold = 0;
    int mean = adc_mean_filter(adc_values, length);
    for (int i = 0; i < length; i++) {
        if (adc_values[i] > mean) {
            threshold += adc_values[i];
        }
    }
    return threshold / length;
}

//atgm336h卫星解析函数
int atgm336h_satellite_parser(int *satellite_data, int length) {
    int satellite_data = 0;
    for (int i = 0; i < length; i++) {
        satellite_data += satellite_data[i];
    }
    return satellite_data / length;
}