/**
 * @file    main.c
 * @brief   STM32 HAL库 外部中断按键控制LED
 * @note    适用于STM32F1系列，其他系列需修改头文件
 */

#include "stm32f1xx_hal.h"

/* ==================== 硬件配置 ==================== */
// LED配置 (PC13 - 很多开发板板载LED)
#define LED_PORT        GPIOC
#define LED_PIN         GPIO_PIN_13
#define LED_CLK_EN()    __HAL_RCC_GPIOC_CLK_ENABLE()

// 按键配置 (PA0 - 外部中断线0)
#define KEY_PORT        GPIOA
#define KEY_PIN         GPIO_PIN_0
#define KEY_CLK_EN()    __HAL_RCC_GPIOA_CLK_ENABLE()
#define KEY_IRQn        EXTI0_IRQn
#define KEY_IRQHandler  EXTI0_IRQHandler

/* ==================== 函数声明 ==================== */
static void SystemClock_Config(void);
static void LED_Init(void);
static void KEY_EXTI_Init(void);

/* ==================== 主函数 ==================== */
int main(void)
{
    HAL_Init();
    SystemClock_Config();
    LED_Init();
    KEY_EXTI_Init();
    
    // 初始状态：LED灭
    HAL_GPIO_WritePin(LED_PORT, LED_PIN, GPIO_PIN_SET);  // PC13低电平点亮，高电平熄灭
    
    while (1)
    {
        // 主循环空闲，LED控制在中断回调中完成
        __WFI();  // 等待中断，降低功耗
    }
}

/* ==================== 时钟配置 ==================== */
static void SystemClock_Config(void)
{
    RCC_OscInitTypeDef RCC_OscInit = {0};
    RCC_ClkInitTypeDef RCC_ClkInit = {0};
    
    // 使用HSI内部时钟 (无需外部晶振)
    RCC_OscInit.OscillatorType = RCC_OSCILLATORTYPE_HSI;
    RCC_OscInit.HSIState = RCC_HSI_ON;
    RCC_OscInit.HSICalibrationValue = RCC_HSICALIBRATION_DEFAULT;
    RCC_OscInit.PLL.PLLState = RCC_PLL_ON;
    RCC_OscInit.PLL.PLLSource = RCC_PLLSOURCE_HSI_DIV2;
    RCC_OscInit.PLL.PLLMUL = RCC_PLL_MUL16;  // 8MHz/2*16 = 64MHz
    HAL_RCC_OscConfig(&RCC_OscInit);
    
    RCC_ClkInit.ClockType = RCC_CLOCKTYPE_HCLK | RCC_CLOCKTYPE_SYSCLK |
                            RCC_CLOCKTYPE_PCLK1 | RCC_CLOCKTYPE_PCLK2;
    RCC_ClkInit.SYSCLKSource = RCC_SYSCLKSOURCE_PLLCLK;
    RCC_ClkInit.AHBCLKDivider = RCC_SYSCLK_DIV1;
    RCC_ClkInit.APB1CLKDivider = RCC_HCLK_DIV2;
    RCC_ClkInit.APB2CLKDivider = RCC_HCLK_DIV1;
    HAL_RCC_ClockConfig(&RCC_ClkInit, FLASH_LATENCY_2);
}

/* ==================== LED初始化 ==================== */
static void LED_Init(void)
{
    GPIO_InitTypeDef GPIO_Init = {0};
    
    LED_CLK_EN();
    
    GPIO_Init.Pin   = LED_PIN;
    GPIO_Init.Mode  = GPIO_MODE_OUTPUT_PP;
    GPIO_Init.Speed = GPIO_SPEED_FREQ_LOW;
    GPIO_Init.Pull  = GPIO_NOPULL;
    HAL_GPIO_Init(LED_PORT, &GPIO_Init);
}

/* ==================== 按键外部中断初始化 ==================== */
static void KEY_EXTI_Init(void)
{
    GPIO_InitTypeDef GPIO_Init = {0};
    
    KEY_CLK_EN();
    
    GPIO_Init.Pin   = KEY_PIN;
    GPIO_Init.Mode  = GPIO_MODE_IT_FALLING;  // 下降沿触发
    GPIO_Init.Pull  = GPIO_PULLUP;           // 内部上拉
    HAL_GPIO_Init(KEY_PORT, &GPIO_Init);
    
    // 配置NVIC
    HAL_NVIC_SetPriority(KEY_IRQn, 2, 0);
    HAL_NVIC_EnableIRQ(KEY_IRQn);
}

/* ==================== 中断服务函数 ==================== */
void KEY_IRQHandler(void)
{
    HAL_GPIO_EXTI_IRQHandler(KEY_PIN);
}

/* ==================== 中断回调函数 ==================== */
void HAL_GPIO_EXTI_Callback(uint16_t GPIO_Pin)
{
    if (GPIO_Pin == KEY_PIN)
    {
        // 简单软件消抖
        for (volatile uint32_t i = 0; i < 10000; i++);
        
        // 确认按键仍被按下
        if (HAL_GPIO_ReadPin(KEY_PORT, KEY_PIN) == GPIO_PIN_RESET)
        {
            HAL_GPIO_TogglePin(LED_PORT, LED_PIN);
        }
    }
}

/* ==================== SysTick中断 (HAL需要) ==================== */
void SysTick_Handler(void)
{
    HAL_IncTick();
}