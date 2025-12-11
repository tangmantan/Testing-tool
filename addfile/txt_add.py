import os
import time

def generate_text_file(filename, target_size_mb):
    """
    使用指定中文文本填充生成任意大小的 TXT 文件
    """
    # 1. 定义填充内容 (朱自清《匆匆》)
    # 加上换行符 \n 让生成的文本更易读，不是挤在一行
    base_text = "燕子去了，有再来的时候；杨柳枯了，有再青的时候；桃花谢了，有再开的时候。\n"
    
    # 2. 转换为二进制数据 (UTF-8 编码)
    # 中文通常占 3 字节，标点符号也是，ASCII 占 1 字节
    base_data = base_text.encode('utf-8')
    base_len = len(base_data)
    
    print(f"📄 正在生成: {filename}")
    print(f"🎯 目标大小: {target_size_mb} MB")
    print(f"📝 填充文本长度: {base_len} 字节/行")

    # 3. 准备高效写入的大块缓存 (Chunk)
    # 为了防止硬盘 I/O 瓶颈，我们在内存里先拼好一个约 10MB 的大块
    # 这样生成 1GB 的文件只需要写入 100 次，而不是写入几千万次
    chunk_target_size = 10 * 1024 * 1024 # 10MB
    repeats = (chunk_target_size // base_len) + 1
    
    # 创建大块数据
    big_chunk = base_data * repeats
    
    # 4. 开始写入
    target_bytes = int(target_size_mb * 1024 * 1024)
    written = 0
    start_time = time.time()
    
    with open(filename, 'wb') as f: # 注意使用 wb (二进制) 模式以保证大小精准
        while written < target_bytes:
            remaining = target_bytes - written
            
            # 如果剩余需要写的大小大于一个大块，就直接写大块
            if remaining >= len(big_chunk):
                f.write(big_chunk)
                written += len(big_chunk)
            else:
                # 5. 处理尾部 (最后一点数据)
                # 为了精确达到目标大小，直接截取 needed bytes
                # 注意：如果截断点刚好在汉字的 3 个字节中间，最后一个字会显示乱码，
                # 但这保证了文件大小是绝对精准的。
                f.write(big_chunk[:remaining])
                written += remaining

    end_time = time.time()
    duration = end_time - start_time
    
    # 验证最终大小
    final_size = os.path.getsize(filename)
    print(f"✅ 生成完毕: {filename}")
    print(f"📊 最终大小: {final_size} 字节 ({(final_size/1024/1024):.2f} MB)")
    print(f"⚡ 耗时: {duration:.2f} 秒")

if __name__ == "__main__":
    # 在这里修改你想生成的大小
    
    # 生成 10MB
    generate_text_file("匆匆_10MB.txt", 10)
    
