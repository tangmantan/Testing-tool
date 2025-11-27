# -*- coding: utf-8 -*-
"""
音视频图片文件分割工具
支持指定分割后的文件大小和格式，并提供Web界面操作
"""

import os
import sys
import json
import uuid
import subprocess
import shutil
import math
from pathlib import Path
from flask import Flask, render_template, request, jsonify, send_file, redirect, url_for
from werkzeug.utils import secure_filename

# 创建Flask应用实例
app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'  # 用于会话加密
app.config['UPLOAD_FOLDER'] = 'uploads'  # 上传文件存储目录
app.config['OUTPUT_FOLDER'] = 'output'  # 输出文件存储目录
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024 * 1024  # 最大上传文件大小为16GB

# 确保上传和输出目录存在
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)

# 支持的文件格式
SUPPORTED_FORMATS = {
    'video': ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm', 'm4v'],
    'audio': ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'],
    'image': ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp'],
    'document': ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'ods', 'odp', 'csv', 'html', 'htm', 'xml', 'epub', 'mobi', 'azw', 'azw3']
}

# 预设的输出格式
OUTPUT_FORMATS = {
    'video': ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm'],
    'audio': ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma'],
    'image': ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp'],
    'document': ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'ods', 'odp', 'csv', 'html', 'htm', 'xml']
}

# 添加全局错误处理器，确保所有API端点都返回JSON格式的错误响应
@app.errorhandler(Exception)
def handle_exception(e):
    """处理所有未捕获的异常，返回JSON格式的错误响应"""
    # 获取异常信息
    error_message = str(e)
    
    # 记录错误到控制台
    print(f"服务器错误: {error_message}")
    
    # 返回JSON格式的错误响应
    return jsonify({
        'success': False,
        'error': f"服务器内部错误: {error_message}"
    }), 500

# 添加404错误处理器
@app.errorhandler(404)
def handle_not_found(e):
    """处理404错误，返回JSON格式的错误响应"""
    return jsonify({
        'success': False,
        'error': "请求的资源不存在"
    }), 404

# 添加405错误处理器
@app.errorhandler(405)
def handle_method_not_allowed(e):
    """处理405错误，返回JSON格式的错误响应"""
    return jsonify({
        'success': False,
        'error': "请求方法不被允许"
    }), 405

# 添加413错误处理器（文件过大）
@app.errorhandler(413)
def handle_request_entity_too_large(e):
    """处理413错误，返回JSON格式的错误响应"""
    return jsonify({
        'success': False,
        'error': "上传的文件过大"
    }), 413


def allowed_file(filename):
    """检查文件扩展名是否被支持"""
    if not filename:
        return False
    
    ext = filename.rsplit('.', 1)[1].lower()
    for formats in SUPPORTED_FORMATS.values():
        if ext in formats:
            return True
    return False


def get_file_type(filename):
    """根据文件扩展名确定文件类型"""
    if not filename:
        return None
    
    ext = filename.rsplit('.', 1)[1].lower()
    for file_type, formats in SUPPORTED_FORMATS.items():
        if ext in formats:
            return file_type
    return None


def get_file_size_mb(file_path):
    """获取文件大小（MB）"""
    return os.path.getsize(file_path) / (1024 * 1024)


def split_file_by_size(input_path, output_path, target_size_mb, output_format):
    """
    根据指定大小分割文件
    :param input_path: 输入文件路径
    :param output_path: 输出目录
    :param target_size_mb: 目标文件大小（MB）
    :param output_format: 输出格式
    :return: 分割后的文件列表
    """
    try:
        # 检查文件是否存在
        if not os.path.exists(input_path):
            return {'success': False, 'error': '文件不存在'}
        
        # 获取文件名和扩展名
        file_name = os.path.basename(input_path)
        file_name_without_ext = os.path.splitext(file_name)[0]
        file_ext = os.path.splitext(file_name)[1].lower()
        
        # 确定文件类型
        file_type = get_file_type(input_path)
        
        # 创建唯一的输出目录
        unique_id = str(uuid.uuid4())
        split_output_dir = os.path.join(output_path, f"split_{unique_id}")
        os.makedirs(split_output_dir, exist_ok=True)
        
        # 计算分割点
        file_size = os.path.getsize(input_path)
        target_size_bytes = int(target_size_mb * 1024 * 1024)  # MB转换为字节
        num_parts = math.ceil(file_size / target_size_bytes)
        
        # 如果文件小于目标大小，直接复制
        if file_size <= target_size_bytes:
            output_file = os.path.join(split_output_dir, f"{file_name_without_ext}.{output_format}")
            shutil.copy2(input_path, output_file)
            return {
                'success': True,
                'files': [output_file],
                'split_dir': split_output_dir,
                'message': '文件大小小于目标大小，已直接复制'
            }
        
        # 分割文件
        output_files = []
        
        # 如果是视频或音频文件，使用二进制分割
        if file_type in ['video', 'audio']:
            # 直接按二进制分割，确保文件内容一致
            with open(input_path, 'rb') as f:
                for i in range(num_parts):
                    # 使用目标大小作为文件名，只对第一个文件不加序号
                    if i == 0:
                        output_file = os.path.join(split_output_dir, f"{target_size_mb}M.{output_format}")
                    else:
                        output_file = os.path.join(split_output_dir, f"{target_size_mb}M_part{i+1:03d}.{output_format}")
                    with open(output_file, 'wb') as out_f:
                        chunk = f.read(target_size_bytes)
                        if not chunk:
                            break
                        out_f.write(chunk)
                    output_files.append(output_file)
        
        # 如果是图片文件，使用PIL库进行分割
        elif file_type == 'image':
            try:
                # 尝试使用PIL库进行图片分割
                from PIL import Image
                
                # 打开原始图片
                with Image.open(input_path) as img:
                    # 获取图片尺寸和质量
                    width, height = img.size
                    format = img.format
                    
                    # 计算每个分割部分的目标大小（字节）
                    target_bytes = target_size_bytes
                    
                    # 尝试不同的质量参数来达到目标大小
                    quality = 85  # 初始质量
                    temp_file = os.path.join(split_output_dir, "temp_test.jpg")
                    
                    # 先测试当前质量下的文件大小
                    img.save(temp_file, format='JPEG', quality=quality)
                    test_size = os.path.getsize(temp_file)
                    
                    # 调整质量以接近目标大小
                    if test_size > target_bytes:
                        # 如果太大，降低质量
                        while test_size > target_bytes and quality > 10:
                            quality -= 5
                            img.save(temp_file, format='JPEG', quality=quality)
                            test_size = os.path.getsize(temp_file)
                    elif test_size < target_bytes * 0.8:
                        # 如果太小，提高质量
                        while test_size < target_bytes * 0.8 and quality < 95:
                            quality += 5
                            img.save(temp_file, format='JPEG', quality=quality)
                            test_size = os.path.getsize(temp_file)
                    
                    # 删除临时文件
                    if os.path.exists(temp_file):
                        os.remove(temp_file)
                    
                    # 分割图片为多个部分
                    for i in range(num_parts):
                        # 使用目标大小作为文件名，只对第一个文件不加序号
                        if i == 0:
                            output_file = os.path.join(split_output_dir, f"{target_size_mb}M.{output_format}")
                        else:
                            output_file = os.path.join(split_output_dir, f"{target_size_mb}M_part{i+1:03d}.{output_format}")
                        
                        # 保存每个部分，使用计算出的质量
                        img.save(output_file, format=output_format.upper(), quality=quality)
                        output_files.append(output_file)
                        
            except ImportError:
                # 如果PIL库不可用，回退到二进制分割
                with open(input_path, 'rb') as f:
                    for i in range(num_parts):
                        # 使用目标大小作为文件名，只对第一个文件不加序号
                        if i == 0:
                            output_file = os.path.join(split_output_dir, f"{target_size_mb}M.{output_format}")
                        else:
                            output_file = os.path.join(split_output_dir, f"{target_size_mb}M_part{i+1:03d}.{output_format}")
                        with open(output_file, 'wb') as out_f:
                            chunk = f.read(target_size_bytes)
                            if not chunk:
                                break
                            out_f.write(chunk)
                        output_files.append(output_file)
            except Exception as e:
                # 如果图片处理失败，回退到二进制分割
                with open(input_path, 'rb') as f:
                    for i in range(num_parts):
                        # 使用目标大小作为文件名，只对第一个文件不加序号
                        if i == 0:
                            output_file = os.path.join(split_output_dir, f"{target_size_mb}M.{output_format}")
                        else:
                            output_file = os.path.join(split_output_dir, f"{target_size_mb}M_part{i+1:03d}.{output_format}")
                        with open(output_file, 'wb') as out_f:
                            chunk = f.read(target_size_bytes)
                            if not chunk:
                                break
                            out_f.write(chunk)
                        output_files.append(output_file)
        
        # 如果是文档文件，使用二进制分割以保持文件结构完整性
        elif file_type == 'document':
            # 按二进制分割，确保文档结构完整性
            with open(input_path, 'rb') as f:
                for i in range(num_parts):
                    # 使用目标大小作为文件名，只对第一个文件不加序号
                    if i == 0:
                        output_file = os.path.join(split_output_dir, f"{target_size_mb}M.{output_format}")
                    else:
                        output_file = os.path.join(split_output_dir, f"{target_size_mb}M_part{i+1:03d}.{output_format}")
                    with open(output_file, 'wb') as out_f:
                        chunk = f.read(target_size_bytes)
                        if not chunk:
                            break
                        out_f.write(chunk)
                    output_files.append(output_file)
        
        # 其他文件类型，按二进制分割
        else:
            # 按二进制分割
            with open(input_path, 'rb') as f:
                for i in range(num_parts):
                    # 使用目标大小作为文件名，只对第一个文件不加序号
                    if i == 0:
                        output_file = os.path.join(split_output_dir, f"{target_size_mb}M.{output_format}")
                    else:
                        output_file = os.path.join(split_output_dir, f"{target_size_mb}M_part{i+1:03d}.{output_format}")
                    with open(output_file, 'wb') as out_f:
                        chunk = f.read(target_size_bytes)
                        if not chunk:
                            break
                        out_f.write(chunk)
                    output_files.append(output_file)
        
        return {
            'success': True,
            'files': output_files,
            'split_dir': split_output_dir,
            'message': f'文件已成功分割为 {len(output_files)} 个部分'
        }
        
    except Exception as e:
        # 清理可能创建的文件
        if 'split_output_dir' in locals() and os.path.exists(split_output_dir):
            shutil.rmtree(split_output_dir)
        return {
            'success': False,
            'error': f"分割过程中发生错误: {str(e)}"
        }


def adjust_split_size(file1_path, file2_path, target_size_bytes, input_path, output_format):
    """
    调整分割后的文件大小，使其更接近目标大小
    :param file1_path: 第一个文件路径
    :param file2_path: 第二个文件路径
    :param target_size_bytes: 目标文件大小（字节）
    :param input_path: 原始文件路径
    :param output_format: 输出格式
    :return: 调整后的文件路径列表
    """
    # 获取第一个文件的实际大小
    file1_size = os.path.getsize(file1_path)
    
    # 如果第一个文件大小在目标大小的90%-110%范围内，则不需要调整
    if 0.9 * target_size_bytes <= file1_size <= 1.1 * target_size_bytes:
        return [file1_path, file2_path]
    
    # 如果第一个文件太小，需要增加时长
    if file1_size < 0.9 * target_size_bytes:
        # 计算需要增加的时长比例
        ratio = target_size_bytes / file1_size
        
        # 获取原始视频/音频总时长
        cmd_duration = [
            'ffprobe', '-v', 'error', '-show_entries', 'format=duration', 
            '-of', 'default=noprint_wrappers=1:nokey=1', input_path
        ]
        
        try:
            duration_result = subprocess.run(cmd_duration, check=True, capture_output=True, text=True)
            total_duration = float(duration_result.stdout.strip())
        except (subprocess.CalledProcessError, ValueError):
            return [file1_path, file2_path]  # 如果获取时长失败，返回原文件
        
        # 计算新的目标时长
        file_type = get_file_type(input_path)
        if file_type == 'video':
            # 获取第一个文件的时长
            cmd_file1_duration = [
                'ffprobe', '-v', 'error', '-show_entries', 'format=duration', 
                '-of', 'default=noprint_wrappers=1:nokey=1', file1_path
            ]
            
            try:
                file1_duration_result = subprocess.run(cmd_file1_duration, check=True, capture_output=True, text=True)
                file1_duration = float(file1_duration_result.stdout.strip())
            except (subprocess.CalledProcessError, ValueError):
                return [file1_path, file2_path]
            
            # 计算新的时长
            new_duration = min(file1_duration * ratio, total_duration)
            
            # 重新生成第一个文件
            dir_path = os.path.dirname(file1_path)
            filename = os.path.basename(input_path)
            name_without_ext = os.path.splitext(filename)[0]
            new_file1 = os.path.join(dir_path, f"{name_without_ext}_part1_adj.{output_format.lower()}")
            
            cmd = [
                'ffmpeg', '-i', input_path,
                '-t', str(new_duration),
                '-c:v', 'libx264' if output_format.lower() in ['mp4', 'mov'] else 'libxvid',
                '-c:a', 'aac' if output_format.lower() in ['mp4', 'mov'] else 'mp3',
                '-y', new_file1
            ]
            
            try:
                subprocess.run(cmd, check=True, capture_output=True, text=True)
                # 删除旧文件
                os.remove(file1_path)
                file1_path = new_file1
            except subprocess.CalledProcessError:
                return [file1_path, file2_path]  # 如果调整失败，返回原文件
        
        elif file_type == 'audio':
            # 类似视频的处理方式
            cmd_file1_duration = [
                'ffprobe', '-v', 'error', '-show_entries', 'format=duration', 
                '-of', 'default=noprint_wrappers=1:nokey=1', file1_path
            ]
            
            try:
                file1_duration_result = subprocess.run(cmd_file1_duration, check=True, capture_output=True, text=True)
                file1_duration = float(file1_duration_result.stdout.strip())
            except (subprocess.CalledProcessError, ValueError):
                return [file1_path, file2_path]
            
            new_duration = min(file1_duration * ratio, total_duration)
            
            dir_path = os.path.dirname(file1_path)
            filename = os.path.basename(input_path)
            name_without_ext = os.path.splitext(filename)[0]
            new_file1 = os.path.join(dir_path, f"{name_without_ext}_part1_adj.{output_format.lower()}")
            
            cmd = [
                'ffmpeg', '-i', input_path,
                '-t', str(new_duration),
                '-acodec', get_audio_codec(output_format),
                '-y', new_file1
            ]
            
            try:
                subprocess.run(cmd, check=True, capture_output=True, text=True)
                os.remove(file1_path)
                file1_path = new_file1
            except subprocess.CalledProcessError:
                return [file1_path, file2_path]
    
    # 如果第一个文件太大，需要减少时长
    elif file1_size > 1.1 * target_size_bytes:
        # 计算需要减少的时长比例
        ratio = target_size_bytes / file1_size
        
        # 获取第一个文件的时长
        cmd_file1_duration = [
            'ffprobe', '-v', 'error', '-show_entries', 'format=duration', 
            '-of', 'default=noprint_wrappers=1:nokey=1', file1_path
        ]
        
        try:
            file1_duration_result = subprocess.run(cmd_file1_duration, check=True, capture_output=True, text=True)
            file1_duration = float(file1_duration_result.stdout.strip())
        except (subprocess.CalledProcessError, ValueError):
            return [file1_path, file2_path]
        
        # 计算新的时长
        new_duration = file1_duration * ratio
        
        # 重新生成第一个文件
        dir_path = os.path.dirname(file1_path)
        filename = os.path.basename(input_path)
        name_without_ext = os.path.splitext(filename)[0]
        new_file1 = os.path.join(dir_path, f"{name_without_ext}_part1_adj.{output_format.lower()}")
        
        file_type = get_file_type(input_path)
        if file_type == 'video':
            cmd = [
                'ffmpeg', '-i', input_path,
                '-t', str(new_duration),
                '-c:v', 'libx264' if output_format.lower() in ['mp4', 'mov'] else 'libxvid',
                '-c:a', 'aac' if output_format.lower() in ['mp4', 'mov'] else 'mp3',
                '-y', new_file1
            ]
        elif file_type == 'audio':
            cmd = [
                'ffmpeg', '-i', input_path,
                '-t', str(new_duration),
                '-acodec', get_audio_codec(output_format),
                '-y', new_file1
            ]
        else:
            return [file1_path, file2_path]
        
        try:
            subprocess.run(cmd, check=True, capture_output=True, text=True)
            os.remove(file1_path)
            file1_path = new_file1
        except subprocess.CalledProcessError:
            return [file1_path, file2_path]  # 如果调整失败，返回原文件
    
    return [file1_path, file2_path]


def get_audio_codec(format_name):
    """根据格式获取音频编码器"""
    format_name = format_name.lower()
    if format_name in ['mp3']:
        return 'libmp3lame'
    elif format_name in ['aac', 'mp4', 'mov', 'm4a']:
        return 'aac'
    elif format_name in ['wav']:
        return 'pcm_s16le'
    elif format_name in ['flac']:
        return 'flac'
    elif format_name in ['ogg']:
        return 'libvorbis'
    elif format_name in ['wma']:
        return 'wmav2'
    else:
        return 'libmp3lame'  # 默认使用mp3编码


# 主页路由 - 显示功能选择页面
@app.route('/')
def home():
    """主页 - 功能选择"""
    return render_template('home.html')

# 文件分割页面路由
@app.route('/split')
def split():
    """文件分割页面"""
    return render_template('index.html', 
                          output_formats=OUTPUT_FORMATS,
                          supported_formats=SUPPORTED_FORMATS)

# 文件生成页面路由
@app.route('/generate')
def generate():
    """文件生成页面"""
    return render_template('generate.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    """处理文件上传"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'message': '没有选择文件'})
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'message': '没有选择文件'})
        
        if file and allowed_file(file.filename):
            # 生成安全的文件名
            try:
                filename = secure_filename(file.filename)
            except Exception as e:
                return jsonify({'success': False, 'message': f'文件名处理失败: {str(e)}'})
            
            # 添加UUID前缀避免文件名冲突
            unique_filename = f"{uuid.uuid4()}_{filename}"
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            
            # 确保上传目录存在
            os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
            
            # 保存文件
            try:
                file.save(file_path)
            except Exception as e:
                return jsonify({'success': False, 'message': f'文件保存失败: {str(e)}'})
            
            # 获取文件信息
            try:
                file_size = get_file_size_mb(file_path)
                file_type = get_file_type(filename)
            except Exception as e:
                # 如果获取文件信息失败，删除已上传的文件
                if os.path.exists(file_path):
                    os.remove(file_path)
                return jsonify({'success': False, 'message': f'获取文件信息失败: {str(e)}'})
            
            return jsonify({
                'success': True,
                'file_path': file_path,
                'filename': filename,
                'file_size_mb': round(file_size, 2),
                'file_type': file_type
            })
        else:
            return jsonify({'success': False, 'message': '不支持的文件格式'})
    except Exception as e:
        # 记录错误到控制台
        print(f"上传文件时发生错误: {str(e)}")
        return jsonify({'success': False, 'message': f'上传过程中发生错误: {str(e)}'})


@app.route('/perform_split', methods=['POST'])
def split_file():
    """处理文件分割请求"""
    try:
        # 检查是新上传的文件还是已上传的文件
        if 'uploaded_file_path' in request.form:
            # 使用已上传的文件
            file_path = request.form.get('uploaded_file_path')
            file_name = request.form.get('file_name')
            
            if not file_path or not os.path.exists(file_path):
                return jsonify({'success': False, 'message': '文件不存在'})
                
            file_size = os.path.getsize(file_path)
        else:
            # 新上传的文件
            if 'file' not in request.files:
                return jsonify({'success': False, 'message': '没有选择文件'})
                
            file = request.files['file']
            if file.filename == '':
                return jsonify({'success': False, 'message': '没有选择文件'})
                
            # 保存上传的文件
            filename = secure_filename(file.filename)
            unique_filename = f"{uuid.uuid4()}_{filename}"
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            file.save(file_path)
            file_size = os.path.getsize(file_path)
            file_name = file.filename
        
        # 获取分割参数
        target_size = float(request.form.get('target_size_mb'))
        output_format = request.form.get('output_format')
        
        if not target_size or not output_format:
            return jsonify({'success': False, 'message': '缺少必要参数'})
        
        # 检查目标大小是否合理
        file_size_mb = get_file_size_mb(file_path)
        if target_size >= file_size_mb:
            return jsonify({'success': False, 'message': '目标大小不能大于或等于原文件大小'})
        
        # 确保输出目录存在
        os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)
        
        # 执行分割
        result = split_file_by_size(file_path, app.config['OUTPUT_FOLDER'], target_size, output_format)
        
        if result['success']:
            # 只保留第一个分割文件，删除其余文件
            files_to_keep = []
            files_to_delete = []
            
            if result['files']:
                # 保留第一个文件
                first_file = result['files'][0]
                if os.path.exists(first_file):
                    files_to_keep.append(first_file)
                
                # 收集需要删除的文件（除第一个外的所有文件）
                for file_path in result['files'][1:]:
                    if os.path.exists(file_path):
                        files_to_delete.append(file_path)
                
                # 删除多余的文件
                for file_path in files_to_delete:
                    try:
                        os.remove(file_path)
                        print(f"已删除多余的分割文件: {file_path}")
                    except Exception as e:
                        print(f"删除文件失败 {file_path}: {str(e)}")
            
            # 获取保留文件的信息
            files_info = []
            for file_path in files_to_keep:
                if os.path.exists(file_path):
                    files_info.append({
                        'path': file_path,
                        'name': os.path.basename(file_path),
                        'size_mb': round(get_file_size_mb(file_path), 2),
                        'type': get_file_type(file_path)
                    })
            
            return jsonify({
                'success': True,
                'files': files_info,
                'split_dir': result['split_dir'],
                'message': '已保留第一个分割文件，删除其余文件'
            })
        else:
            return jsonify(result)
    except Exception as e:
        # 记录错误到控制台
        print(f"分割文件时发生错误: {str(e)}")
        return jsonify({'success': False, 'message': f'分割过程中发生错误: {str(e)}'})





@app.route('/list_upload_files')
def list_upload_files():
    """列出上传目录中的所有文件"""
    try:
        upload_folder = app.config['UPLOAD_FOLDER']
        files = []
        
        # 遍历上传目录
        for filename in os.listdir(upload_folder):
            file_path = os.path.join(upload_folder, filename)
            
            # 只处理文件，跳过目录
            if os.path.isfile(file_path):
                # 获取文件信息
                file_size = os.path.getsize(file_path)
                file_ext = os.path.splitext(filename)[1].lower()
                
                # 确定文件类型
                file_type = 'unknown'
                if file_ext in ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv']:
                    file_type = 'video'
                elif file_ext in ['.mp3', '.wav', '.flac', '.aac', '.ogg']:
                    file_type = 'audio'
                elif file_ext in ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.tiff']:
                    file_type = 'image'
                elif file_ext in ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.rtf', '.odt', '.ods', 'odp', 'csv', '.html', '.htm', '.xml']:
                    file_type = 'document'
                
                # 添加到文件列表
                files.append({
                    'name': filename,
                    'path': file_path,
                    'size': file_size,
                    'type': file_type
                })
        
        return jsonify({
            'success': True,
            'files': files
        })
        
    except Exception as e:
        app.logger.error(f"列出上传文件时出错: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'获取文件列表失败: {str(e)}'
        })


@app.route('/delete', methods=['POST'])
def delete_file():
    """删除文件"""
    data = request.get_json()
    
    if not data or 'file_path' not in data:
        return jsonify({'success': False, 'message': '缺少文件路径参数'})
    
    file_path = data['file_path']
    
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            
            # 检查是否为空目录，如果是则删除
            parent_dir = os.path.dirname(file_path)
            if os.path.exists(parent_dir) and not os.listdir(parent_dir):
                os.rmdir(parent_dir)
                
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'message': '文件不存在'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})


@app.route('/generate_file', methods=['POST'])
def generate_file():
    """生成指定类型和大小的文件"""
    try:
        # 获取请求数据
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'message': '请求数据为空'})
        
        category = data.get('category')
        size_mb = data.get('size_mb')
        extension = data.get('extension')
        document_type = data.get('document_type')
        
        # 确保size_mb是数字类型
        try:
            size_mb = float(size_mb)
        except (ValueError, TypeError):
            return jsonify({'success': False, 'message': '文件大小必须是数字'})
        
        # 验证参数
        if not category or not size_mb or not extension:
            return jsonify({'success': False, 'message': '缺少必要参数'})
        
        if category not in ['video', 'audio', 'image', 'document']:
            return jsonify({'success': False, 'message': '不支持的文件类别'})
        
        if category == 'document' and not document_type:
            return jsonify({'success': False, 'message': '请选择文档类型'})
        
        # 确保输出目录存在
        os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)
        
        # 生成唯一文件名
        unique_id = str(uuid.uuid4())[:8]
        temp_filename = f"generated_{unique_id}"
        temp_file_path = os.path.join(app.config['OUTPUT_FOLDER'], temp_filename)
        
        # 根据类别调用不同的生成方法
        if category == 'video':
            # 导入视频生成模块
            sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'addfile'))
            try:
                from video_add import generate_exact_video
                # 生成视频文件 - 使用默认格式mp4，生成后再修改为用户指定的格式
                video_filename = f"{size_mb}M.mp4"  # 视频默认格式为mp4
                video_path = os.path.join(app.config['OUTPUT_FOLDER'], video_filename)
                print(f"🎥 正在生成视频: {video_filename} ({size_mb} MB)...第一个参数{video_path}")
                generate_exact_video(video_path, size_mb)
                if not os.path.exists(video_path):
                    return jsonify({'success': False, 'message': f'视频文件生成失败'})
                temp_file_path = video_path
            except ImportError as e:
                return jsonify({'success': False, 'message': f'导入视频生成模块失败: {str(e)}'})
            except Exception as e:
                return jsonify({'success': False, 'message': f'视频生成过程中出错: {str(e)}'})
        
        elif category == 'audio':
            # 导入音频生成模块
            sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'addfile'))
            try:
                from music_add import generate_noise_wav
                # 生成音频文件 - 使用默认格式wav，生成后再修改为用户指定的格式
                audio_filename = f"{size_mb}M.wav"  # 音频默认格式为wav
                audio_path = os.path.join(app.config['OUTPUT_FOLDER'], audio_filename)
                generate_noise_wav(audio_path, size_mb)
                if not os.path.exists(audio_path):
                    return jsonify({'success': False, 'message': '音频文件生成失败'})
                temp_file_path = audio_path
            except ImportError as e:
                return jsonify({'success': False, 'message': f'导入音频生成模块失败: {str(e)}'})
            except Exception as e:
                return jsonify({'success': False, 'message': f'音频生成过程中出错: {str(e)}'})
        
        elif category == 'image':
            # 导入图片生成模块
            sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'addfile'))
            try:
                from image_add import generate_fixed_size_image
                # 生成图片文件 - 使用默认格式png，生成后再修改为用户指定的格式
                image_filename = f"{size_mb}M.png"  # 图片默认格式为png
                image_path = os.path.join(app.config['OUTPUT_FOLDER'], image_filename)
                generate_fixed_size_image(image_path, size_mb)
                if not os.path.exists(image_path):
                    return jsonify({'success': False, 'message': '图片文件生成失败'})
                temp_file_path = image_path
            except ImportError as e:
                return jsonify({'success': False, 'message': f'导入图片生成模块失败: {str(e)}'})
            except Exception as e:
                return jsonify({'success': False, 'message': f'图片生成过程中出错: {str(e)}'})
        
        elif category == 'document':
            # 导入文档生成模块
            sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'addfile'))
            try:
                if document_type == 'text':
                    from txt_add import generate_text_file
                    # 生成文本文件 - 使用默认格式txt，生成后再修改为用户指定的格式
                    doc_filename = f"{size_mb}M.txt"  # 文本默认格式为txt
                    doc_path = os.path.join(app.config['OUTPUT_FOLDER'], doc_filename)
                    generate_text_file(doc_path, size_mb)
                elif document_type == 'chinese_pdf':
                    from chinese_pdf import generate_chinese_pdf
                    # 生成中文PDF - 使用默认格式pdf，生成后再修改为用户指定的格式
                    doc_filename = f"{size_mb}M.pdf"  # PDF默认格式为pdf
                    doc_path = os.path.join(app.config['OUTPUT_FOLDER'], doc_filename)
                    generate_chinese_pdf(doc_path, size_mb)
                elif document_type == 'english_pdf':
                    from english_pdf import generate_english_pdf
                    # 生成英文PDF - 使用默认格式pdf，生成后再修改为用户指定的格式
                    doc_filename = f"{size_mb}M.pdf"  # PDF默认格式为pdf
                    doc_path = os.path.join(app.config['OUTPUT_FOLDER'], doc_filename)
                    generate_english_pdf(doc_path, size_mb)
                elif document_type in ['docx', 'doc']:
                    from docx_add import generate_fixed_size_docx
                    # 生成Word文档 - 使用默认格式docx，生成后再修改为用户指定的格式
                    doc_filename = f"{size_mb}M.docx"  # Word默认格式为docx
                    doc_path = os.path.join(app.config['OUTPUT_FOLDER'], doc_filename)
                    generate_fixed_size_docx(doc_path, size_mb)
                else:
                    return jsonify({'success': False, 'message': f'不支持的文档类型: {document_type}'})
                
                if not os.path.exists(doc_path):
                    return jsonify({'success': False, 'message': '文档文件生成失败'})
                temp_file_path = doc_path
            except ImportError as e:
                return jsonify({'success': False, 'message': f'导入文档生成模块失败: {str(e)}'})
            except Exception as e:
                return jsonify({'success': False, 'message': f'文档生成过程中出错: {str(e)}'})
        
        # 获取当前文件的默认格式
        current_filename = os.path.basename(temp_file_path)
        current_ext = current_filename.rsplit('.', 1)[1].lower()
        
        # 如果用户指定的格式与默认格式不同，需要重命名
        if extension.lower() != current_ext:
            # 生成用户指定格式的文件名，保持用户输入的大小写
            final_filename = f"{size_mb}M.{extension}"
            final_file_path = os.path.join(app.config['OUTPUT_FOLDER'], final_filename)
            
            try:
                # 直接重命名文件，保留用户输入的后缀名大小写
                os.rename(temp_file_path, final_file_path)
            except Exception as e:
                # 如果重命名失败，尝试复制后删除
                try:
                    shutil.copy2(temp_file_path, final_file_path)
                    os.remove(temp_file_path)
                except Exception as e2:
                    return jsonify({'success': False, 'message': f'修改文件后缀失败: {str(e2)}'})
        else:
            # 如果用户指定的格式与默认格式相同，但大小写不同，也需要重命名
            if extension != current_ext:
                # 生成用户指定格式的文件名，保持用户输入的大小写
                final_filename = f"{size_mb}M.{extension}"
                final_file_path = os.path.join(app.config['OUTPUT_FOLDER'], final_filename)
                
                try:
                    # 直接重命名文件，保留用户输入的后缀名大小写
                    os.rename(temp_file_path, final_file_path)
                except Exception as e:
                    # 如果重命名失败，尝试复制后删除
                    try:
                        shutil.copy2(temp_file_path, final_file_path)
                        os.remove(temp_file_path)
                    except Exception as e2:
                        return jsonify({'success': False, 'message': f'修改文件后缀失败: {str(e2)}'})
            else:
                # 如果用户指定的格式与默认格式完全相同，不需要重命名
                final_file_path = temp_file_path
                final_filename = current_filename
        
        # 获取最终文件信息
        file_size_mb = round(get_file_size_mb(final_file_path), 2)
        
        # 返回成功结果
        return jsonify({
            'success': True,
            'file_name': final_filename,
            'file_path': final_file_path,
            'file_size_mb': file_size_mb,
            'file_type': category,
            'download_url': f'/download_file?path={final_file_path}'
        })
        
    except Exception as e:
        # 记录错误到控制台
        print(f"生成文件时发生错误: {str(e)}")
        return jsonify({'success': False, 'message': f'生成过程中发生错误: {str(e)}'})


@app.route('/download_file')
def download_file():
    """下载文件"""
    file_path = request.args.get('path')
    
    if not file_path or not os.path.exists(file_path):
        return jsonify({'success': False, 'message': '文件不存在'})
    
    try:
        return send_file(file_path, as_attachment=True)
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})


@app.route('/delete_generated_file', methods=['POST'])
def delete_generated_file():
    """删除生成的文件"""
    data = request.get_json()
    
    if not data or 'file_path' not in data:
        return jsonify({'success': False, 'message': '缺少文件路径参数'})
    
    file_path = data['file_path']
    
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            
            # 检查是否为空目录，如果是则删除
            parent_dir = os.path.dirname(file_path)
            if os.path.exists(parent_dir) and not os.listdir(parent_dir):
                os.rmdir(parent_dir)
                
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'message': '文件不存在'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})


@app.route('/delete_split_dir', methods=['POST'])
def delete_split_dir():
    """删除整个分割目录"""
    data = request.get_json()
    
    if not data or 'split_dir' not in data:
        return jsonify({'success': False, 'message': '缺少目录路径参数'})
    
    split_dir = data['split_dir']
    
    try:
        if os.path.exists(split_dir):
            shutil.rmtree(split_dir)
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'message': '目录不存在'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})


@app.route('/list_output_files')
def list_output_files():
    """列出输出目录中的所有文件"""
    try:
        files = []
        for root, dirs, filenames in os.walk(app.config['OUTPUT_FOLDER']):
            for filename in filenames:
                file_path = os.path.join(root, filename)
                rel_path = os.path.relpath(file_path, app.config['OUTPUT_FOLDER'])
                files.append({
                    'path': file_path,
                    'rel_path': rel_path,
                    'name': filename,
                    'size_mb': round(get_file_size_mb(file_path), 2),
                    'type': get_file_type(filename)
                })
        
        return jsonify({'success': True, 'files': files})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})


if __name__ == '__main__':
    # 检查FFmpeg是否安装
    try:
        subprocess.run(['ffmpeg', '-version'], check=True, capture_output=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("错误: 未找到FFmpeg，请确保已安装FFmpeg并添加到系统PATH中")
        sys.exit(1)
    
    # 启动Flask应用
    print("音视频图片文件分割工具启动中...")
    print("请在浏览器中访问: http://127.0.0.1:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)