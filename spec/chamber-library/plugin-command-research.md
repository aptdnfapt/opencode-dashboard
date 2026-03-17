# Plugin Command Research

Date: 2026-03-17

## Purpose

This file explains how to implement the new Chamber slash commands in the dashboard plugin.

The goal is to give a coding agent enough source-backed context to implement:
- `/cc-add`
- `/cc-remove`
- `/cc-done`
- optional web-UI driven tracked/tag updates through backend APIs
- a small TUI confirmation notification when the slash command runs

This is research and guidance only.
It is not intended to lock exact code.

---

## Main finding

Yes, the dashboard plugin should implement the Chamber slash commands through OpenCode's plugin command hook.

The command should not just become normal prompt text.
Instead, the plugin should intercept the slash command, do the side effect itself, optionally show a small TUI toast/confirmation, and prevent the command from continuing as a normal chat prompt.

For our use case, the side effect is a `fetch`/POST from the plugin to the dashboard backend.

---

## Source references

## Current dashboard plugin

Current plugin to extend:
- `/home/idc/proj/opencode-dashboard/plugin/dashboard.ts`

Current state:
- already sends event payloads to dashboard backend
- already tracks session lifecycle, timeline, tokens, tool calls
- does not yet implement Chamber slash commands
- does not yet emit tracked/tag metadata changes

## Example plugin using slash command interception

Reference plugin:
- `/home/idc/proj/opencode-pty/src/plugin.ts`

Why it matters:
- it shows the exact plugin hook for slash command handling
- it shows how plugin registers command names in `config`
- it shows how a command is intercepted before normal execution

Important lines in that file:
- `command.execute.before` hook intercepts slash commands
- `config` hook adds command definitions so they appear in TUI command list
- plugin throws after handling to stop normal command flow

## OpenCode plugin hook contract

Plugin hook definitions:
- `/home/idc/proj/opencode/packages/plugin/src/index.ts`

Important findings from there:
- plugins support `config`
- plugins support `event`
- plugins support `chat.message`
- plugins support `tool.execute.before`
- plugins support `command.execute.before`

The relevant command hook signature is defined there as:
- input contains `command`, `sessionID`, `arguments`
- output contains `parts`

This confirms the dashboard plugin can directly intercept `/cc-add`, `/cc-remove`, `/cc-done`.

## Where OpenCode triggers plugin command hooks

Command hook trigger location:
- `/home/idc/proj/opencode/packages/opencode/src/session/prompt.ts`

Important finding:
- OpenCode calls `Plugin.trigger("command.execute.before", ...)` before the prompt is finally submitted

Meaning:
- our plugin can catch the slash command before it turns into ordinary prompt text
- this is the right place to perform backend POST/fetch side effects

## TUI event definitions

TUI event types:
- `/home/idc/proj/opencode/packages/opencode/src/cli/cmd/tui/event.ts`

Important available events:
- `tui.prompt.append`
- `tui.command.execute`
- `tui.toast.show`
- `tui.session.select`

For Chamber commands, the important one is:
- `tui.toast.show`

This is the cleanest way to show a small in-TUI confirmation after a command runs.

## SDK support for TUI APIs

TUI SDK methods:
- `/home/idc/proj/opencode/packages/sdk/js/src/v2/gen/sdk.gen.ts`

Important methods available:
- `appendPrompt(...)`
- `executeCommand(...)`
- `showToast(...)`
- `publish(...)`
- `selectSession(...)`

This means plugin/client code can trigger TUI feedback without inventing a custom mechanism.

## TUI toast rendering path

Toast handling in TUI app:
- `/home/idc/proj/opencode/packages/opencode/src/cli/cmd/tui/app.tsx`

Important finding:
- the TUI listens for `tui.toast.show`
- received toast events become visible toast notifications in the UI

## TUI HTTP/event routes

TUI routes:
- `/home/idc/proj/opencode/packages/opencode/src/server/routes/tui.ts`

Important findings:
- there is an endpoint for showing a toast
- there is a generic publish route for TUI events
- this confirms TUI feedback is a first-class supported flow, not a hack

## Slash command registration in core UI

Relevant command UI/context references:
- `/home/idc/proj/opencode/packages/app/src/context/command.tsx`
- `/home/idc/proj/opencode/packages/app/src/pages/session/use-session-commands.tsx`
- `/home/idc/proj/opencode/packages/web/src/content/docs/commands.mdx`
- `/home/idc/proj/opencode/packages/web/src/content/docs/plugins.mdx`

Why they matter:
- they confirm slash commands are first-class TUI concepts
- they show command metadata such as `description` and `slash`
- they help the agent understand how the commands surface in the UI

---

## Recommended implementation model

## 1. Register Chamber commands in plugin config

The dashboard plugin should add command metadata in its `config` hook.

At minimum register:
- `cc-add`
- `cc-remove`
- `cc-done`

Each should have:
- command description visible in TUI
- minimal template text only if required by the command system

Reason:
- command becomes discoverable in slash UI
- behavior is aligned with how `opencode-pty` registers commands

## 2. Intercept the commands in `command.execute.before`

The plugin should check `input.command`.

If command is one of the Chamber commands:
- read `sessionID`
- optionally read `arguments` if later used for tag setting or other metadata
- POST/fetch to dashboard backend
- show TUI confirmation toast
- stop normal prompt execution

This is the main unique part a coding agent might otherwise miss.

## 3. Use backend POST/fetch as the command side effect

Unlike the PTY plugin, our command is not opening a browser or local UI.

Our command should call dashboard backend with structured metadata updates.

Expected examples of intent:
- `/cc-add` --> mark session tracked
- `/cc-remove` --> untrack session without completion
- `/cc-done` --> untrack session and set completion metadata

This likely means new backend endpoints or an extended `/events` contract.

Recommended design direction:
- avoid encoding these state changes as fake timeline messages
- use explicit metadata update payloads

## 4. Show a small TUI confirmation after command runs

The plugin should show a small toast after a successful command.

Examples of desired confirmation style:
- `Added to Captain's Chamber`
- `Removed from Captain's Chamber`
- `Marked done and removed from Captain's Chamber`

Reason:
- user gets immediate local feedback
- avoids ambiguity about whether the backend POST worked
- matches the user's request for a small TUI notification card/confirmation

Recommended mechanism:
- use TUI toast support from OpenCode
- do not invent a custom prompt-text hack unless toast is insufficient

## 5. Optional prompt append only if needed

OpenCode also supports `tui.prompt.append`.

This could be useful later if the product wants command-generated prompt text.

For the Chamber commands, toast is the better default.

Reason:
- these commands are operational actions
- they should not pollute chat history unless intentionally desired

## 6. Keep plugin telemetry path unified

The current dashboard plugin already has a `send(payload)` path in:
- `/home/idc/proj/opencode-dashboard/plugin/dashboard.ts`

Recommended direction:
- reuse one backend communication helper
- extend payload types instead of creating a totally separate transport style

This keeps command-driven metadata changes consistent with existing event-driven telemetry.

---

## Recommended backend contract direction

The slash commands should update explicit session metadata.

Recommended fields or equivalent backend meaning:
- `is_tracked`
- `completed_at`
- `completed_reason='cc_done'`

Likely optional later:
- `group_tag`

Recommended event/update types:
- chamber track update
- chamber remove update
- chamber done update

The exact endpoint shape can vary, but the spec should preserve one rule:

The backend should receive explicit metadata changes, not infer them from raw text.

---

## Suggested plugin behavior for each command

## `/cc-add`

Plugin should:
- identify current `sessionID`
- POST tracked=true update to backend
- show success toast in TUI
- prevent normal slash prompt execution

## `/cc-remove`

Plugin should:
- identify current `sessionID`
- POST tracked=false update to backend
- do not write completion metadata
- show success toast in TUI
- prevent normal slash prompt execution

## `/cc-done`

Plugin should:
- identify current `sessionID`
- POST tracked=false plus completion metadata to backend
- show success toast in TUI
- prevent normal slash prompt execution

---

## Suggested future extension

Even though the first pass only needs the three Chamber commands, this same hook model can later support:
- tag-setting slash commands
- row/project-level actions if they ever belong in terminal flow
- explicit sync or re-send operations

---

## Important implementation cautions

## Do not rely on normal prompt text

The Chamber commands should be operational plugin commands, not ordinary text prompts that the LLM sees and interprets.

## Do not hide failures silently

If backend POST fails, the plugin should surface failure to the user with an error/warning toast.

## Do not mix chamber metadata with `group_tag`

Tracked/done metadata remains separate from generic tag metadata.

## Do not duplicate detail logic in TUI

The TUI toast is only confirmation feedback.
The real state change still belongs in backend + dashboard UI.

---

## Practical implementation path for this repo

Start in:
- `/home/idc/proj/opencode-dashboard/plugin/dashboard.ts`

Add:
- `config` hook to register slash commands
- `command.execute.before` hook to intercept them
- backend POST/fetch for metadata updates
- TUI toast on success/failure

Keep using source references from:
- `/home/idc/proj/opencode-pty/src/plugin.ts`
- `/home/idc/proj/opencode/packages/plugin/src/index.ts`
- `/home/idc/proj/opencode/packages/opencode/src/session/prompt.ts`
- `/home/idc/proj/opencode/packages/opencode/src/cli/cmd/tui/event.ts`
- `/home/idc/proj/opencode/packages/sdk/js/src/v2/gen/sdk.gen.ts`
- `/home/idc/proj/opencode/packages/opencode/src/cli/cmd/tui/app.tsx`
- `/home/idc/proj/opencode/packages/opencode/src/server/routes/tui.ts`

---

## Conclusion

The implementation path is clear.

OpenCode already provides:
- slash command interception through plugins
- command registration through plugin config
- TUI toast support for lightweight feedback

So the dashboard plugin should implement Chamber commands as real plugin commands that:
- intercept slash execution
- POST metadata updates to dashboard backend
- show TUI confirmation toast
- stop the command from becoming ordinary prompt text
