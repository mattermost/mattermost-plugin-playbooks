// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import "github.com/pkg/errors"

// FontPack carries the byte slices for every embedded font face the renderer
// needs. Loaded once at startup via loadEmbeddedFonts; cheap to copy.
//
// Phase A2 (this Story) wires up Noto Sans (Regular / Bold / Italic /
// BoldItalic) and Noto Sans Mono (Regular). The .ttf files land under
// assets/fonts/ alongside an OFL.txt license file; embedding is done via
// //go:embed. The file bytes are not loaded here yet — the embed-directive
// land in this file when the .ttf bytes are added to the repo.
//
// See plan §3.8 + §6.1 A2.
type FontPack struct {
	NotoSansRegular    []byte
	NotoSansBold       []byte
	NotoSansItalic     []byte
	NotoSansBoldItalic []byte
	NotoSansMono       []byte
}

// loadEmbeddedFonts returns the FontPack with all faces populated.
//
// During MM-68720 / Phase A1 this returns an empty pack — the .ttf bytes
// are added in Phase A2. Callers MUST tolerate empty fields for now; the
// renderer's RenderRun / RenderPlaybook return ErrNotImplemented anyway.
func loadEmbeddedFonts() (FontPack, error) {
	// TODO(Phase A2): replace with //go:embed assets/fonts/<face>.ttf
	// and read the bytes from the embedded FS.
	pack := FontPack{}
	if err := validateFontPack(pack); err != nil {
		// During Phase A1 the empty pack is acceptable; validation is a
		// no-op at this stage. Phase A2 will gate on this returning nil.
		_ = err
	}
	return pack, nil
}

// validateFontPack asserts that every face is non-empty.
//
// Phase A2 will make this strict; Phase A1 keeps it permissive while the
// .ttf bytes are not yet committed.
func validateFontPack(pack FontPack) error {
	// Sentinel to surface missing-font situations once Phase A2 enforces.
	if len(pack.NotoSansRegular) == 0 ||
		len(pack.NotoSansBold) == 0 ||
		len(pack.NotoSansItalic) == 0 ||
		len(pack.NotoSansBoldItalic) == 0 ||
		len(pack.NotoSansMono) == 0 {
		return errors.New("embedded font pack incomplete")
	}
	return nil
}
