"""
一个简单的 Python 示例程序
"""
import time

def greet():
    """打招呼函数"""
    names = ["小明", "小红", "小刚", "小美"]
    for name in names:
        print(f"你好，{name}！欢迎来到 Python 世界！")
        time.sleep(0.5)

def calculate_sum(n):
    """计算 1 到 n 的和"""
    total = 0
    for i in range(1, n + 1):
        total += i
    return total

if __name__ == "__main__":
    print("=" * 30)
    print("    Python 演示程序")
    print("=" * 30)
    print()
    
    greet()
    
    num = 100
    result = calculate_sum(num)
    print(f"\n计算 1 到 {num} 的和为: {result}")
    print()
    print("程序执行完成！")
