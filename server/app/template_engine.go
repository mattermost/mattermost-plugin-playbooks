// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Template engine for resolving channel/run name placeholders.
// KEEP IN SYNC with webapp/src/utils/template_utils.ts (same token syntax, system tokens, formatting rules).

package app

import (
	"encoding/json"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

var placeholderRegex = regexp.MustCompile(`\{([^}]+)\}`)

// seqTokenRegex matches {SEQ} case-insensitively with optional surrounding whitespace,
// consistent with the whitespace-trimming behaviour of ResolveTemplate.
var seqTokenRegex = regexp.MustCompile(`(?i)\{\s*SEQ\s*\}`)

// epochMsMin is the minimum epoch-millisecond value (Sep 2001) treated as a date.
// KEEP IN SYNC with EPOCH_MS_MIN in webapp/src/utils/template_utils.ts.
const epochMsMin = 1_000_000_000_000

var (
	collapseOrphanedSeparatorsRe = regexp.MustCompile(`\s*-\s*-\s*`)
	collapseMultiSpaceRe         = regexp.MustCompile(`\s{2,}`)

	fieldRegexCache sync.Map // map[string]*regexp.Regexp, keyed by field name
)

func fieldRegex(fieldName string) *regexp.Regexp {
	if cached, ok := fieldRegexCache.Load(fieldName); ok {
		return cached.(*regexp.Regexp)
	}
	re := regexp.MustCompile(`(?i)\{\s*` + regexp.QuoteMeta(fieldName) + `\s*\}`)
	actual, _ := fieldRegexCache.LoadOrStore(fieldName, re)
	return actual.(*regexp.Regexp)
}

// FormatFunc formats a property field's raw JSON value as a string.
// Returns the formatted string and whether the value is empty; replaces default behavior when set in ResolveOptions.
type FormatFunc func(field *PropertyField, raw json.RawMessage) (string, bool)

// ResolveOptions carries the data needed to resolve a template.
type ResolveOptions struct {
	Fields       []PropertyField
	Values       map[string]json.RawMessage
	SystemTokens map[string]string // Pre-resolved built-in tokens (SEQ, OWNER, CREATOR); take precedence over field names.
	FormatFunc   FormatFunc        // Nil uses DefaultFormatPropertyValue.
}

// systemTokens are the built-in token names always valid in templates (even without property fields).
// These names are reserved as property field names — see validateReservedFieldName.
// SEQ: sequential run number; OWNER: run owner display name; CREATOR: run creator display name.
var systemTokens = []string{"SEQ", "OWNER", "CREATOR"}

// isSystemToken checks if a name matches a built-in system token (case-insensitive).
func isSystemToken(name string) bool {
	for _, tok := range systemTokens {
		if strings.EqualFold(name, tok) {
			return true
		}
	}
	return false
}

// ResolveTemplate substitutes {TokenName} placeholders in a template string.
// System tokens (opts.SystemTokens) are resolved first; unknown tokens are returned in unresolved.
func ResolveTemplate(template string, opts ResolveOptions) (string, []string) {
	if template == "" {
		return "", nil
	}

	formatFn := opts.FormatFunc
	if formatFn == nil {
		formatFn = DefaultFormatPropertyValue
	}

	// Pre-build a case-insensitive index for O(1) field lookups.
	fieldByName := make(map[string]int, len(opts.Fields))
	for i := range opts.Fields {
		fieldByName[strings.ToLower(opts.Fields[i].Name)] = i
	}

	// Pre-build a case-insensitive index for system tokens.
	var sysTokens map[string]string
	if len(opts.SystemTokens) > 0 {
		sysTokens = make(map[string]string, len(opts.SystemTokens))
		for k, v := range opts.SystemTokens {
			sysTokens[strings.ToLower(k)] = v
		}
	}

	var unresolved []string

	result := placeholderRegex.ReplaceAllStringFunc(template, func(match string) string {
		// match is always "{inner}" with at least one character inside the braces
		// (enforced by the regex \{([^}]+)\}), so extract content directly.
		name := strings.TrimSpace(match[1 : len(match)-1])
		nameLower := strings.ToLower(name)

		// System tokens take precedence (case-insensitive lookup).
		if val, ok := sysTokens[nameLower]; ok {
			if val == "" {
				unresolved = append(unresolved, name)
				return match
			}
			return val
		}

		// Look up field by name (case-insensitive)
		if idx, ok := fieldByName[nameLower]; ok {
			if opts.Values == nil {
				unresolved = append(unresolved, name)
				return match
			}
			raw, hasVal := opts.Values[opts.Fields[idx].ID]
			if !hasVal {
				unresolved = append(unresolved, name)
				return match
			}
			formatted, empty := formatFn(&opts.Fields[idx], raw)
			if empty {
				unresolved = append(unresolved, name)
				return match
			}
			return formatted
		}

		unresolved = append(unresolved, name)
		return match
	})

	return result, unresolved
}

// ValidateTemplate checks if all {FieldName} placeholders reference known fields or system tokens.
// Returns unrecognized placeholder names; SEQ/OWNER/CREATOR are always valid.
func ValidateTemplate(template string, opts ResolveOptions) []string {
	_, unresolved := ResolveTemplate(template, ResolveOptions{Fields: opts.Fields})

	knownNames := make(map[string]struct{}, len(opts.Fields))
	for _, f := range opts.Fields {
		knownNames[strings.ToLower(f.Name)] = struct{}{}
	}

	var unknown []string
	for _, name := range unresolved {
		if isSystemToken(name) {
			continue
		}
		if _, ok := knownNames[strings.ToLower(name)]; !ok {
			unknown = append(unknown, name)
		}
	}
	return unknown
}

// TemplateUsesSeqToken reports whether a template contains a {SEQ} placeholder
// (case-insensitive, matching the resolution behaviour of ResolveTemplate).
func TemplateUsesSeqToken(tmpl string) bool {
	return seqTokenRegex.MatchString(tmpl)
}

// StripFieldFromTemplate removes all occurrences of {fieldName} from a template string
// and cleans up orphaned separators and whitespace.
func StripFieldFromTemplate(tmpl, fieldName string) string {
	if tmpl == "" {
		return ""
	}
	re := fieldRegex(fieldName)
	result := re.ReplaceAllString(tmpl, "")
	result = collapseOrphanedSeparatorsRe.ReplaceAllString(result, " - ")
	result = collapseMultiSpaceRe.ReplaceAllString(result, " ")
	result = strings.TrimSpace(result)
	result = strings.TrimPrefix(result, "- ")
	result = strings.TrimPrefix(result, "-")
	result = strings.TrimSuffix(result, " -")
	result = strings.TrimSuffix(result, "-")
	result = strings.TrimSpace(result)
	return result
}

// ReplaceFieldInTemplate replaces all occurrences of {oldName} with {newName} in a template string (case-insensitive).
func ReplaceFieldInTemplate(tmpl, oldName, newName string) string {
	if tmpl == "" {
		return ""
	}
	re := fieldRegex(oldName)
	// Use ReplaceAllLiteralString so that $ and \ characters in newName are treated as literals,
	// not as regex replacement references.
	return re.ReplaceAllLiteralString(tmpl, "{"+newName+"}")
}

// DefaultFormatPropertyValue formats a property field's raw JSON value as a human-readable string.
// Returns ("", true) for null/empty values; no truncation is applied.
func DefaultFormatPropertyValue(field *PropertyField, raw json.RawMessage) (string, bool) {
	if field == nil {
		return "", true
	}
	if len(raw) == 0 || string(raw) == "null" || string(raw) == `""` {
		return "", true
	}

	switch field.Type {
	case model.PropertyFieldTypeText:
		var stringValue string
		if err := json.Unmarshal(raw, &stringValue); err != nil {
			return string(raw), false
		}
		if stringValue == "" {
			return "", true
		}
		return stringValue, false

	case model.PropertyFieldTypeSelect:
		var stringValue string
		if err := json.Unmarshal(raw, &stringValue); err != nil {
			return string(raw), false
		}
		if stringValue == "" {
			return "", true
		}
		for _, option := range field.Attrs.Options {
			if option == nil {
				continue
			}
			if option.GetID() == stringValue {
				return option.GetName(), false
			}
		}
		return stringValue, false

	case model.PropertyFieldTypeMultiselect:
		var arrayValue []string
		if err := json.Unmarshal(raw, &arrayValue); err != nil {
			return string(raw), false
		}
		if len(arrayValue) == 0 {
			return "", true
		}
		var labels []string
		for _, val := range arrayValue {
			label := val
			for _, option := range field.Attrs.Options {
				if option == nil {
					continue
				}
				if option.GetID() == val {
					label = option.GetName()
					break
				}
			}
			labels = append(labels, label)
		}
		return strings.Join(labels, ", "), false

	case model.PropertyFieldTypeDate:
		// First try unmarshaling as a number (JSON numeric date stored as millis)
		var numValue float64
		if json.Unmarshal(raw, &numValue) == nil && numValue > epochMsMin {
			return time.UnixMilli(int64(numValue)).UTC().Format("2006-01-02"), false
		}
		var stringValue string
		if err := json.Unmarshal(raw, &stringValue); err != nil {
			return string(raw), false
		}
		if t, err := time.Parse(time.RFC3339, stringValue); err == nil {
			return t.Format("2006-01-02"), false
		}
		if t, err := time.Parse("2006-01-02", stringValue); err == nil {
			return t.Format("2006-01-02"), false
		}
		// Numeric-string millisecond timestamp
		if ms, err := strconv.ParseInt(stringValue, 10, 64); err == nil && ms > 0 {
			return time.UnixMilli(ms).UTC().Format("2006-01-02"), false
		}
		return stringValue, false

	// User/multiuser fields return raw IDs; pass a FormatFunc to ResolveTemplate to get display names.
	case model.PropertyFieldTypeUser:
		var stringValue string
		if err := json.Unmarshal(raw, &stringValue); err != nil {
			return string(raw), false
		}
		if stringValue == "" {
			return "", true
		}
		return stringValue, false

	case model.PropertyFieldTypeMultiuser:
		var arrayValue []string
		if err := json.Unmarshal(raw, &arrayValue); err != nil {
			return string(raw), false
		}
		if len(arrayValue) == 0 {
			return "", true
		}
		return strings.Join(arrayValue, ", "), false

	default:
		var stringValue string
		if err := json.Unmarshal(raw, &stringValue); err != nil {
			return string(raw), false
		}
		if stringValue == "" {
			return "", true
		}
		return stringValue, false
	}
}
