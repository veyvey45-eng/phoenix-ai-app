# Phoenix Code Interpreter (E2B Sandbox)

## Overview

Phoenix now includes a **secure Code Interpreter** powered by **E2B Sandbox**, allowing admin users to execute Python and JavaScript code in an isolated, sandboxed environment.

## Features

✅ **Secure Execution**: Code runs in isolated E2B sandboxes with resource limits  
✅ **Admin-Only Access**: Only Artur Rodrigues Adaga (admin) can execute code  
✅ **Multiple Languages**: Python 3.11 and Node.js 20 support  
✅ **Audit Logging**: Complete audit trail of all code executions  
✅ **Timeout Protection**: 15-second execution timeout per request  
✅ **Dangerous Operation Blocking**: Prevents file deletion, system calls, and eval operations  

## Architecture

### Components

1. **e2bSandbox.ts** - Main E2B integration module
   - `executePython()` - Execute Python code
   - `executeJavaScript()` - Execute JavaScript code
   - `validateCode()` - Block dangerous operations
   - `logAudit()` - Record execution in audit logs

2. **codeInterpreterRouter.ts** - tRPC endpoints
   - `codeInterpreter.executePython` - Run Python code (admin-only)
   - `codeInterpreter.executeJavaScript` - Run JavaScript code (admin-only)
   - `codeInterpreter.getAuditLogs` - View all audit logs (admin-only)
   - `codeInterpreter.getMyAuditLogs` - View personal audit logs

3. **Security Tests** - codeInterpreterSecurity.test.ts
   - Validates dangerous operation detection
   - Tests safe code execution
   - Verifies audit logging

## Usage

### Execute Python Code

```typescript
// Frontend (React)
const result = await trpc.codeInterpreter.executePython.mutate({
  code: `
import math
result = math.sqrt(16)
print(f"Square root of 16: {result}")
`
});

// Returns:
// {
//   success: true,
//   output: "Square root of 16: 4.0\n",
//   executionTime: 1234,
//   language: "python"
// }
```

### Execute JavaScript Code

```typescript
// Frontend (React)
const result = await trpc.codeInterpreter.executeJavaScript.mutate({
  code: `
const numbers = [1, 2, 3, 4, 5];
const sum = numbers.reduce((a, b) => a + b, 0);
console.log(\`Sum: \${sum}\`);
`
});

// Returns:
// {
//   success: true,
//   output: "Sum: 15\n",
//   executionTime: 890,
//   language: "javascript"
// }
```

### Get Audit Logs

```typescript
// Admin-only
const logs = await trpc.codeInterpreter.getAuditLogs.query();

// Returns array of:
// {
//   timestamp: Date,
//   userId: "string",
//   username: "artur@example.com",
//   language: "python" | "javascript",
//   codeLength: 150,
//   success: true,
//   executionTime: 1234,
//   error?: "error message if failed"
// }
```

## Security

### Blocked Operations

**Python:**
- `os.remove()`, `os.rmdir()` - File deletion
- `shutil.rmtree()` - Directory deletion
- `open(..., 'w')` - File writing
- `subprocess.call()`, `subprocess.run()` - System calls
- `exec()`, `eval()` - Code injection

**JavaScript:**
- `fs.unlink()`, `fs.rmdir()`, `fs.rm()` - File deletion
- `fs.writeFile()` - File writing
- `require('fs')`, `require('child_process')` - Dangerous modules
- `eval()`, `Function()` - Code injection

### Allowed Operations

✅ Data analysis and calculations  
✅ File reading (read-only access to `/uploads/` and `/documents/`)  
✅ Database queries (read-only to crypto/weather history)  
✅ Graph generation (matplotlib, plotly)  
✅ Text processing and transformations  
✅ Statistical analysis  

## Configuration

### Environment Variables

```bash
E2B_API_KEY=your_e2b_api_key_here
```

### Timeout

- Default: 15 seconds per execution
- Configurable in `e2bSandbox.ts` (line: `private timeout = 15000`)

### Resource Limits

E2B enforces standard resource limits:
- Memory: 512MB per sandbox
- CPU: Limited by E2B infrastructure
- Disk: Temporary storage only

## Audit Logging

All code executions are logged to:
- **Memory**: Stored in `e2bSandbox.auditLogs[]`
- **File**: `logs/code-execution-audit.log`

Log format:
```
2025-01-04T19:30:45.123Z | User: artur@example.com | Language: python | Success: true | Time: 1234ms | Error: None
```

## Integration with Phoenix Core

The Code Interpreter is available to Phoenix's orchestrator. When Groq/Gemini detects a code execution request, it can:

1. Generate Python or JavaScript code
2. Call `codeInterpreter.executePython` or `codeInterpreter.executeJavaScript`
3. Receive execution results
4. Display output to the user

## Testing

Run security tests:

```bash
pnpm test -- codeInterpreterSecurity.test.ts
```

Run E2B API validation:

```bash
pnpm test -- e2bSandbox.test.ts
```

## Limitations

- ❌ No file system write access (read-only mode)
- ❌ No network access (sandboxed)
- ❌ No system command execution
- ❌ No external module imports (only standard library)
- ⏱️ 15-second execution timeout

## Future Enhancements

- [ ] Support for R and Julia languages
- [ ] Graph visualization in UI
- [ ] PDF report generation
- [ ] Custom timeout per request
- [ ] Rate limiting per user
- [ ] Code sharing and versioning
- [ ] Integration with Phoenix's memory system

## Support

For issues or questions:
1. Check audit logs: `trpc.codeInterpreter.getAuditLogs.query()`
2. Review error messages in execution results
3. Verify E2B API key is correctly configured
4. Check E2B dashboard for sandbox status
