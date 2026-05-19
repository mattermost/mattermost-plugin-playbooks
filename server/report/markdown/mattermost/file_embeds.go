// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mattermost

// FileEmbed is a sanitized reference to a file attached to a post.
//
// File embeds are NOT a goldmark inline token because file IDs live on the
// post metadata, not in the message body. The render package surfaces this
// type so downstream PDF sections (run transcript, status updates) can
// receive a uniform sequence of instructions that includes file chips
// alongside parsed body content.
type FileEmbed struct {
	// FileID is the canonical Mattermost file identifier (display only —
	// the renderer never fetches the binary).
	FileID string

	// Name is the user-facing filename as shown in the UI.
	Name string

	// Size is the file size in bytes.
	Size int64

	// Kind is the coarse classification used to choose an icon:
	// "image" | "doc" | "audio" | "video" | "other".
	Kind string
}
