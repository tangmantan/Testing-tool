# 智能 XPath 生成器 (Smart XPath Generator)

这是一个基于 AI 的交互式 XPath 和 CSS 选择器生成工具。它可以解析 HTML 结构，结合 AI (Gemini / DeepSeek) 智能生成稳健的定位符。

## 本地安装与运行

### 1. 前置要求

- 安装 [Node.js](https://nodejs.org/) (推荐 v18 或更高版本)。

### 2. 安装依赖

在项目根目录下打开终端，运行：

```bash
npm install
```

### 3. 启动开发服务器

```bash
npm run dev
```

启动后，浏览器通常会自动打开 `http://localhost:5173`。

### 4. 构建生产版本-本地运行不需要

```bash
npm run build
```

## 使用说明

1. **选择器生成**: 在右侧的可视化预览区点击任意元素，AI 将自动分析并生成 XPath 和 CSS 选择器。
2. **AI 设置**: 点击顶部导航栏右侧的设置按钮，选择 AI 模型 (Gemini, DeepSeek 或自定义 OpenAI 兼容接口) 并填入 API Key。
3. **DOM 树**: 左侧支持切换“源代码”和“DOM 树”视图，方便快速定位复杂结构。
4. **导入 HTML**: 支持直接粘贴 HTML 代码，或通过 URL 导入（需要目标网站支持 CORS 或使用代理）。

## 环境变量配置

您可以在项目根目录创建 `.env` 文件来存储敏感的 API Key，无需每次在界面输入。

**支持的变量名：**

```env
# Google Gemini
API_KEY=your_gemini_key

# DeepSeek
DEEPSEEK_API_KEY=your_deepseek_key

# Custom Provider (Other OpenAI Compatible APIs)
CUSTOM_API_KEY=your_custom_key
CUSTOM_BASE_URL=https://api.example.com/v1
```

配置完成后，请**重新启动**开发服务器 (`npm run dev`) 以使变量生效。
