# 简单的 Python 示例程序

def greet(name):
    """打招呼函数"""
    return f"你好，{name}！欢迎使用 Python！"

def calculate_sum(n):
    """计算 1 到 n 的和"""
    total = sum(range(1, n + 1))
    return total

def main():
    # 打招呼
    print(greet("朋友"))
    
    # 计算 1-100 的和
    result = calculate_sum(100)
    print(f"1 到 100 的和是：{result}")
    
    # 打印一个简单的图案
    print("\n小星星：")
    for i in range(1, 6):
        print("⭐" * i)

if __name__ == "__main__":
    main()
