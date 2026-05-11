// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package coretypes carries the small set of DTOs that both server/report
// and server/report/markdown reference. Hosting them here avoids an import
// cycle between the renderer (which consumes the markdown extension) and
// the markdown extension (which consumes the resolver table).
//
// server/report re-exports each type via a type alias so existing callers
// continue to write report.RenderUser, report.ResolverTable, etc.
package coretypes

// RenderUser carries only the display fields the PDF renderer needs —
// never emails, never auth fields, never anything raw from model.User.
type RenderUser struct {
	UserID      string
	DisplayName string
	Username    string
}

// RenderChannel carries only display information for a channel.
type RenderChannel struct {
	ChannelID   string
	Name        string
	DisplayName string
	Type        string
}

// RenderFile is a sanitized reference to a file attachment.
type RenderFile struct {
	FileID string
	Name   string
	Size   int64
	Kind   string
}

// RenderPostPreview is a permalink-to-post preview card. Populated only in
// the MM-68723 / v1.1 enriched markdown story; zero-value in v1.
type RenderPostPreview struct {
	PostID   string
	Author   RenderUser
	Channel  RenderChannel
	CreateAt int64
	Excerpt  string
}

// ResolverTable is the pre-built lookup the markdown extension consumes.
// All map values are zero-initialized when the requester cannot see the
// target (deny path byte-identical to "not found").
type ResolverTable struct {
	Users      map[string]RenderUser
	Channels   map[string]RenderChannel
	Files      map[string]RenderFile
	Permalinks map[string]RenderPostPreview
}
