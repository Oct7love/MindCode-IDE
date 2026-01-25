# 需求文档

## 简介

本文档定义了 MindCode 代码编辑器的 Git 集成功能需求。该功能将为用户提供完整的 Git 版本控制能力，包括状态显示、差异对比、暂存提交、分支管理和提交历史查看，使开发者无需离开编辑器即可完成日常 Git 操作。

## 术语表

- **Git_Service**: 主进程中负责执行 Git 命令的服务模块
- **Git_Panel**: 渲染进程中显示 Git 状态和操作的侧边栏面板
- **File_Tree**: 文件资源管理器中的文件树组件
- **Diff_Viewer**: 用于显示文件差异对比的 Monaco Editor 组件
- **Status_Indicator**: 文件树中显示文件 Git 状态的视觉标记
- **Staging_Area**: Git 暂存区，用于准备提交的文件集合
- **Working_Directory**: 工作目录，包含当前修改的文件

## 需求

### 需求 1：Git 仓库检测

**用户故事：** 作为开发者，我希望编辑器能自动检测当前工作区是否为 Git 仓库，以便我知道 Git 功能是否可用。

#### 验收标准

1. WHEN 用户打开一个文件夹 THEN Git_Service SHALL 检测该文件夹是否为 Git 仓库
2. WHEN 工作区是 Git 仓库 THEN Git_Panel SHALL 显示 Git 功能界面
3. WHEN 工作区不是 Git 仓库 THEN Git_Panel SHALL 显示"初始化仓库"选项
4. WHEN 用户点击"初始化仓库" THEN Git_Service SHALL 执行 `git init` 并刷新界面

### 需求 2：Git 状态显示

**用户故事：** 作为开发者，我希望在文件树中看到每个文件的 Git 状态，以便快速了解哪些文件被修改、新增或删除。

#### 验收标准

1. WHEN 工作区是 Git 仓库 THEN File_Tree SHALL 为每个文件显示 Git 状态标记
2. WHEN 文件被修改 THEN Status_Indicator SHALL 显示黄色 "M" 标记
3. WHEN 文件是新增的未跟踪文件 THEN Status_Indicator SHALL 显示绿色 "U" 标记
4. WHEN 文件被删除 THEN Status_Indicator SHALL 显示红色 "D" 标记
5. WHEN 文件已暂存 THEN Status_Indicator SHALL 显示绿色 "A" 标记
6. WHEN 文件有冲突 THEN Status_Indicator SHALL 显示红色 "!" 标记
7. WHEN 文件状态发生变化 THEN File_Tree SHALL 在 2 秒内更新状态显示

### 需求 3：Git Diff 查看

**用户故事：** 作为开发者，我希望查看文件的修改差异，以便了解具体改动了什么内容。

#### 验收标准

1. WHEN 用户点击已修改文件的状态图标 THEN Diff_Viewer SHALL 打开并显示差异对比
2. WHEN 显示差异对比 THEN Diff_Viewer SHALL 使用并排双栏布局展示原始内容和修改内容
3. WHEN 显示差异对比 THEN Diff_Viewer SHALL 高亮显示新增行（绿色）和删除行（红色）
4. WHEN 用户在 Git_Panel 中点击文件 THEN Diff_Viewer SHALL 显示该文件的差异
5. IF 文件是新增文件 THEN Diff_Viewer SHALL 显示空白原始内容与完整新内容的对比

### 需求 4：暂存操作

**用户故事：** 作为开发者，我希望能够暂存文件更改，以便准备提交。

#### 验收标准

1. WHEN 用户点击文件旁的"+"按钮 THEN Git_Service SHALL 将该文件添加到暂存区
2. WHEN 用户点击"暂存所有更改"按钮 THEN Git_Service SHALL 将所有已修改文件添加到暂存区
3. WHEN 用户点击已暂存文件旁的"-"按钮 THEN Git_Service SHALL 将该文件从暂存区移除
4. WHEN 暂存操作完成 THEN Git_Panel SHALL 立即更新显示暂存区和工作区的文件列表
5. WHEN 用户右键点击文件 THEN 上下文菜单 SHALL 提供"暂存更改"和"放弃更改"选项

### 需求 5：提交操作

**用户故事：** 作为开发者，我希望能够提交暂存的更改，以便保存我的工作进度。

#### 验收标准

1. WHEN 暂存区有文件 THEN Git_Panel SHALL 显示提交消息输入框和提交按钮
2. WHEN 用户输入提交消息并点击提交 THEN Git_Service SHALL 执行 `git commit` 命令
3. IF 提交消息为空 THEN Git_Panel SHALL 阻止提交并显示错误提示
4. WHEN 提交成功 THEN Git_Panel SHALL 清空提交消息输入框并刷新状态
5. IF 提交失败 THEN Git_Panel SHALL 显示错误消息

### 需求 6：分支管理

**用户故事：** 作为开发者，我希望能够查看、切换和创建分支，以便管理不同的开发线。

#### 验收标准

1. THE Git_Panel SHALL 在顶部显示当前分支名称
2. WHEN 用户点击分支名称 THEN Git_Panel SHALL 显示分支列表下拉菜单
3. WHEN 用户从列表中选择分支 THEN Git_Service SHALL 切换到该分支
4. WHEN 用户点击"新建分支"按钮 THEN Git_Panel SHALL 显示分支名称输入对话框
5. WHEN 用户输入分支名称并确认 THEN Git_Service SHALL 创建并切换到新分支
6. IF 切换分支时有未提交的更改 THEN Git_Panel SHALL 显示警告对话框

### 需求 7：提交历史

**用户故事：** 作为开发者，我希望查看提交历史，以便了解项目的变更记录。

#### 验收标准

1. WHEN 用户点击"提交历史"标签 THEN Git_Panel SHALL 显示提交历史列表
2. WHEN 显示提交历史 THEN 每条记录 SHALL 包含提交哈希、作者、日期和提交消息
3. WHEN 用户点击某条提交记录 THEN Git_Panel SHALL 显示该提交的详细信息和文件变更列表
4. WHEN 用户点击提交中的文件 THEN Diff_Viewer SHALL 显示该文件在该提交中的差异
5. THE Git_Panel SHALL 支持加载更多历史记录（分页加载）

### 需求 8：状态栏集成

**用户故事：** 作为开发者，我希望在状态栏看到 Git 信息，以便快速了解仓库状态。

#### 验收标准

1. THE 状态栏 SHALL 显示当前分支名称
2. THE 状态栏 SHALL 显示未提交更改的数量
3. WHEN 用户点击状态栏的分支名称 THEN Git_Panel SHALL 显示分支切换菜单
4. WHEN 有远程更新可用 THEN 状态栏 SHALL 显示同步图标

