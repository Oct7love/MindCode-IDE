/* main.c - HAL库外部中断按键点灯示例 */
#include "stm32f1xx_hal.h"  // 根据实际型号修改，如stm32f4xx_hal.h

/* 引脚定义 */
#define LED_PIN         GPIO_PIN_5
#define LED_GPIO_PORT   GPIOA
#define KEY_PIN         GPIO_PIN_0
#define KEY_GPIO_PORT   GPIOA
#define KEY_EXTI_IRQn   EXTI0_IRQn

/* 全局变量 */
GPIO_InitTypeDef GPIO_InitStruct = {0};
volatile uint8_t key_pressed = 0;  // 按键按下标志

/* 函数声明 */
void SystemClock_Config(void);
void GPIO_Init(void);
void EXTI_Init(void);
void Error_Handler(void);

int main(void)
{
    /* HAL库初始化 */
    HAL_Init();
    
    /* 系统时钟配置 */
    SystemClock_Config();
    
    /* GPIO初始化 */
    GPIO_Init();
    
    /* 外部中断初始化 */
    EXTI_Init();
    
    /* 主循环 */
    while (1)
    {
        /* 检测按键按下标志 */
        if(key_pressed)
        {
            key_pressed = 0;  // 清除标志
            
            /* 简单延时消抖 */
            HAL_Delay(50);
            
            /* 读取按键状态确认 */
            if(HAL_GPIO_ReadPin(KEY_GPIO_PORT, KEY_PIN) == GPIO_PIN_RESET)
            {
                /* 翻转LED状态 */
                HAL_GPIO_TogglePin(LED_GPIO_PORT, LED_PIN);
            }
            
            /* 等待按键释放 */
            while(HAL_GPIO_ReadPin(KEY_GPIO_PORT, KEY_PIN) == GPIO_PIN_RESET);
            HAL_Delay(50);  // 释放消抖
        }
        
        /* 可添加其他任务 */
        HAL_Delay(10);
    }
}

/* 系统时钟配置（根据实际MCU修改） */
void SystemClock_Config(void)
{
    RCC_OscInitTypeDef RCC_OscInitStruct = {0};
    RCC_ClkInitTypeDef RCC_ClkInitStruct = {0};
    
    /* 以STM32F103为例配置72MHz系统时钟 */
    RCC_OscInitStruct.OscillatorType = RCC_OSCILLATORTYPE_HSE;
    RCC_OscInitStruct.HSEState = RCC_HSE_ON;
    RCC_OscInitStruct.HSEPredivValue = RCC_HSE_PREDIV_DIV1;
    RCC_OscInitStruct.PLL.PLLState = RCC_PLL_ON;
    RCC_OscInitStruct.PLL.PLLSource = RCC_PLLSOURCE_HSE;
    RCC_OscInitStruct.PLL.PLLMUL = RCC_PLL_MUL9;
    if (HAL_RCC_OscConfig(&RCC_OscInitStruct) != HAL_OK)
    {
        Error_Handler();
    }
    
    RCC_ClkInitStruct.ClockType = RCC_CLOCKTYPE_HCLK|RCC_CLOCKTYPE_SYSCLK
                                |RCC_CLOCKTYPE_PCLK1|RCC_CLOCKTYPE_PCLK2;
    RCC_ClkInitStruct.SYSCLKSource = RCC_SYSCLKSOURCE_PLLCLK;
    RCC_ClkInitStruct.AHBCLKDivider = RCC_SYSCLK_DIV1;
    RCC_ClkInitStruct.APB1CLKDivider = RCC_HCLK_DIV2;
    RCC_ClkInitStruct.APB2CLKDivider = RCC_HCLK_DIV1;
    if (HAL_RCC_ClockConfig(&RCC_ClkInitStruct, FLASH_LATENCY_2) != HAL_OK)
    {
        Error_Handler();
    }
}

/* GPIO初始化 */
void GPIO_Init(void)
{
    /* 使能GPIO时钟 */
    __HAL_RCC_GPIOA_CLK_ENABLE();
    
    /* LED配置 - 推挽输出 */
    GPIO_InitStruct.Pin = LED_PIN;
    GPIO_InitStruct.Mode = GPIO_MODE_OUTPUT_PP;
    GPIO_InitStruct.Pull = GPIO_NOPULL;
    GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_LOW;
    HAL_GPIO_Init(LED_GPIO_PORT, &GPIO_InitStruct);
    
    /* 初始关闭LED */
    HAL_GPIO_WritePin(LED_GPIO_PORT, LED_PIN, GPIO_PIN_RESET);
    
    /* 按键配置 - 下拉输入（假设按键按下为高电平） */
    GPIO_InitStruct.Pin = KEY_PIN;
    GPIO_InitStruct.Mode = GPIO_MODE_IT_FALLING;  // 下降沿触发中断
    GPIO_InitStruct.Pull = GPIO_PULLUP;           // 上拉电阻
    GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_LOW;
    HAL_GPIO_Init(KEY_GPIO_PORT, &GPIO_InitStruct);
}

/* 外部中断初始化 */
void EXTI_Init(void)
{
    /* 配置EXTI线0（对应PA0） */
    HAL_NVIC_SetPriority(KEY_EXTI_IRQn, 0, 0);
    HAL_NVIC_EnableIRQ(KEY_EXTI_IRQn);
}

/* 外部中断0中断服务函数 */
void EXTI0_IRQHandler(void)
{
    HAL_GPIO_EXTI_IRQHandler(KEY_PIN);
}

/* HAL库外部中断回调函数 */
void HAL_GPIO_EXTI_Callback(uint16_t GPIO_Pin)
{
    if(GPIO_Pin == KEY_PIN)
    {
        key_pressed = 1;  // 设置按键按下标志
    }
}

/* 错误处理函数 */
void Error_Handler(void)
{
    while(1)
    {
        /* 错误时LED闪烁 */
        HAL_GPIO_TogglePin(LED_GPIO_PORT, LED_PIN);
        HAL_Delay(100);
    }
}

#ifdef  USE_FULL_ASSERT
void assert_failed(uint8_t *file, uint32_t line)
{
    /* 断言失败处理 */
}
#endif