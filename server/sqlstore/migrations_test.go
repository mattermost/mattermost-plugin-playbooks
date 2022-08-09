package sqlstore

import (
	"fmt"
	"testing"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/require"
)

func TestMigration_000005(t *testing.T) {
	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		_, store := setupTables(t, db)
		engine, err := store.createMorphEngine()
		require.NoError(t, err)
		defer engine.Close()

		t.Run(fmt.Sprintf("test migration up %s", driverName), func(t *testing.T) {
			engine.Apply(4)
			_, err = insertRun(store, "0", "{][", 0) // invalid json
			_, err = insertRun(store, "1", "{}", 0)
			_, err = insertRun(store, "2", "\"key\"", 0)
			_, err = insertRun(store, "3", "[]", 0)
			_, err = insertRun(store, "5", `[{"title":"title50"}, {"title":"title51"}, {"title":"title52"}]`, 1)
			_, err = insertRun(store, "6", `[{"title":"title60"}, {"title":"title61"}, {"title":"title62"}]`, 3)
			_, err = insertRun(store, "7", `[{"title":"title70"}, {"title":"title71"}, {"title":"title72"}]`, 2)

			var numRuns int64
			err = db.Get(&numRuns, "SELECT COUNT(*) FROM IR_Incident")

			engine.Apply(1)

			type Run struct {
				ID               string
				Name             string
				ChecklistsJSON   string
				ActiveStage      int
				ActiveStageTitle string
			}

			var runs []Run
			err = store.selectBuilder(store.db, &runs, store.builder.
				Select("ID", "Name", "ChecklistsJSON", "ActiveStage", "ActiveStageTitle").
				From("IR_Incident"))

			require.NoError(t, err)
			require.Len(t, runs, int(numRuns))
			runNameToActiveStageTitle := map[string]string{
				"5": "title51",
				"7": "title72",
			}
			for _, r := range runs {
				require.Equal(t, runNameToActiveStageTitle[r.Name], r.ActiveStageTitle)
			}
			engine.ApplyDown(1)
			engine.Apply(1)
		})
	}
}

func insertRun(sqlStore *SQLStore, name, checklistJSON string, activeStage int) (string, error) {
	id := model.NewId()
	_, err := sqlStore.execBuilder(sqlStore.db, sq.
		Insert("IR_Incident").
		SetMap(map[string]interface{}{
			"ID":       id,
			"CreateAt": model.GetMillis(),
			// have to be set:
			"Name":            name,
			"Description":     "test",
			"IsActive":        true,
			"CommanderUserID": "commander",
			"TeamID":          "testTeam",
			"ChannelID":       model.NewId(),
			"ActiveStage":     activeStage,
			"ChecklistsJSON":  checklistJSON,
		}))

	return id, err
}
