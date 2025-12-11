import wave
import os

def generate_noise_wav(filename, target_size_mb):
    print(f"📺 正在生成白噪音 WAV: {filename} ({target_size_mb} MB)...")
    
    n_channels = 2
    samp_width = 2
    frame_rate = 44100
    
    target_bytes = int(target_size_mb * 1024 * 1024)
    
    # 生成 10MB 的随机数据作为缓存
    # os.urandom 生成的是随机字节，听起来就是噪音
    chunk_size = 10 * 1024 * 1024
    random_chunk = os.urandom(chunk_size)
    
    with wave.open(filename, 'wb') as wav_file:
        wav_file.setnchannels(n_channels)
        wav_file.setsampwidth(samp_width)
        wav_file.setframerate(frame_rate)
        
        written = 0
        while written < target_bytes:
            left = target_bytes - written
            if left >= chunk_size:
                wav_file.writeframesraw(random_chunk)
                written += chunk_size
            else:
                wav_file.writeframesraw(random_chunk[:left])
                written += left
                
    print(f"✅ 生成完毕: {filename}")

if __name__ == "__main__":
    generate_noise_wav("白噪音_50MB.wav", 50)