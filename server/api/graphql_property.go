// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

type PropertyOptionInput struct {
	ID    *string `json:"id"`
	Name  string  `json:"name"`
	Color *string `json:"color"`
}

type PropertyFieldAttrsInput struct {
	Visibility *string                `json:"visibility"`
	SortOrder  *float64               `json:"sortOrder"`
	Options    *[]PropertyOptionInput `json:"options"`
	ParentID   *string                `json:"parentID"`
}

type PropertyFieldInput struct {
	Name  string                   `json:"name"`
	Type  string                   `json:"type"`
	Attrs *PropertyFieldAttrsInput `json:"attrs"`
}
