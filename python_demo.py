"""
Python 通用演示脚本
包含：文件操作、数据处理、网络请求示例
"""

import json
from datetime import datetime
import requests


def print_header(title):
    """打印标题"""
    print("\n" + "=" * 50)
    print(f"  {title}")
    print("=" * 50)


def example_file_operations():
    """示例1：文件操作"""
    print_header("文件操作示例")
    
    # 写入文件
    content = """这是一段演示文本。
今天日期：{date}
"""
    with open("demo_file.txt", "w", encoding="utf-8") as f:
        f.write(content.format(date=datetime.now().strftime("%Y-%m-%d")))
    print("✓ 文件已创建: demo_file.txt")
    
    # 读取文件
    with open("demo_file.txt", "r", encoding="utf-8") as f:
        content = f.read()
    print("✓ 文件内容:")
    print(content)
    
    # 创建 JSON 文件
    data = {
        "name": "Python Demo",
        "version": "1.0",
        "features": ["文件操作", "数据处理", "网络请求"]
    }
    with open("demo_data.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print("✓ JSON 文件已创建: demo_data.json")
    print(f"数据内容: {json.dumps(data, ensure_ascii=False, indent=2)}")


def example_data_processing():
    """示例2：数据处理"""
    print_header("数据处理示例")
    
    # 创建示例列表
    numbers = [3, 7, 2, 9, 5, 1, 8, 4, 6]
    print(f"原始列表: {numbers}")
    
    # 排序
    sorted_numbers = sorted(numbers)
    print(f"排序后: {sorted_numbers}")
    
    # 过滤（求偶数）
    evens = [n for n in numbers if n % 2 == 0]
    print(f"偶数: {evens}")
    
    # 映射（求平方）
    squared = [n**2 for n in numbers]
    print(f"平方: {squared}")
    
    # 字符串处理
    text = "  Python编程简单有趣  "
    print(f"原始文本: '{text}'")
    print(f"去除空格: '{text.strip()}'")
    print(f"大写: '{text.upper()}'")


def example_network_request():
    """示例3：网络请求（可选）"""
    print_header("网络请求示例")
    
    url = "https://api.github.com"
    print(f"访问: {url}")
    print("注意：由于网络限制，可能需要配置代理")
    
    try:
        # 这里的请求可能会失败，因为可能有网络限制
        # response = requests.get(url, timeout=5)
        # print(f"状态码: {response.status_code}")
        # print(f"响应: {response.json()}")
        print("✗ 跳过实际请求（需要网络连接）")
    except Exception as e:
        print(f"✗ 请求失败: {e}")


def main():
    """主函数"""
    print_header("Python 通用演示")
    print(f"执行时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    example_file_operations()
    example_data_processing()
    example_network_request()
    
    print_header("演示完成")
    print("已生成文件: demo_file.txt, demo_data.json")


if __name__ == "__main__":
    main()
