# Agent Note: 使用全会话 AI 标题建议重命名会话

Status: implemented

[English](2026-08-19-session-rename-title-suggestions.md) | 中文

## Problem

Web 重命名对话框原先只有自由文本输入框；为了方便日后查找会话，用户必须手动构思并输入标题。类似 Codex 的重命名界面会根据完整对话生成多个简洁候选标题，用户可单击选用。

## Decision

`SessionTitleService` 增加只读的 `suggest()`，向已注册的标题提供方请求多个候选项，并执行去重和规范化，不直接提交标题。`SessionTitleProvider` 增加可选的 `suggest` 方法，并以单次 `generate` 作为回退。LLM 基础包（`session-title-llm`）增加 `generateSessionTitleSuggestionsWithLlm`：一次组织全部消息，请求逐行输出 `suggestCount` 个标题，并通过 `suggestMaxOutputTokens` 限制输出；两个配置项的默认值分别为 1 和 256。建议请求复用仅记录日志的 `session/title-llm-request` 事件，使请求同时保持模型可见和日志可查。

新的 RPC `session.suggestTitles` 使用请求 `{ sessionId }` 和响应 `{ titles: string[] }`，沿现有 API 代理链路传递。客户端公开 `ISession.suggestTitles()` / `Session.suggestTitles()`；`ui-workspace` 重命名对话框在打开时获取建议，并将候选项渲染为可单击的标签，单击后预填草稿。

## Alternatives considered

- **打开对话框时自动替换标题。** 这可以缩短操作，但会把建议行为变成意外写入，还可能覆盖已有的有效标题。
- **只根据第一条提示生成。** 第一条提示成本更低，但无法反映会话开始后逐步形成的方向和最终结果。
- **为每个候选项单独发起请求。** 独立调用简化了解析，却会增加成本与延迟，并让候选项之间缺乏整体一致性。

## Consequences

标题建议保持只读和辅助性质：不会追加 `session/title` 事件，不会固定标题，也不会干扰自动生成状态机。建议失败时界面提供轻量重试，同时保留手动重命名能力。两个标题提供方插件都注册 `suggest`，并始终使用完整会话内容，不受第一条提示或全提示生成节奏影响。

## Testing

会话标题测试覆盖去重、回退、空结果和只读语义；LLM 标题测试覆盖消息组织、逐行解析、数量限制和纯空白输出；工作区重命名测试覆盖候选标签渲染及单击预填。API 代理的传输与客户端处理测试桩也包含新方法。
