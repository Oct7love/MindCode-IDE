#!/usr/bin/env python3
"""
简单的 Python 脚本示例
演示 Python 的基本功能和实用技巧
"""

import os
import sys
import json
import csv
from pathlib import Path
from typing import List, Dict, Any, Optional
import argparse
from datetime import datetime
import hashlib

def file_operations_example():
    """文件操作示例"""
    print("=== 文件操作示例 ===")
    
    # 使用 pathlib（现代方式）
    current_dir = Path.cwd()
    print(f"当前目录: {current_dir}")
    
    # 创建目录
    data_dir = current_dir / "data"
    data_dir.mkdir(exist_ok=True)
    print(f"创建目录: {data_dir}")
    
    # 写入 JSON 文件
    sample_data = {
        "name": "Python示例",
        "version": "1.0",
        "features": ["简单", "强大", "易学"],
        "timestamp": datetime.now().isoformat()
    }
    
    json_file = data_dir / "sample.json"
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(sample_data, f, indent=2, ensure_ascii=False)
    print(f"JSON文件已创建: {json_file}")
    
    # 读取 JSON 文件
    with open(json_file, 'r', encoding='utf-8') as f:
        loaded_data = json.load(f)
    print(f"读取的数据: {json.dumps(loaded_data, indent=2, ensure_ascii=False)}")
    
    # 写入 CSV 文件
    csv_file = data_dir / "sample.csv"
    csv_data = [
        ["姓名", "年龄", "城市", "职业"],
        ["张三", 25, "北京", "工程师"],
        ["李四", 30, "上海", "设计师"],
        ["王五", 28, "广州", "产品经理"]
    ]
    
    with open(csv_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(csv_data)
    print(f"CSV文件已创建: {csv_file}")
    
    # 读取 CSV 文件
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        print("CSV内容:")
        for row in reader:
            print(f"  {row}")
    
    return data_dir

def string_manipulation():
    """字符串操作示例"""
    print("\n=== 字符串操作示例 ===")
    
    text = "  Python 是一门非常强大的编程语言！  "
    
    print(f"原始字符串: '{text}'")
    print(f"去除空格: '{text.strip()}'")
    print(f"大写: '{text.upper()}'")
    print(f"小写: '{text.lower()}'")
    print(f"标题化: '{text.strip().title()}'")
    print(f"替换: '{text.replace('强大', '优秀')}'")
    print(f"分割: {text.strip().split(' ')}")
    print(f"是否以'Python'开头: {text.strip().startswith('Python')}")
    print(f"是否包含'编程': {'编程' in text}")
    print(f"字符串长度: {len(text)}")
    
    # 格式化字符串
    name = "Alice"
    age = 30
    score = 95.5
    
    # f-string（推荐）
    message1 = f"{name}今年{age}岁，成绩是{score:.1f}分"
    print(f"\nf-string格式化: {message1}")
    
    # format方法
    message2 = "{}今年{}岁，成绩是{:.1f}分".format(name, age, score)
    print(f"format格式化: {message2}")
    
    # 多行字符串
    multi_line = f"""
    个人信息：
    姓名：{name}
    年龄：{age}
    成绩：{score:.1f}
    """
    print(f"多行字符串:\n{multi_line}")

def list_and_dict_operations():
    """列表和字典操作示例"""
    print("\n=== 列表和字典操作示例 ===")
    
    # 列表操作
    numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    print(f"原始列表: {numbers}")
    
    # 切片
    print(f"前3个: {numbers[:3]}")
    print(f"后3个: {numbers[-3:]}")
    print(f"偶数: {numbers[1::2]}")
    print(f"反转: {numbers[::-1]}")
    
    # 列表推导式
    squares = [x**2 for x in numbers]
    print(f"平方数: {squares}")
    
    even_squares = [x**2 for x in numbers if x % 2 == 0]
    print(f"偶数的平方: {even_squares}")
    
    # 字典操作
    student = {
        "name": "Bob",
        "age": 22,
        "courses": ["Math", "Physics", "Chemistry"],
        "grades": {"Math": 90, "Physics": 85, "Chemistry": 88}
    }
    
    print(f"\n学生信息: {student}")
    print(f"姓名: {student['name']}")
    print(f"年龄: {student.get('age')}")
    print(f"课程: {', '.join(student['courses'])}")
    
    # 添加新键值
    student["graduated"] = False
    print(f"添加毕业状态后: {student}")
    
    # 遍历字典
    print("\n遍历字典:")
    for key, value in student.items():
        print(f"  {key}: {value}")
    
    # 字典推导式
    square_dict = {x: x**2 for x in range(1, 6)}
    print(f"数字平方字典: {square_dict}")

def function_decorator_example():
    """函数装饰器示例"""
    print("\n=== 函数装饰器示例 ===")
    
    def timer_decorator(func):
        """计时装饰器"""
        def wrapper(*args, **kwargs):
            import time
            start_time = time.time()
            result = func(*args, **kwargs)
            end_time = time.time()
            print(f"函数 {func.__name__} 执行时间: {end_time - start_time:.6f}秒")
            return result
        return wrapper
    
    def cache_decorator(func):
        """缓存装饰器"""
        cache = {}
        def wrapper(*args):
            if args in cache:
                print(f"从缓存获取结果: {args} -> {cache[args]}")
                return cache[args]
            result = func(*args)
            cache[args] = result
            print(f"计算并缓存结果: {args} -> {result}")
            return result
        return wrapper
    
    @timer_decorator
    def slow_function(n):
        """模拟耗时函数"""
        import time
        time.sleep(0.1)  # 模拟耗时操作
        return sum(range(n))
    
    @cache_decorator
    def fibonacci(n):
        """计算斐波那契数列"""
        if n <= 1:
            return n
        return fibonacci(n-1) + fibonacci(n-2)
    
    # 测试计时装饰器
    print("测试计时装饰器:")
    result1 = slow_function(1000)
    print(f"结果: {result1}")
    
    # 测试缓存装饰器
    print("\n测试缓存装饰器 (斐波那契数列):")
    result2 = fibonacci(10)
    print(f"斐波那契(10) = {result2}")

def command_line_interface():
    """命令行界面示例"""
    print("\n=== 命令行界面示例 ===")
    
    # 创建解析器
    parser = argparse.ArgumentParser(
        description="一个简单的命令行工具示例",
        epilog="示例: python script.py --name Alice --age 25 --verbose"
    )
    
    # 添加参数
    parser.add_argument(
        "--name",
        type=str,
        default="World",
        help="你的名字 (默认: World)"
    )
    
    parser.add_argument(
        "--age",
        type=int,
        default=0,
        help="你的年龄"
    )
    
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="显示详细信息"
    )
    
    parser.add_argument(
        "files",
        nargs="*",
        help="要处理的文件"
    )
    
    # 模拟命令行参数
    test_args = ["--name", "Alice", "--age", "25", "--verbose", "file1.txt", "file2.txt"]
    
    # 解析参数
    args = parser.parse_args(test_args)
    
    print(f"你好, {args.name}!")
    if args.age > 0:
        print(f"年龄: {args.age}")
    
    if args.verbose:
        print("详细模式已启用")
    
    if args.files:
        print(f"要处理的文件: {args.files}")
    
    return args

def security_examples():
    """安全相关示例"""
    print("\n=== 安全相关示例 ===")
    
    # 密码哈希
    password = "my_secret_password"
    
    # MD5（不推荐用于密码，仅演示）
    md5_hash = hashlib.md5(password.encode()).hexdigest()
    print(f"MD5哈希: {md5_hash}")
    
    # SHA256
    sha256_hash = hashlib.sha256(password.encode()).hexdigest()
    print(f"SHA256哈希: {sha256_hash}")
    
    # 加盐哈希（推荐）
    import secrets
    salt = secrets.token_hex(16)
    salted_password = password + salt
    salted_hash = hashlib.sha256(salted_password.encode()).hexdigest()
    print(f"盐值: {salt}")
    print(f"加盐哈希: {salted_hash}")
    
    # 生成安全随机数
    random_token = secrets.token_urlsafe(32)
    print(f"安全随机令牌: {random_token}")

def main():
    """主函数"""
    print("Python 脚本示例")
    print("=" * 60)
    
    # 执行各个示例
    data_dir = file_operations_example()
    string_manipulation()
    list_and_dict_operations()
    function_decorator_example()
    cli_args = command_line_interface()
    security_examples()
    
    print("\n" + "=" * 60)
    print("脚本执行完成！")
    print(f"生成的数据目录: {data_dir}")
    print("\n这个脚本演示了:")
    print("1. 文件操作 (JSON, CSV)")
    print("2. 字符串处理")
    print("3. 列表和字典操作")
    print("4. 函数装饰器")
    print("5. 命令行界面")
    print("6. 安全相关功能")

if __name__ == "__main__":
    main()