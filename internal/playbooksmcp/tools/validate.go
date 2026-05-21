package tools

import "fmt"

// validateID checks that an ID matches the Mattermost 26-char alphanumeric format.
func validateID(id, name string) error {
	if id == "" {
		return fmt.Errorf("%s is required", name)
	}
	if len(id) != 26 {
		return fmt.Errorf("%s must be exactly 26 characters, got %d", name, len(id))
	}
	for _, c := range id {
		if (c < 'a' || c > 'z') && (c < '0' || c > '9') {
			return fmt.Errorf("%s contains invalid characters (expected lowercase alphanumeric)", name)
		}
	}
	return nil
}

// validateIndex checks that an index is non-negative.
func validateIndex(val int, name string) error {
	if val < 0 {
		return fmt.Errorf("%s must be a non-negative integer, got %d", name, val)
	}
	return nil
}
