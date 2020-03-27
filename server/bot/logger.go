package bot

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"
)

const timed = "__since"
const elapsed = "Elapsed"

// LogContext .
type LogContext map[string]interface{}

func (l LogContext) copyShallow() LogContext {
	if l == nil {
		return nil
	}

	ret := make(LogContext)
	for k, v := range l {
		ret[k] = v
	}
	return ret
}

func level(l string) int {
	switch l {
	case "debug":
		return 4
	case "info":
		return 3
	case "warn":
		return 2
	case "error":
		return 1
	}
	return 0
}

func toKeyValuePairs(in map[string]interface{}) (out []interface{}) {
	for k, v := range in {
		out = append(out, k)
		out = append(out, v)
	}
	return out
}

// With .
func (b *Bot) With(logContext LogContext) Logger {
	newBot := b.clone()
	if len(newBot.logContext) == 0 {
		newBot.logContext = map[string]interface{}{}
	}
	for k, v := range logContext {
		newBot.logContext[k] = v
	}
	return newBot
}

// Timed .
func (b *Bot) Timed() Logger {
	return b.With(LogContext{
		timed: time.Now(),
	})
}

// Debugf .
func (b *Bot) Debugf(format string, args ...interface{}) {
	measure(b.logContext)
	message := fmt.Sprintf(format, args...)
	b.pluginAPI.Log.Debug(message, toKeyValuePairs(b.logContext)...)
	if level(b.configService.GetConfiguration().AdminLogLevel) >= 4 {
		b.logToAdmins("DEBUG", message)
	}
}

// Errorf .
func (b *Bot) Errorf(format string, args ...interface{}) {
	measure(b.logContext)
	message := fmt.Sprintf(format, args...)
	b.pluginAPI.Log.Error(message, toKeyValuePairs(b.logContext)...)
	if level(b.configService.GetConfiguration().AdminLogLevel) >= 1 {
		b.logToAdmins("ERROR", message)
	}
}

// Infof .
func (b *Bot) Infof(format string, args ...interface{}) {
	measure(b.logContext)
	message := fmt.Sprintf(format, args...)
	b.pluginAPI.Log.Info(message, toKeyValuePairs(b.logContext)...)
	if level(b.configService.GetConfiguration().AdminLogLevel) >= 3 {
		b.logToAdmins("INFO", message)
	}
}

// Warnf .
func (b *Bot) Warnf(format string, args ...interface{}) {
	measure(b.logContext)
	message := fmt.Sprintf(format, args...)
	b.pluginAPI.Log.Warn(message, toKeyValuePairs(b.logContext)...)
	if level(b.configService.GetConfiguration().AdminLogLevel) >= 2 {
		b.logToAdmins("WARN", message)
	}
}

func (b *Bot) logToAdmins(level, message string) {
	if b.configService.GetConfiguration().AdminLogVerbose && len(b.logContext) > 0 {
		message += "\n" + JSONBlock(b.logContext)
	}
	_ = b.dmAdmins("(log " + level + ") " + message)
}

// NilLogger Nil logger.
type NilLogger struct{}

// With .
func (l *NilLogger) With(logContext LogContext) Logger { return l }

// Timed .
func (l *NilLogger) Timed() Logger { return l }

// Debugf .
func (l *NilLogger) Debugf(format string, args ...interface{}) {}

// Errorf .
func (l *NilLogger) Errorf(format string, args ...interface{}) {}

// Infof .
func (l *NilLogger) Infof(format string, args ...interface{}) {}

// Warnf .
func (l *NilLogger) Warnf(format string, args ...interface{}) {}

// TestLogger test logger.
type TestLogger struct {
	testing.TB
	logContext LogContext
}

// With .
func (l *TestLogger) With(logContext LogContext) Logger {
	newl := *l
	if len(newl.logContext) == 0 {
		newl.logContext = map[string]interface{}{}
	}
	for k, v := range logContext {
		newl.logContext[k] = v
	}
	return &newl
}

// Timed .
func (l *TestLogger) Timed() Logger {
	return l.With(LogContext{
		timed: time.Now(),
	})
}

func (l *TestLogger) logf(prefix, format string, args ...interface{}) {
	out := fmt.Sprintf(prefix+": "+format, args...)
	if len(l.logContext) > 0 {
		measure(l.logContext)
		out += fmt.Sprintf(" -- %+v", l.logContext)
	}
	l.TB.Logf(out)
}

func measure(lc LogContext) {
	if lc[timed] == nil {
		return
	}
	started := lc[timed].(time.Time)
	lc[elapsed] = time.Since(started).String()
	delete(lc, timed)
}

// JSON .
func JSON(ref interface{}) string {
	bb, _ := json.MarshalIndent(ref, "", "  ")
	return string(bb)
}

// JSONBlock .
func JSONBlock(ref interface{}) string {
	return fmt.Sprintf("\n```json\n%s\n```\n", JSON(ref))
}

// Debugf .
func (l *TestLogger) Debugf(format string, args ...interface{}) { l.logf("DEBUG", format, args...) }

// Errorf .
func (l *TestLogger) Errorf(format string, args ...interface{}) { l.logf("ERROR", format, args...) }

// Infof .
func (l *TestLogger) Infof(format string, args ...interface{}) { l.logf("INFO", format, args...) }

// Warnf .
func (l *TestLogger) Warnf(format string, args ...interface{}) { l.logf("WARN", format, args...) }
