package app

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGeneratePlaybookExport(t *testing.T) {
	pb := Playbook{
		Title:    "Testing",
		CreateAt: 23423234,
		Checklists: []Checklist{
			{
				Title: "checklist 1",
				Items: []ChecklistItem{
					{
						Title:       "This is an item",
						Description: "It's an item",
					},
				},
			},
		},
	}
	output, err := GeneratePlaybookExport(pb)
	require.NoError(t, err)

	result := Playbook{}
	err = json.Unmarshal(output, &result)
	require.NoError(t, err)

	// Should copy the specified stuff
	assert.Equal(t, result.Title, pb.Title)

	// Shouldn't copy the not specificed stuff
	assert.Equal(t, result.CreateAt, int64(0))
}

func definesExports(t *testing.T, thing interface{}) {
	inType := reflect.TypeOf(thing)
	for i := 0; i < inType.NumField(); i++ {
		field := inType.Field(i)
		tag := strings.TrimSpace(field.Tag.Get("export"))
		if tag == "" {
			t.Errorf("%s struct does not define export for field %s. Please define this struct tag, see comment above playbook struct.", inType.Name(), field.Name)
		}
	}
}

func TestPlaybookDefinesExports(t *testing.T) {
	definesExports(t, Playbook{})
	definesExports(t, Checklist{})
	definesExports(t, ChecklistItem{})
}
