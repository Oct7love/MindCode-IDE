#!/usr/bin/env python3
"""
Python 基础示例代码
包含各种常用功能的实现
"""

# 1. 基础语法示例
def basic_syntax():
    """基础语法示例"""
    print("=== Python 基础语法示例 ===")
    
    # 变量和数据类型
    name = "Python"
    version = 3.11
    is_awesome = True
    numbers = [1, 2, 3, 4, 5]
    
    print(f"语言: {name}")
    print(f"版本: {version}")
    print(f"是否很棒: {is_awesome}")
    print(f"数字列表: {numbers}")
    
    # 条件语句
    if version >= 3.6:
        print("Python 3.6+ 支持 f-string!")
    else:
        print("请升级到 Python 3.6+")
    
    # 循环
    print("\n循环示例:")
    for i in range(5):
        print(f"循环次数: {i}")
    
    # 列表推导式
    squares = [x**2 for x in range(1, 6)]
    print(f"平方数: {squares}")

# 2. 函数示例
def calculate_statistics(numbers):
    """计算统计信息"""
    if not numbers:
        return None
    
    total = sum(numbers)
    average = total / len(numbers)
    maximum = max(numbers)
    minimum = min(numbers)
    
    return {
        "total": total,
        "average": average,
        "maximum": maximum,
        "minimum": minimum,
        "count": len(numbers)
    }

# 3. 类示例
class Person:
    """人类示例"""
    
    def __init__(self, name, age):
        self.name = name
        self.age = age
    
    def greet(self):
        """打招呼"""
        return f"你好，我叫{self.name}，今年{self.age}岁。"
    
    def is_adult(self):
        """判断是否成年"""
        return self.age >= 18

# 4. 文件操作示例
def file_operations():
    """文件操作示例"""
    print("\n=== 文件操作示例 ===")
    
    # 写入文件
    with open('sample.txt', 'w', encoding='utf-8') as f:
        f.write("这是第一行\n")
        f.write("这是第二行\n")
        f.write("Python 文件操作很简单！\n")
    
    print("文件写入完成")
    
    # 读取文件
    with open('sample.txt', 'r', encoding='utf-8') as f:
        content = f.read()
        print("文件内容:")
        print(content)
    
    # 逐行读取
    with open('sample.txt', 'r', encoding='utf-8') as f:
        print("逐行读取:")
        for line_num, line in enumerate(f, 1):
            print(f"第{line_num}行: {line.strip()}")

# 5. 异常处理示例
def exception_handling():
    """异常处理示例"""
    print("\n=== 异常处理示例 ===")
    
    try:
        # 可能出错的代码
        num = int(input("请输入一个数字: "))
        result = 100 / num
        print(f"100 / {num} = {result}")
    except ValueError:
        print("错误：请输入有效的数字！")
    except ZeroDivisionError:
        print("错误：不能除以零！")
    except Exception as e:
        print(f"发生未知错误: {e}")
    else:
        print("计算成功！")
    finally:
        print("异常处理示例结束。")

# 6. 装饰器示例
def timer_decorator(func):
    """计时装饰器"""
    import time
    
    def wrapper(*args, **kwargs):
        start_time = time.time()
        result = func(*args, **kwargs)
        end_time = time.time()
        print(f"函数 {func.__name__} 执行时间: {end_time - start_time:.4f}秒")
        return result
    
    return wrapper

@timer_decorator
def slow_function():
    """模拟耗时函数"""
    import time
    time.sleep(1)
    return "完成！"

# 7. 生成器示例
def fibonacci_generator(n):
    """斐波那契数列生成器"""
    a, b = 0, 1
    count = 0
    while count < n:
        yield a
        a, b = b, a + b
        count += 1

# 8. 上下文管理器示例
class DatabaseConnection:
    """数据库连接上下文管理器"""
    
    def __init__(self, db_name):
        self.db_name = db_name
    
    def __enter__(self):
        print(f"连接到数据库: {self.db_name}")
        # 这里模拟连接数据库
        self.connection = f"Connection to {self.db_name}"
        return self.connection
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        print(f"关闭数据库连接: {self.db_name}")
        # 这里模拟关闭连接
        self.connection = None

# 主函数
def main():
    """主函数"""
    print("Python 代码示例")
    print("=" * 50)
    
    # 运行基础语法示例
    basic_syntax()
    
    # 运行函数示例
    numbers = [10, 20, 30, 40, 50]
    stats = calculate_statistics(numbers)
    print(f"\n统计信息: {stats}")
    
    # 运行类示例
    person = Person("张三", 25)
    print(f"\n{person.greet()}")
    print(f"是否成年: {person.is_adult()}")
    
    # 运行文件操作
    file_operations()
    
    # 运行装饰器示例
    print("\n装饰器示例:")
    result = slow_function()
    print(f"结果: {result}")
    
    # 运行生成器示例
    print("\n斐波那契数列生成器:")
    fib_nums = list(fibonacci_generator(10))
    print(f"前10个斐波那契数: {fib_nums}")
    
    # 运行上下文管理器示例
    print("\n上下文管理器示例:")
    with DatabaseConnection("my_database") as conn:
        print(f"使用连接: {conn}")
        print("执行数据库操作...")
    
    # 运行异常处理示例（注释掉，因为需要用户输入）
    # exception_handling()
    
    print("\n所有示例运行完成！")

if __name__ == "__main__":
    main()