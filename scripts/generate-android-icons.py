#!/usr/bin/env python3
"""
处理 icons.png 为 Android 自适应图标格式
- foreground: 提取中心区域，保存为 android-icon-foreground.png
- background: 纯色背景，保存为 android-icon-background.png
- monochrome: 单色版本，保存为 android-icon-monochrome.png
"""

from PIL import Image, ImageDraw

# 打开原图
img = Image.open('assets/icons.png')
print(f"原图尺寸: {img.size}, 模式: {img.mode}")

# Android 自适应图标规格
TARGET_SIZE = 108  # 完整图标尺寸
SAFE_ZONE = 72     # 安全区域（不会被裁剪的部分）
SCALE = 3          # 高清屏倍数

final_size = TARGET_SIZE * SCALE  # 324px
safe_size = SAFE_ZONE * SCALE    # 216px

# 计算中心区域（假设图标在图像中心）
w, h = img.size
if w > h:
    # 宽图：取中间部分作为前景
    left = (w - h) // 2
    right = left + h
    top, bottom = 0, h
else:
    # 高图或方形
    left, right = 0, w
    top = (h - w) // 2
    bottom = top + w

# 提取前景图标（居中区域）
foreground = img.crop((left, top, right, bottom))
foreground = foreground.resize((final_size, final_size), Image.LANCZOS)
foreground.save('assets/android-icon-foreground.png')
print(f"前景图已保存: android-icon-foreground.png ({final_size}x{final_size})")

# 创建纯色背景（使用主色调或指定颜色）
# 尝试从原图边缘提取背景色
bg_color = (61, 44, 30, 255)  # 默认深棕色 #3d2c1e

# 创建背景
background = Image.new('RGBA', (final_size, final_size), bg_color)
background.save('assets/android-icon-background.png')
print(f"背景图已保存: android-icon-background.png ({final_size}x{final_size})")

# 创建单色版本（灰度化）
monochrome = foreground.convert('LA')  # 转为灰度+透明
monochrome.save('assets/android-icon-monochrome.png')
print(f"单色图已保存: android-icon-monochrome.png ({final_size}x{final_size})")

print("\n完成！建议检查生成的效果，按需调整颜色或前景区域。")
