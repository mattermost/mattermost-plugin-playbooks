# Agent Instructions (server/)

## Go Testing

- Use the `testify` library (`require`/`assert`) for all assertions in Go tests.
- Never use the Go standard library testing assertions (`t.Fatal`, `t.Fatalf`, `t.Error`, `t.Errorf`) to check expected values — use `require.NoError`, `require.Equal`, `assert.True`, etc. instead.
