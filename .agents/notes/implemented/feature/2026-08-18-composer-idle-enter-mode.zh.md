# Agent Note: 输入框空闲态 Enter 模式（发送 | 换行）

Status: implemented

[English](2026-08-18-composer-idle-enter-mode.md) | 中文

## Problem

输入框的普通 Enter 在寻址 agent 空闲时总是直接提交，只有 Shift+Enter 才能换行。习惯聊天式输入框的用户期望空闲时 Enter 换行、Cmd/Ctrl+Enter 发送，而获得该行为的唯一途径是给已发布的前端包打补丁，桌面端升级后即失效。

## Decision

`ui-conversation` 新增第二个持久化偏好：`ui-conversation.enterMode`，取值为 `send`（默认值，保持现有行为）与 `newline`（空闲时普通 Enter 放行原生换行插入）。`ComposerSubmissionPolicy` 在 `busyEnter` 旁新增 `enterMode` 快照存储；Host settings 支撑的设置区块经既有 scope 采纳并写回该偏好，设置行渲染第二个选择器，`InputBar` 在 Enter 分支 `preventDefault` 之前读取实时快照。可用的空闲输入框使用 `newline` 时，`InputBar` 会保留当前操作提示，并在文本框 placeholder 中追加普通 Enter 与 Cmd/Ctrl+Enter 的含义；因此该提示会跟随实时偏好变化，且不会取代 Hero、Plan 或 owner 提供的提示。繁忙、锁定、裁决中/提交中以及加速 Enter 均保持原有手势，Shift+Enter 仍是无条件换行组合键。该偏好所依托的持久化边界见[Host settings 持久化决策](../bug-fix/2026-08-06-host-backed-web-preferences.md)。

## Alternatives considered

- **运行时补丁已编译的前端包。** 桌面端每次升级都会丢失改动，且绕过了 settings 接缝；本决策取代的正是这一本地补丁路线。
- **在另一个新插件里注册独立 settings 命名空间。** Enter 模式本就属于该策略已采纳的会话设置文档；第二个命名空间会在没有第二个 owner 的情况下重复整套 scope 接线。
- **把 `enterMode` 默认值设为 `newline`。** 非破坏性默认值能保住已发布行为；想要聊天式组合键的用户只需点击一次偏好即可。

## Consequences

设置行渲染两个选择器；持久化文档包含一个新增字段，其默认值保证既有文档依然有效。空闲换行分支在 `preventDefault` 之前返回，因此原生按键重复会像普通 textarea 一样连续插入换行——这是有意为之。Newline 快捷键提示只在空闲输入框能够接纳对应组合键时出现；Send 模式、繁忙输入和不可用输入框保留既有 placeholder。该偏好只影响空闲手势；queue/steer 繁忙行为与整队列插话组合键均保持不变。

## Testing

策略采纳与持久化用例扩展 `submission-policy.client.spec.ts`；InputBar 套件覆盖实时 placeholder 变化、操作提示保留、空闲换行放行、Newline 模式下繁忙态的 Queue/Steer 映射与加速发送，以及锁定输入框吞掉 Enter；第二个选择器扩展设置行套件。无密钥 Web 设置场景会捕获新增设置行，并证明两项 Enter 偏好都能在刷新以及另一端口上的第二个 Host 中恢复。
