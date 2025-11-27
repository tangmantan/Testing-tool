import os
import sys
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

def generate_chinese_pdf(filename, target_size_mb):
    """
    生成包含中文内容的指定大小 PDF
    """
    c = canvas.Canvas(filename, pagesize=A4)

    # --- 核心步骤：配置中文字体 ---
    # 默认使用 Windows 下的黑体 (SimHei)
    # 如果你是 Mac/Linux，或者 Windows 下找不到该文件，请修改 font_path
    font_name = 'MyChineseFont'
    
    # 常见字体路径猜测
    font_path = "C:\\Windows\\Fonts\\simhei.ttf"  # Windows 默认
    # font_path = "/System/Library/Fonts/PingFang.ttc"  # Mac 常见
    # font_path = "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf" # Linux 常见
    
    # 尝试注册字体
    try:
        pdfmetrics.registerFont(TTFont(font_name, font_path))
        c.setFont(font_name, 24) # 设置字体和大小
        has_chinese_font = True
    except Exception as e:
        print(f"⚠️ 字体加载失败: {e}")
        print(f"⚠️ 将回退到默认英文环境。请检查 '{font_path}' 是否存在。")
        c.setFont("Helvetica", 24)
        has_chinese_font = False

    # --- 写入内容 ---
    if has_chinese_font:
        c.drawString(100, 750, "PDF测试文档")
        c.setFont(font_name, 14)
        c.drawString(100, 700, f"目标文件大小: {target_size_mb} MB")
        c.drawString(100, 620, "注意：该文件完全符合 PDF 标准，可正常打开。")
    else:
        c.drawString(100, 750, "Font Load Error (Text fallback to English)")
        c.drawString(100, 700, "Please check the code to set correct font path.")

    c.save()

    # --- 以下是填充体积逻辑 (与之前相同) ---
    current_size = os.path.getsize(filename)
    target_bytes = int(target_size_mb * 1024 * 1024)
    padding_size = target_bytes - current_size

    if padding_size <= 0:
        print(f"⚠️ 警告: 初始文件 ({current_size/1024} KB) 已超过目标大小。")
        return

    print(f"正在填充二进制数据到 {target_size_mb} MB ...")
    
    chunk_size = 10 * 1024 * 1024 # 每次写入 10MB
    with open(filename, 'ab') as f:
        f.write(b'\n') # 安全换行
        while padding_size > 0:
            write_size = min(padding_size, chunk_size)
            f.write(b'\0' * write_size)
            padding_size -= write_size

    print(f"✅ 成功生成中文 PDF: {filename}")

if __name__ == "__main__":
    # 如果你是 Windows，直接运行即可
    # 如果报错 "Can't open file..."，请确认 C:\Windows\Fonts\simhei.ttf 是否存在
    generate_chinese_pdf("中文测试_100MB.pdf", 100)