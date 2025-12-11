import os
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

def generate_english_pdf(filename, target_size_mb):
    """
    生成指定大小的 PDF (通过 reportlab 生成头，尾部填充空字节)
    """
    # 1. 生成基础 PDF
    try:
        c = canvas.Canvas(filename, pagesize=A4)
        c.setFont("Helvetica", 20)
        c.drawString(100, 750, "PDF Size test document")
        c.setFont("Helvetica", 12)
        c.drawString(100, 700, f"Size: {target_size_mb} MB")
        c.save()
    except Exception as e:
        print(f"❌ 创建基础 PDF 失败: {e}")
        return

    # 2. 计算并填充大小
    current_size = os.path.getsize(filename)
    target_bytes = int(target_size_mb * 1024 * 1024)
    padding_size = target_bytes - current_size

    if padding_size <= 0:
        print(f"⚠️ 文件已达到目标大小 ({current_size/1024/1024:.2f} MB)")
        return

    print(f"正在填充 PDF 到 {target_size_mb} MB ...")
    
    # 3. 追加二进制数据 (分块写入，内存友好)
    chunk_size = 10 * 1024 * 1024 # 10MB chunk
    with open(filename, 'ab') as f:
        # 为了保险，先换一行，避免紧贴着 %%EOF
        f.write(b'\n') 
        padding_size -= 1
        
        while padding_size > 0:
            write_size = min(padding_size, chunk_size)
            f.write(b'\0' * write_size)
            padding_size -= write_size

    print(f"✅ 生成完毕: {filename}")

if __name__ == "__main__":
    generate_english_pdf("测试文件_10MB.pdf", 10)