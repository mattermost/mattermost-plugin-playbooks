// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import (
	"github.com/johnfercher/maroto/v2/pkg/consts/align"
	"github.com/johnfercher/maroto/v2/pkg/consts/fontfamily"
	"github.com/johnfercher/maroto/v2/pkg/consts/fontstyle"
	"github.com/johnfercher/maroto/v2/pkg/props"
)

// fontFamilySans / fontFamilyMono are the custom-font family identifiers
// emitted alongside the embedded Noto faces. When the font pack is empty
// (Phase A1), the renderer falls back to bundled Helvetica / Courier — see
// styleSet.
const (
	fontFamilySans = "noto-sans"
	fontFamilyMono = "noto-sans-mono"

	fontSizeTitle    = 22.0
	fontSizeHeading1 = 16.0
	fontSizeHeading2 = 13.0
	fontSizeHeading3 = 11.0
	fontSizeBody     = 10.0
	fontSizeSmall    = 8.5
	fontSizeFooter   = 8.0

	rowHeightHeader    = 12.0
	rowHeightFooter    = 8.0
	rowHeightSection   = 10.0
	rowHeightLine      = 6.0
	rowHeightBlockGap  = 3.0
	rowHeightSeparator = 1.0
)

// mattermostBrand is the brand accent color (#1c58d9).
var mattermostBrand = props.Color{Red: 28, Green: 88, Blue: 217}

var inkPrimary = props.Color{Red: 32, Green: 32, Blue: 38}
var inkMuted = props.Color{Red: 110, Green: 110, Blue: 120}
var inkSubtle = props.Color{Red: 180, Green: 180, Blue: 190}

func brand() *props.Color   { c := mattermostBrand; return &c }
func primary() *props.Color { c := inkPrimary; return &c }
func muted() *props.Color   { c := inkMuted; return &c }
func subtle() *props.Color  { c := inkSubtle; return &c }

// styleSet carries the resolved font families for one render. Built per
// request from the FontPack — falls back to maroto's bundled families when
// the pack is empty (Phase A1).
type styleSet struct {
	sans string
	mono string
}

// newStyleSet returns a styleSet resolved against the available custom fonts.
func newStyleSet(hasCustomSans, hasCustomMono bool) styleSet {
	s := styleSet{sans: fontfamily.Helvetica, mono: fontfamily.Courier}
	if hasCustomSans {
		s.sans = fontFamilySans
	}
	if hasCustomMono {
		s.mono = fontFamilyMono
	}
	return s
}

func (s styleSet) title() props.Text {
	return props.Text{Family: s.sans, Style: fontstyle.Bold, Size: fontSizeTitle, Align: align.Left, Color: brand()}
}

func (s styleSet) heading1() props.Text {
	return props.Text{Family: s.sans, Style: fontstyle.Bold, Size: fontSizeHeading1, Align: align.Left, Color: primary(), Top: 2.0}
}

func (s styleSet) heading2() props.Text {
	return props.Text{Family: s.sans, Style: fontstyle.Bold, Size: fontSizeHeading2, Align: align.Left, Color: primary(), Top: 1.5}
}

func (s styleSet) heading3() props.Text {
	return props.Text{Family: s.sans, Style: fontstyle.Bold, Size: fontSizeHeading3, Align: align.Left, Color: primary()}
}

func (s styleSet) body() props.Text {
	return props.Text{Family: s.sans, Style: fontstyle.Normal, Size: fontSizeBody, Align: align.Left, Color: primary()}
}

func (s styleSet) bodyBold() props.Text {
	t := s.body()
	t.Style = fontstyle.Bold
	return t
}

func (s styleSet) label() props.Text {
	return props.Text{Family: s.sans, Style: fontstyle.Bold, Size: fontSizeSmall, Align: align.Left, Color: muted()}
}

func (s styleSet) meta() props.Text {
	return props.Text{Family: s.sans, Style: fontstyle.Normal, Size: fontSizeSmall, Align: align.Left, Color: muted()}
}

func (s styleSet) code() props.Text {
	return props.Text{Family: s.mono, Style: fontstyle.Normal, Size: fontSizeSmall, Align: align.Left, Color: primary()}
}

func (s styleSet) headerTitle() props.Text {
	t := s.heading2()
	t.Color = brand()
	return t
}
