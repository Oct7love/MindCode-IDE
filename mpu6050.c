/**
 * @file mpu6050.c
 * @brief MPU6050 六轴传感器驱动 (STM32 HAL库)
 */

#include "main.h"
#include <math.h>

/* ==================== 宏定义 ==================== */

// MPU6050 I2C地址 (AD0接地为0x68，接VCC为0x69)
#define MPU6050_ADDR            (0x68 << 1)

// 寄存器地址
#define MPU6050_REG_SMPLRT_DIV  0x19    // 采样率分频器
#define MPU6050_REG_CONFIG      0x1A    // 配置寄存器
#define MPU6050_REG_GYRO_CONFIG 0x1B    // 陀螺仪配置
#define MPU6050_REG_ACCEL_CONFIG 0x1C   // 加速度计配置
#define MPU6050_REG_ACCEL_XOUT_H 0x3B   // 加速度X轴高字节
#define MPU6050_REG_TEMP_OUT_H  0x41    // 温度高字节
#define MPU6050_REG_GYRO_XOUT_H 0x43    // 陀螺仪X轴高字节
#define MPU6050_REG_PWR_MGMT_1  0x6B    // 电源管理1
#define MPU6050_REG_PWR_MGMT_2  0x6C    // 电源管理2
#define MPU6050_REG_WHO_AM_I    0x75    // 设备ID寄存器

// 量程配置
#define MPU6050_GYRO_FS_250     0x00    // ±250°/s
#define MPU6050_GYRO_FS_500     0x08    // ±500°/s
#define MPU6050_GYRO_FS_1000    0x10    // ±1000°/s
#define MPU6050_GYRO_FS_2000    0x18    // ±2000°/s

#define MPU6050_ACCEL_FS_2G     0x00    // ±2g
#define MPU6050_ACCEL_FS_4G     0x08    // ±4g
#define MPU6050_ACCEL_FS_8G     0x10    // ±8g
#define MPU6050_ACCEL_FS_16G    0x18    // ±16g

// 灵敏度系数
#define MPU6050_ACCEL_SENS_2G   16384.0f
#define MPU6050_ACCEL_SENS_4G   8192.0f
#define MPU6050_ACCEL_SENS_8G   4096.0f
#define MPU6050_ACCEL_SENS_16G  2048.0f

#define MPU6050_GYRO_SENS_250   131.0f
#define MPU6050_GYRO_SENS_500   65.5f
#define MPU6050_GYRO_SENS_1000  32.8f
#define MPU6050_GYRO_SENS_2000  16.4f

/* ==================== 数据结构 ==================== */

// 原始数据结构
typedef struct {
    int16_t Accel_X_Raw;
    int16_t Accel_Y_Raw;
    int16_t Accel_Z_Raw;
    int16_t Gyro_X_Raw;
    int16_t Gyro_Y_Raw;
    int16_t Gyro_Z_Raw;
    int16_t Temp_Raw;
} MPU6050_RawData_t;

// 转换后数据结构 (物理单位)
typedef struct {
    float Accel_X;      // 单位: g
    float Accel_Y;
    float Accel_Z;
    float Gyro_X;       // 单位: °/s
    float Gyro_Y;
    float Gyro_Z;
    float Temp;         // 单位: ℃
} MPU6050_Data_t;

// MPU6050句柄
typedef struct {
    I2C_HandleTypeDef *hi2c;
    float Accel_Sens;   // 加速度灵敏度
    float Gyro_Sens;    // 陀螺仪灵敏度
    MPU6050_RawData_t RawData;
    MPU6050_Data_t Data;
} MPU6050_Handle_t;

/* ==================== 全局变量 ==================== */

static MPU6050_Handle_t hmpu6050;

/* ==================== 底层读写函数 ==================== */

/**
 * @brief 写单个寄存器
 */
static HAL_StatusTypeDef MPU6050_WriteReg(uint8_t reg, uint8_t data)
{
    return