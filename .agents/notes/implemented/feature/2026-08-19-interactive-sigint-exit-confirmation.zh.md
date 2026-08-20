# Agent Note: 交互式 SIGINT 退出确认

Status: implemented

[English](2026-08-19-interactive-sigint-exit-confirmation.md) | 中文

## Problem

在交互式 `dsh` 终端中误按 Ctrl+C，会立即开始关闭长时间运行的界面（如 `dsh web`）及其中正在进行的代理会话。意外中断一旦发生，用户没有机会撤回。

## Decision

启动器在现有 `ProcessShutdown` 控制器之前增加确认门（`apps/cli/src/exit-confirmation.ts`）。在交互式终端（`process.stdout.isTTY`）中，第一次 SIGINT 只打印提示并启动三秒确认窗口，不进入排空流程；窗口内第二次 SIGINT 才继续退出（退出码 130），窗口到期则取消。SIGTERM 始终绕过确认（退出码 0），非 TTY 进程继续保持单次信号行为。`createProcessShutdown` 内现有的“排空后强制退出”升级机制保持不变。

## Alternatives considered

- **第一次 SIGINT 立即退出。** 这保留了传统单信号行为，但长时间运行的交互会话仍会因一次误触而终止。
- **要求输入文字确认。** 文字提示更明确，但会与终端输入竞争，需要额外的逐行读取状态机，并延迟确实希望立即停止的操作。
- **对 SIGTERM 和非交互进程也启用确认。** 统一门控可以简化表面行为，但会削弱进程管理器和自动化流程的关闭语义。

## Consequences

`profile-boot.ts` 在调用 `shutdown.interrupt` 前把确认门接入 SIGINT/SIGTERM 处理器。一次性无头任务在 TTY 下运行时同样保留确认；PTY 端到端测试因此依次发送确认、排空、强制退出三个信号。底层进程关闭控制器继续承担原有职责。

## Testing

`exit-confirmation.spec.ts` 覆盖启动确认、继续退出、窗口过期、非交互模式、已消费信号和释放；`headless-shutdown.e2e.ts` 覆盖“确认 → 排空 → 强制退出”流程。
