# Simple Debug Adapter (DAP)

Self-hosted Debug Adapter Protocol implementation written in Simple language.

## Overview

This is the DAP server for Simple, written entirely in Simple itself. It provides:

- ✅ DAP protocol handling over stdin/stdout
- ✅ Breakpoint management (line, conditional)
- ✅ Execution control (continue, pause, step over, step in, step out)
- ✅ Stack trace inspection
- ✅ Variable viewing (scopes and values)
- ⏳ Interpreter integration (TODO - currently mock data)
- ⏳ Watch expressions (TODO)
- ⏳ Exception breakpoints (TODO)

## Architecture

```
main.spl          # Entry point, CLI handling
server.spl        # Server state and request handlers
protocol.spl      # DAP message types and structures
transport.spl     # JSON-RPC over stdio (Content-Length protocol)
breakpoints.spl   # Breakpoint management and tracking
```

## Building

```bash
# Build from project root
./simple/build_tools.sh

# Binary will be at:
./simple/bin_simple/simple_dap
```

## Usage

The DAP server communicates via stdin/stdout using DAP messages:

```bash
# Run the server (typically started by editor/IDE)
./simple/bin_simple/simple_dap

# Enable debug logging
SIMPLE_DAP_DEBUG=1 ./simple/bin_simple/simple_dap
```

## Editor Integration

### VS Code

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "simple",
      "request": "launch",
      "name": "Debug Simple Program",
      "program": "${file}",
      "stopOnEntry": true
    }
  ]
}
```

Add to `.vscode/settings.json`:

```json
{
  "simple.dap.path": "path/to/simple/bin_simple/simple_dap"
}
```

### Neovim

Using `nvim-dap`:

```lua
local dap = require('dap')

dap.adapters.simple = {
  type = 'executable',
  command = 'path/to/simple/bin_simple/simple_dap'
}

dap.configurations.simple = {
  {
    type = 'simple',
    request = 'launch',
    name = 'Debug Simple Program',
    program = '${file}',
  },
}
```

## Protocol Support

### Lifecycle

- ✅ `initialize` - Initialize debugger
- ✅ `launch` - Launch program
- ✅ `configurationDone` - Configuration complete
- ✅ `disconnect` - Disconnect and terminate

### Breakpoints

- ✅ `setBreakpoints` - Set line breakpoints
- ✅ Conditional breakpoints (parsed, not yet evaluated)
- ⏳ Function breakpoints (TODO)
- ⏳ Exception breakpoints (TODO)
- ⏳ Logpoints (TODO)

### Execution Control

- ✅ `continue` - Continue execution
- ✅ `pause` - Pause execution
- ✅ `next` - Step over
- ✅ `stepIn` - Step into function
- ✅ `stepOut` - Step out of function
- ⏳ `stepBack` - Reverse step (TODO)

### Inspection

- ✅ `threads` - Get thread list
- ✅ `stackTrace` - Get call stack
- ✅ `scopes` - Get variable scopes (local, global)
- ✅ `variables` - Get variables in scope
- ⏳ `evaluate` - Evaluate expression (TODO)
- ⏳ `setVariable` - Modify variable (TODO)

### Events (Server → Client)

- ✅ `initialized` - Debug session initialized
- ✅ `stopped` - Execution stopped (breakpoint, step, pause)
- ✅ `terminated` - Debug session ended

## Implementation Details

### Transport Layer (`transport.spl`)

Same Content-Length protocol as LSP:

```
Content-Length: 123\r\n
\r\n
{"type":"request",...}
```

Functions:
- `read_message()` - Read DAP message from stdin
- `write_message(data)` - Write message to stdout
- `write_response(seq, success, command, body)` - Write response
- `write_event(event, body)` - Write event

### Protocol Types (`protocol.spl`)

DAP data structures:
- `Source` - Source file reference
- `Breakpoint` - Breakpoint with verification
- `StackFrame` - Call stack frame
- `Thread` - Thread information
- `Scope` - Variable scope (local/global)
- `Variable` - Variable name/value/type
- `DapRequest/Response/Event` - DAP messages

### Breakpoint Management (`breakpoints.spl`)

Breakpoint tracking:
- `BreakpointEntry` - Breakpoint with metadata
- `BreakpointManager` - Breakpoint storage and lookup
  - `set_breakpoints(source, bps)` - Set breakpoints for file
  - `should_stop_at_line(source, line)` - Check if should stop
  - `increment_hit_count(id)` - Track hits

### Server Logic (`server.spl`)

Server state management:
- `DebuggerState` - Uninitialized/Initialized/Launched/Running/Stopped/Terminated
- `DapServer` - Main server class

Request handlers:
- `handle_initialize()` - Debugger initialization
- `handle_launch()` - Program launch
- `handle_set_breakpoints()` - Breakpoint management
- `handle_threads()` - Thread list
- `handle_stack_trace()` - Call stack
- `handle_scopes/variables()` - Variable inspection
- `handle_continue/pause/next/stepIn/stepOut()` - Execution control

## Current Limitations

⚠️ **This is a protocol-compliant implementation with mock data** - The debugger handles DAP messages correctly but doesn't actually debug Simple programs yet.

**What works:**
- ✅ DAP protocol compliance
- ✅ Breakpoint tracking and verification
- ✅ State management (running, stopped, etc.)
- ✅ Message handling (all lifecycle and control requests)

**What doesn't work yet:**
- ❌ Actual program execution
- ❌ Real breakpoint triggering
- ❌ Live stack inspection
- ❌ Live variable evaluation
- ❌ Interpreter integration

**Next Phase:** Integrate with Simple interpreter to enable real debugging.

## Roadmap

### Phase 1: Protocol Implementation ✅
- ✅ DAP transport
- ✅ Server lifecycle
- ✅ Breakpoint management
- ✅ Execution control
- ✅ Stack/variable inspection (mock)

### Phase 2: Interpreter Integration (TODO)
- ⏳ Debugger hooks in interpreter
- ⏳ Breakpoint trap points
- ⏳ Stack frame capture
- ⏳ Variable extraction from runtime
- ⏳ Step mode execution

### Phase 3: Advanced Features (TODO)
- ⏳ Conditional breakpoint evaluation
- ⏳ Expression evaluation
- ⏳ Watch expressions
- ⏳ Exception breakpoints
- ⏳ Variable modification

### Phase 4: Performance & Polish (TODO)
- ⏳ Optimized stepping
- ⏳ Source mapping for compiled code
- ⏳ Hot reload during debug
- ⏳ Multi-threaded debugging

## Testing

Manual testing with DAP client:

```bash
# Send initialize request
echo '{"type":"request","seq":1,"command":"initialize","arguments":{}}' | \
  ./simple/bin_simple/simple_dap

# Expected: Capabilities response + initialized event
```

Integration testing via editor:
1. Configure editor to use `simple_dap`
2. Set breakpoints in a `.spl` file
3. Start debugging
4. Verify protocol compliance

## Debugging

Enable debug logging:

```bash
export SIMPLE_DAP_DEBUG=1
./simple/bin_simple/simple_dap
```

Debug messages will appear on stderr (won't interfere with DAP on stdout).

## Interpreter Integration (Future)

To enable real debugging, the Simple interpreter needs:

1. **Breakpoint Hooks:**
   ```simple
   # In interpreter loop
   if debugger.should_stop_at_line(current_file, current_line):
       debugger.trigger_breakpoint()
   ```

2. **Stack Capture:**
   ```simple
   fn get_call_stack() -> List<StackFrame>:
       # Walk interpreter call stack
       # Extract function names, line numbers, variables
   ```

3. **Variable Inspection:**
   ```simple
   fn get_variables_in_scope(frame_id: Int) -> List<Variable>:
       # Get local variables from stack frame
       # Get global variables from interpreter state
   ```

4. **Step Mode:**
   ```simple
   enum ExecutionMode:
       Run
       StepOver
       StepIn
       StepOut

   fn execute_step(mode: ExecutionMode):
       # Control interpreter execution granularly
   ```

## References

- [DAP Specification](https://microsoft.github.io/debug-adapter-protocol/)
- Status: `doc/status/dap_implementation.md`
- Features: `doc/features/postponed_feature.md` (#1366-#1368)

## Contributing

To add new DAP features:

1. Add protocol types to `protocol.spl`
2. Implement handler in `server.spl`
3. Update dispatcher in `handle_request()`
4. Test with real debugger client
5. Update this README and status docs
