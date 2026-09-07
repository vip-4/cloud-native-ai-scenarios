# AI Automation - 无服务器 AI 自动化工作流

基于 GitHub Actions + FreeLLMAPI/LiteLLM 的无服务器 AI 自动化工作流方案。

## 功能特性

- 🤖 **AI PR Review**: 自动审查 Pull Request，提供代码质量反馈
- 📊 **Daily AI Summary**: 每日自动生成项目活动摘要
- 🏷️ **AI Issue Triage**: 自动分类和优先级排序 Issues
- 🔍 **AI Code Quality**: 代码质量分析和安全检测
- 🔔 **Multi-channel Notifications**: Slack/钉钉/飞书通知支持

## 架构

```
GitHub Event → GitHub Actions → FreeLLMAPI Gateway → AI Model
                                    ↓
                              Post Comment/Label
```

## 快速开始

### 1. 配置 Secrets

在 GitHub 仓库中配置以下 Secrets：

```bash
# FreeLLMAPI 网关
OPENAI_BASE_URL=http://localhost:3001/v1
OPENAI_API_KEY=freellmapi-89a2cae15297e3084396ce15673295ecd58d48e583a8bee3

# 可选：Slack 通知
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz

# 可选：钉钉通知
DINGTALK_WEBHOOK_URL=https://oapi.dingtalk.com/robot/send?access_token=xxx

# 可选：飞书通知
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxx
```

### 2. 启用工作流

将 `.github/workflows/` 目录复制到你的项目中：

```bash
cp -r .github/workflows/* your-project/.github/workflows/
```

### 3. 自定义配置

编辑各工作流文件中的：
- 模型名称（默认 `kilo-auto`）
- AI 提示词（prompt）
- 触发条件
- 通知渠道

## 工作流详情

### AI PR Review

**触发条件**: PR 打开/更新

**功能**:
- 自动获取 PR diff
- AI 代码审查（安全性、性能、最佳实践）
- 自动添加标签（needs-security-review, needs-performance-review）
- 发布审查评论

**自定义提示词**:
```yaml
messages:
  - role: system
    content: "你自定义的系统提示词..."
```

### Daily AI Summary

**触发条件**: 每天 18:00 UTC / 手动触发

**功能**:
- 汇总最近 24 小时 commits
- 统计 open issues 和 PRs
- AI 生成项目摘要
- 自动创建/更新日报 issue
- 可选发送 Slack/钉钉/飞书通知

### AI Issue Triage

**触发条件**: Issue 打开 / 评论

**功能**:
- 自动分类（bug/feature/question/documentation/security）
- 自动优先级排序（critical/high/medium/low）
- 自动添加标签
- 发布分析评论

### AI Code Quality

**触发条件**: PR 打开/更新 / 推送到 main/develop

**功能**:
- 分析变更的代码文件
- 代码质量评分（1-10）
- 安全漏洞检测
- 性能问题识别
- 创建 GitHub Check

## 环境变量

| 变量 | 说明 | 必需 |
|------|------|------|
| OPENAI_BASE_URL | FreeLLMAPI 网关地址 | 是 |
| OPENAI_API_KEY | FreeLLMAPI API Key | 是 |
| SLACK_WEBHOOK_URL | Slack Webhook URL | 否 |
| DINGTALK_WEBHOOK_URL | 钉钉 Webhook URL | 否 |
| FEISHU_WEBHOOK_URL | 飞书 Webhook URL | 否 |

## 生产部署要点

### 1. 密钥管理

- 使用 GitHub Secrets 存储所有 API Key
- 定期轮转密钥
- 使用最小权限原则

### 2. 成本控制

```yaml
# 在 AI 调用前检查 diff 大小
if: ${{ steps.diff.outputs.diff_size < 50000 }}  # 50KB 限制
```

### 3. 幂等性

- 使用 GitHub Actions 的 `id` 确保不重复执行
- 检查是否已评论过

### 4. 错误处理

```yaml
# 添加错误处理
- name: AI Review
  id: ai_review
  continue-on-error: true
  # ...
```

### 5. 速率限制

```yaml
# 限制 AI 调用频率
- name: Check rate limit
  run: |
    # 使用 Redis 或文件记录调用次数
```

## 参考仓库

| 仓库 | 说明 | 链接 |
|------|------|------|
| LiteLLM GitHub Actions | CI/CD 集成 | https://github.com/BerriAI/litellm/tree/main/cookbook/github_actions |
| GitHub Actions 市场 | AI 自动化 Actions | https://github.com/marketplace?category=ai&type=actions |
| GitHub Script | GitHub API 脚本 | https://github.com/actions/github-script |

## 故障排查

### PR Review 未触发

- 检查 `pull_request` 事件是否在 `on` 中
- 验证 `GITHUB_TOKEN` 权限
- 检查工作流文件语法

### AI 调用失败

- 验证 `OPENAI_BASE_URL` 和 `OPENAI_API_KEY`
- 检查 FreeLLMAPI 网关是否可访问
- 查看 Actions 日志中的详细错误

### 评论未发布

- 检查 `pull-requests: write` 权限
- 验证 GitHub Token 是否有效
- 检查是否已评论过（幂等性）

## License

MIT
