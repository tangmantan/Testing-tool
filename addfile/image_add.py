import os
from PIL import Image
import io

def generate_fixed_size_image(filename, target_size_mb, fmt='PNG'):
    """
    快速生成指定大小的图片 (通过尾部填充)
    :param filename: 文件名 (如 test.jpg)
    :param target_size_mb: 目标大小 (MB)
    :param fmt: 图片格式 (JPEG, PNG)
    """
    print(f"🎨 正在生成图片: {filename} ({target_size_mb} MB)...")
    
    # 1. 先在内存中生成一张合法的、极小的基础图片
    # 100x100 像素的纯色图
    img = Image.new('RGB', (100, 100), color=(255, 0, 0))
    
    # 将图片保存到内存 buffer 中
    buffer = io.BytesIO()
    img.save(buffer, format=fmt, quality=95)
    img_data = buffer.getvalue()
    
    # 2. 计算需要填充的大小
    current_size = len(img_data)
    target_bytes = int(target_size_mb * 1024 * 1024)
    padding_size = target_bytes - current_size
    
    if padding_size < 0:
        print("⚠️ 目标大小太小，无法生成 (基础图片已超过目标大小)")
        return

    # 3. 写入文件
    with open(filename, 'wb') as f:
        f.write(img_data) # 写入正常的图片数据
        
        # 分块写入填充数据 (0字节)，防止内存溢出
        chunk_size = 10 * 1024 * 1024 # 10MB
        while padding_size > 0:
            write_size = min(padding_size, chunk_size)
            f.write(b'\0' * write_size)
            padding_size -= write_size
            
    print(f"✅ 生成完毕: {filename}")

if __name__ == "__main__":
    # 生成 5MB 的 JPG
    generate_fixed_size_image("测试图片_50MB.jpg", 50, fmt='JPEG')
    