import cv2
import numpy as np
import os

def generate_exact_video(filename, target_size_mb):
    """
    生成绝对精准大小的可播放视频。
    策略：生成一个极小的微型视频核心，然后精确填充剩余字节。
    """
    target_bytes = int(target_size_mb * 1024 * 1024)
    print(f"🎬 正在初始化: {filename}")
    print(f"   🎯 目标大小: {target_bytes} 字节 ({target_size_mb} MB)")

    # --- 第一步：生成“微型”基底视频 ---
    # 使用极低参数确保基底文件非常小 (通常 < 50KB)
    width, height = 160, 120  # 极低分辨率
    fps = 10                  # 低帧率
    duration_sec = 2          # 短时长
    
    # 如果文件已存在，先删除，防止追加模式出错
    if os.path.exists(filename):
        os.remove(filename)

    # 尝试使用 mp4v 编码 (兼容性好且体积小)
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    
    # 注意：这里直接写入最终文件名
    video_writer = cv2.VideoWriter(filename, fourcc, fps, (width, height))

    # 生成简单的动态画面
    frames_count = fps * duration_sec
    for i in range(frames_count):
        # 纯色背景
        img = np.zeros((height, width, 3), dtype=np.uint8)
        img[:] = (50, 50, 50) # 深灰色背景
        
        # 写一行字证明是视频
        cv2.putText(img, f"{i}", (20, 80), cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 255, 0), 2)
        video_writer.write(img)

    video_writer.release()
    
    # --- 第二步：检查基底大小 ---
    base_size = os.path.getsize(filename)
    print(f"   📉 基底视频大小: {base_size} 字节")

    if base_size > target_bytes:
        print(f"❌ 错误：目标大小 ({target_bytes} B) 小于基底视频 ({base_size} B)。")
        print("💡 建议：目标大小至少设置为 0.1 MB。")
        return

    # --- 第三步：精确填充 ---
    padding_size = target_bytes - base_size
    print(f"   🔨 需要填充: {padding_size} 字节")
    
    # 以追加二进制模式打开 ('ab')
    with open(filename, 'ab') as f:
        chunk_size = 10 * 1024 * 1024 # 10MB 块
        while padding_size > 0:
            write_size = min(padding_size, chunk_size)
            f.write(b'\0' * write_size)
            padding_size -= write_size

    # --- 第四步：最终验证 ---
    final_size = os.path.getsize(filename)
    print(f"✅ 生成完毕: {filename}")
    print(f"   📊 最终大小: {final_size} 字节")
    
    if final_size == target_bytes:
        print("   💯 结果：完美匹配 (精准到字节)")
    else:
        print(f"   ⚠️ 结果：有偏差 (差 {final_size - target_bytes} 字节)")

if __name__ == "__main__":
    # 测试生成 10MB 的精准视频
    generate_exact_video("精准测试_100MB.mp4", 100)
    
    # 甚至可以生成极小的视频测试 (如 0.2MB)
    # generate_exact_video("微型测试_0.2MB.mp4", 0.2)