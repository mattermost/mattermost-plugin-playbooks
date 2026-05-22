// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package tools

import "testing"

func TestNewPlaybooksToolProviderRejectsNilClientFactory(t *testing.T) {
	provider, err := NewPlaybooksToolProvider(nil)
	if err == nil || err.Error() != "clientFactory cannot be nil" {
		t.Fatalf("expected client factory validation error, got provider=%v err=%v", provider, err)
	}
	if provider != nil {
		t.Fatalf("expected nil provider, got %v", provider)
	}
}
