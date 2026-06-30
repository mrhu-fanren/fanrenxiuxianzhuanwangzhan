# Tasks

## 阶段一：转场与动效基础
- [x] Task 1: 实现页面切换淡入淡出高级转场
  - [x] SubTask 1.1: 新增 assets/js/transition.js，拦截站内链接点击，触发雾气/墨迹遮罩淡出当前页 → 加载目标页 → 淡入
  - [x] SubTask 1.2: 首页 Hero 首次进入用墨迹展开/卷轴打开渐显
  - [x] SubTask 1.3: 转场时长 600-900ms，过程顺滑无闪烁，支持浏览器前进后退
- [x] Task 2: 引入动效库与收敛动效
  - [x] SubTask 2.1: 引入 GSAP（CDN）与 Lenis 平滑滚动
  - [x] SubTask 2.2: 仅保留缓慢云雾流动、视差滚动、墨迹展开、卷轴打开，移除弹跳/缩放/闪光

## 阶段二：色彩与材质系统
- [x] Task 3: 重写 assets/css/style.css 色彩系统为 CSS 变量
  - [x] SubTask 3.1: 定义主色/辅色/点缀色/文字色全套 CSS 变量，严格按 spec 色值
  - [x] SubTask 3.2: 全站替换旧墨绿/米色为凡人修仙传专属色板
- [x] Task 4: 新增 assets/css/textures.css 材质与光影
  - [x] SubTask 4.1: 山石/布料/金属/木质/纸张/地面纹理类（可用 SVG/渐变/噪点模拟）
  - [x] SubTask 4.2: 柔和漫射光、体积雾、远处薄雾背景层
  - [x] SubTask 4.3: 移除高饱和霓虹、廉价闪光、全屏发光

## 阶段三：排版与字体
- [x] Task 5: 落实排版字体规范
  - [x] SubTask 5.1: 引入思源宋体/Noto Serif SC/Cinzel/Playfair Display（Google Fonts CDN）
  - [x] SubTask 5.2: 标题字距 0.15-0.25em，正文行高 1.8-2.0，段落 2.2-2.6
  - [x] SubTask 5.3: 建立五级字号层级，大量留白

## 阶段四：布局与组件重构
- [x] Task 6: 重构全局布局为古风卷轴式
  - [x] SubTask 6.1: 宽屏多区域强留白布局，去现代 SaaS 模板感
  - [x] SubTask 6.2: 卡片去圆角改暗金细线边框，背景微透明带纹理
  - [x] SubTask 6.3: 按钮半透明深色+暗金边框，悬停暗金填充文字变黑
  - [x] SubTask 6.4: 导航顶部极简或侧边窄导航，暗金细线分隔，悬停暗金下划线
- [x] Task 7: 重构公共页头页脚（common.js 注入）匹配新质感

## 阶段五：首页与内页重构
- [x] Task 8: 重构首页 Hero（高画质山崖云海背景、暗金大字、印章装饰、墨迹渐显）
- [x] Task 9: 重构人物页（远山竹林背景+竹简卷轴面板）
- [x] Task 10: 重构功法/境界页（古卷剑痕阵图、远山阶梯云海分层）
- [x] Task 11: 重构法宝页（石台木案青铜架展示）
- [x] Task 12: 重构地图/地理页（古地图卷轴星图航点）
- [x] Task 13: 其余内页统一应用新质感（scenes/sects/beasts/pills/music/qa 等全部页面）

## 阶段六：验证
- [x] Task 14: 全站视觉验证（色彩/材质/字体/布局/转场/动效是否符合 spec）
- [x] Task 15: 禁忌检查（无黑红地狱风、无高饱和荧光、无圆角玻璃拟态、无满屏发光粒子）

# Task Dependencies
- Task 2 依赖 Task 1
- Task 3/4/5 可并行
- Task 6 依赖 Task 3/4
- Task 7 依赖 Task 6
- Task 8-13 依赖 Task 6/7，可并行
- Task 14/15 依赖所有
