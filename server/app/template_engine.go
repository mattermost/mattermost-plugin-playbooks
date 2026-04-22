// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

var placeholderRegex = regexp.MustCompile(`\{([^}]+)\}`)

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

// FormatFunc is a function that formats a property field's raw JSON value as a string.
// It replaces the default formatting behavior when provided in ResolveOptions.
// Returns the formatted string and whether the value is empty.
type FormatFunc func(field *PropertyField, raw json.RawMessage) (string, bool)

// ResolveOptions carries the data needed to resolve a template.
type ResolveOptions struct {
	Fields       []PropertyField
	Values       map[string]json.RawMessage
	SystemTokens map[string]string // Pre-resolved built-in tokens (OWNER, CREATOR); take precedence over field names.
	FormatFunc   FormatFunc        // Nil uses DefaultFormatPropertyValue.
}

// systemTokenNames are built-in token names recognized by ValidateTemplate.
// These are always valid in templates, even when no fields are provided.
var systemTokenNames = []string{"OWNER", "CREATOR"}

// isSystemToken checks if a name matches a built-in system token (case-insensitive).
func isSystemToken(name string) bool {
	for _, tok := range systemTokenNames {
		if strings.EqualFold(name, tok) {
			return true
		}
	}
	return false
}

// ResolveTemplate resolves a template string by substituting {TokenName} placeholders.
// System tokens from opts.SystemTokens are resolved first (case-insensitive match),
// then property field values are looked up. FormatFunc (if provided) is used for
// property values only — system tokens bypass it.
// Returns the resolved string and a list of placeholder names that could not be resolved.
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

		// Unknown field — but if it matches a system token name that wasn't
		// in SystemTokens map, it's still unresolved (not an error in validate).
		unresolved = append(unresolved, name)
		return match
	})

	return result, unresolved
}

// ValidateTemplate checks if all {FieldName} placeholders in a template reference known
// fields or system tokens. Returns the list of unrecognized placeholder names.
// System tokens (OWNER, CREATOR) are always recognized as valid.
func ValidateTemplate(template string, opts ResolveOptions) []string {
	if template == "" {
		return nil
	}

	// Pre-build a case-insensitive set for O(1) field lookups.
	fieldNames := make(map[string]struct{}, len(opts.Fields))
	for i := range opts.Fields {
		fieldNames[strings.ToLower(opts.Fields[i].Name)] = struct{}{}
	}

	var unknown []string
	matches := placeholderRegex.FindAllStringSubmatch(template, -1)
	for _, match := range matches {
		name := strings.TrimSpace(match[1])
		if isSystemToken(name) {
			continue
		}
		if _, ok := fieldNames[strings.ToLower(name)]; !ok {
			unknown = append(unknown, name)
		}
	}
	return unknown
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
	result = strings.TrimSuffix(result, " -")
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
// Returns ("", true) for null/empty values. No truncation.
// Exported for testing and for callers that need the default behavior.
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
		var stringValue string
		if err := json.Unmarshal(raw, &stringValue); err != nil {
			return string(raw), false
		}
		t, err := time.Parse(time.RFC3339, stringValue)
		if err != nil {
			t, err = time.Parse("2006-01-02", stringValue)
		}
		if err != nil {
			return stringValue, false
		}
		return t.Format("2006-01-02"), false

	// NOTE: user and multiuser fields return raw Mattermost user IDs here.
	// To resolve IDs to display names, pass a FormatFunc to ResolveTemplate
	// (see makeRunNameFormatFunc in playbook_run_service.go).
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
