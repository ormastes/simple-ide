# Debug Adapter Protocol - Adapter Layer

This directory contains the adapter layer for the Debug Adapter Protocol (DAP) implementation. The adapter layer provides a unified interface (`DebugAdapter` trait) that allows debugging to work transparently across different backends.

## Architecture

```
Test/Debug Code
    ↓
DebugAdapter (trait)
    ├─ LocalAdapter → InterpreterHookContext
    ├─ GdbMiAdapter → GDB MI Client → QEMU/Hardware
    └─ Trace32Adapter → Trace32 API (future)
```

## Files

| File | Purpose | Lines |
|------|---------|-------|
| `mod.spl` | DebugAdapter trait, AdapterConfig, AdapterCapabilities | ~230 |
| `gdb_mi.spl` | GDB MI adapter (wraps GdbMiClient) | ~280 |
| `local.spl` | Local interpreter adapter (wraps InterpreterHookContext) | ~250 |

## DebugAdapter Trait

The `DebugAdapter` trait defines a common interface for all debug backends:

### Connection Management
- `name()` - Get adapter name
- `is_attached()` - Check if attached
- `attach(program, args)` - Attach to target
- `detach()` - Detach from target

### Execution Control
- `halt()` - Stop execution
- `resume()` - Continue execution
- `single_step()` - Step into
- `step_over()` - Step over function calls
- `step_out()` - Step out of current function
- `reset()` - Reset target

### Breakpoints
- `set_breakpoint(file, line)` - Set breakpoint
- `set_breakpoint_at_addr(addr)` - Set breakpoint at address
- `delete_breakpoint(id)` - Delete breakpoint
- `set_watchpoint(expr, access)` - Set memory watchpoint

### Variable Inspection
- `read_locals()` - Read local variables
- `read_arguments()` - Read function arguments
- `read_globals()` - Read global variables
- `evaluate(expr)` - Evaluate expression

### Stack Inspection
- `stack_trace()` - Get call stack
- `stack_depth()` - Get stack depth
- `select_frame(level)` - Select frame for inspection
- `current_location()` - Get current location

### Memory Access (bare-metal only)
- `read_memory(addr, size)` - Read memory bytes
- `write_memory(addr, data)` - Write memory bytes

### Register Access (bare-metal only)
- `read_register(name)` - Read single register
- `read_all_registers()` - Read all registers
- `write_register(name, value)` - Write register

### Context Management
- `clear_context()` - Clear state for test isolation
- `reload_program(program)` - Reload program

## Adapters

### LocalAdapter

**Purpose:** Debug Simple code running in the interpreter

**Backend:** `InterpreterHookContext`

**Capabilities:**
- ✅ Context clearing (test isolation)
- ✅ Program reloading
- ✅ Variable inspection
- ✅ Stack traces
- ✅ Breakpoints
- ❌ Memory access (not applicable)
- ❌ Register access (not applicable)

**Use case:**
```simple
use app.dap.adapter.local.LocalAdapter
use app.dap.adapter.mod.AdapterConfig

val config = AdapterConfig.local("test.spl")
val adapter = LocalAdapter.create(config)
adapter.attach("test.spl", [])
```

### GdbMiAdapter

**Purpose:** Debug code running on QEMU or hardware with GDB stub

**Backend:** `GdbMiClient` → GDB MI protocol → QEMU/Hardware

**Capabilities:**
- ✅ Memory access
- ✅ Register access
- ✅ Hardware breakpoints
- ✅ Watchpoints
- ✅ Target reset
- ❌ Context clearing (hardware doesn't have interpreter context)

**Use case:**
```simple
use app.dap.adapter.gdb_mi.GdbMiAdapter
use app.dap.adapter.mod.AdapterConfig

val config = AdapterConfig.gdb("localhost", 1234, "test.elf")
val adapter = GdbMiAdapter.connect(config)?
adapter.attach("test.elf", [])
```

### Trace32Adapter (Future)

**Purpose:** Debug code on hardware via Lauterbach Trace32

**Backend:** Trace32 RCL/Python API

**Capabilities:**
- ✅ Memory access
- ✅ Register access
- ✅ Hardware trace
- ✅ Coverage analysis
- ✅ Target reset
- ❌ Context clearing

## Capability Reporting

Each adapter reports its capabilities:

```simple
val caps = adapter.get_capabilities()

if caps.can_reset:
    adapter.reset()?

if caps.supports_memory:
    val data = adapter.read_memory(0x80000000, 64)?

if caps.can_clear_context:
    adapter.clear_context()?  # For test isolation
```

## Configuration

### AdapterConfig

Factory methods for common configurations:

```simple
# Local interpreter
val config = AdapterConfig.local("test.spl")

# QEMU via GDB
val config = AdapterConfig.gdb("localhost", 1234, "test.elf")

# Trace32 (future)
val config = AdapterConfig.trace32("localhost", 20000, "test.elf")
```

## Integration

### With TestExecutor

The `TestExecutor` (in `lib/execution/mod.spl`) uses adapters transparently:

```simple
use lib.execution.mod.{ExecutionConfig, TestExecutor}

# Local execution (uses LocalAdapter internally)
val config = ExecutionConfig.local("test.spl")
val executor = TestExecutor.create(config)?

# Remote execution (uses GdbMiAdapter internally)
val config = ExecutionConfig.qemu_riscv32("test.elf", 1234)
val executor = TestExecutor.create(config)?
```

### With DAP Server

The DAP server can use adapters instead of direct hook context:

```simple
# In src/app/dap/server.spl
val adapter = match target:
    "local": LocalAdapter.create(config)
    "qemu": GdbMiAdapter.connect(config)?
    _: return Err("unsupported target")

# All DAP operations route through adapter
adapter.set_breakpoint(file, line)?
val vars = adapter.read_locals()?
```

## Adding New Adapters

To add support for a new debug backend:

1. **Implement DebugAdapter trait:**
   ```simple
   class MyAdapter:
       # ... fields

   impl MyAdapter for DebugAdapter:
       fn name() -> text:
           "my-adapter"

       fn attach(...) -> Result<text, text>:
           # Implementation

       # ... implement all trait methods
   ```

2. **Define capabilities:**
   ```simple
   static fn create(config: AdapterConfig) -> MyAdapter:
       MyAdapter(
           capabilities: AdapterCapabilities.basic()
               .with_memory()
               .with_registers()
       )
   ```

3. **Add to ExecutionConfig:**
   ```simple
   # In lib/execution/mod.spl
   elif config.uses_my_backend():
       MyAdapter.connect(adapter_config)?
   ```

## Testing

Test suite: `test/01_unit/lib/unified_execution_spec.spl`

Run tests:
```bash
bin/simple test test/01_unit/lib/unified_execution_spec.spl
```

Run with QEMU (requires QEMU binaries):
```bash
bin/simple test test/01_unit/lib/unified_execution_spec.spl --only-skipped
```

## See Also

- `lib/execution/mod.spl` - Unified execution framework
- `lib/qemu/test_session.spl` - QEMU session management
- `remote/protocol/gdb_mi.spl` - GDB MI client
- `doc/07_guide/unified_execution_guide.md` - User guide
