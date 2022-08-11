package sqlstore

import (
	"fmt"
	"testing"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/morph"
	"github.com/stretchr/testify/require"
)

func TestCompareMorphToLegacy(t *testing.T) {
	migrationsMapping := []struct {
		Name                 string
		LegacyMigrationIndex int
		MorphMigrationLimit  int
	}{
		{
			Name:                 "0.1.0",
			LegacyMigrationIndex: 0,
			MorphMigrationLimit:  4,
		},
		{
			Name:                 "0.3.0",
			LegacyMigrationIndex: 2,
			MorphMigrationLimit:  1,
		},
		{
			Name:                 "0.4.0",
			LegacyMigrationIndex: 3,
			MorphMigrationLimit:  4,
		},
	}

	for _, driverName := range driverNames {
		// create database for morph migration
		dbMorph := setupTestDB(t, driverName)
		_, storeMorph := setupTables(t, dbMorph)

		// create database for legacy migration
		dbLegacy := setupTestDB(t, driverName)
		_, storeLegacy := setupTables(t, dbLegacy)

		engine, err := storeMorph.createMorphEngine()
		require.NoError(t, err)
		defer engine.Close()

		for _, migration := range migrationsMapping {
			t.Run(fmt.Sprintf("check database schema: %s", migration.Name), func(t *testing.T) {
				runMigrationUp(t, storeMorph, engine, migration.MorphMigrationLimit)
				runLegacyMigration(t, storeLegacy, migration.LegacyMigrationIndex)

				// compare table schemas
				dbSchemaMorph, err := getDBSchemaInfo(storeMorph)
				require.NoError(t, err)
				dbSchemaLegacy, err := getDBSchemaInfo(storeLegacy)
				require.NoError(t, err)
				require.Equal(t, dbSchemaMorph, dbSchemaLegacy)

				// compare indexes
				dbIndexesMorph, err := getDBIndexesInfo(storeMorph)
				require.NoError(t, err)
				dbIndexesLegacy, err := getDBIndexesInfo(storeLegacy)
				require.NoError(t, err)
				require.Equal(t, dbIndexesMorph, dbIndexesLegacy)
			})
		}
	}
}

func TestMigration_000005(t *testing.T) {
	testData := []struct {
		Name          string
		ActiveStage   int
		ChecklistJSON string
	}{
		{
			Name:          "0",
			ActiveStage:   0,
			ChecklistJSON: "{][",
		},
		{
			Name:          "1",
			ActiveStage:   0,
			ChecklistJSON: "{}",
		},
		{
			Name:          "2",
			ActiveStage:   0,
			ChecklistJSON: "\"key\"",
		},
		{
			Name:          "3",
			ActiveStage:   -1,
			ChecklistJSON: "[]",
		},
		{
			Name:          "4",
			ActiveStage:   0,
			ChecklistJSON: "",
		},
		{
			Name:          "5",
			ActiveStage:   1,
			ChecklistJSON: `[{"title":"title50"}, {"title":"title51"}, {"title":"title52"}]`,
		},
		{
			Name:          "6",
			ActiveStage:   3,
			ChecklistJSON: `[{"title":"title60"}, {"title":"title61"}, {"title":"title62"}]`,
		},
		{
			Name:          "7",
			ActiveStage:   2,
			ChecklistJSON: `[{"title":"title70"}, {"title":"title71"}, {"title":"title72"}]`,
		},
	}

	insertData := func(store *SQLStore) int {
		numRuns := 0
		for _, d := range testData {
			_, err := insertRun(store, NewRunMapBuilder().
				WithName(d.Name).
				WithActiveStage(d.ActiveStage).
				WithChecklists(d.ChecklistJSON).ToRunAsMap())
			if err == nil {
				numRuns++
			}
		}

		return numRuns
	}

	type Run struct {
		ID               string
		Name             string
		ChecklistsJSON   string
		ActiveStage      int
		ActiveStageTitle string
	}

	validateAfter := func(t *testing.T, store *SQLStore, numRuns int) {
		var runs []Run
		err := store.selectBuilder(store.db, &runs, store.builder.
			Select("ID", "Name", "ChecklistsJSON", "ActiveStage", "ActiveStageTitle").
			From("IR_Incident"))

		require.NoError(t, err)
		require.Len(t, runs, numRuns)
		expectedStageTitles := map[string]string{
			"5": "title51",
			"7": "title72",
		}
		for _, r := range runs {
			require.Equal(t, expectedStageTitles[r.Name], r.ActiveStageTitle)
		}
	}

	validateBefore := func(t *testing.T, store *SQLStore, numRuns int) {
		activeStageTitleExist, err := columnExists(store, "IR_Incident", "ActiveStageTitle")
		require.NoError(t, err)
		require.False(t, activeStageTitleExist)
	}

	for _, driverName := range driverNames {
		t.Run("run migration up", func(t *testing.T) {
			db := setupTestDB(t, driverName)
			_, store := setupTables(t, db)
			engine, err := store.createMorphEngine()
			require.NoError(t, err)
			defer engine.Close()

			runMigrationUp(t, store, engine, 4)
			numRuns := insertData(store)
			runMigrationUp(t, store, engine, 1)
			validateAfter(t, store, numRuns)
		})

		t.Run("run migration down", func(t *testing.T) {
			db := setupTestDB(t, driverName)
			_, store := setupTables(t, db)
			engine, err := store.createMorphEngine()
			require.NoError(t, err)
			defer engine.Close()

			runMigrationUp(t, store, engine, 4)
			numRuns := insertData(store)
			runMigrationUp(t, store, engine, 1)
			validateAfter(t, store, numRuns)
			runMigrationDown(t, store, engine, 1)
			validateBefore(t, store, numRuns)
		})
	}
}

func runMigrationUp(t *testing.T, store *SQLStore, engine *morph.Morph, limit int) {
	applied, err := engine.Apply(limit)
	require.NoError(t, err)
	require.Equal(t, applied, limit)
}

func runMigrationDown(t *testing.T, store *SQLStore, engine *morph.Morph, limit int) {
	applied, err := engine.ApplyDown(limit)
	require.NoError(t, err)
	require.Equal(t, applied, limit)
}

func runLegacyMigration(t *testing.T, store *SQLStore, index int) {
	err := store.migrate(migrations[index])
	require.NoError(t, err)
}

func insertRun(sqlStore *SQLStore, run map[string]interface{}) (string, error) {
	id := model.NewId()
	_, err := sqlStore.execBuilder(sqlStore.db, sq.
		Insert("IR_Incident").
		SetMap(run))

	return id, err
}

type RunMapBuilder struct {
	runAsMap map[string]interface{}
}

func NewRunMapBuilder() *RunMapBuilder {
	return &RunMapBuilder{
		runAsMap: map[string]interface{}{
			"ID":              model.NewId(),
			"CreateAt":        model.GetMillis(),
			"Description":     "test description",
			"Name":            fmt.Sprintf("run- %v", model.GetMillis()),
			"IsActive":        true,
			"CommanderUserID": "commander",
			"TeamID":          "testTeam",
			"ChannelID":       model.NewId(),
		},
	}
}

func (b *RunMapBuilder) WithName(name string) *RunMapBuilder {
	b.runAsMap["Name"] = name
	return b
}

func (b *RunMapBuilder) WithActiveStage(activeStage int) *RunMapBuilder {
	b.runAsMap["ActiveStage"] = activeStage
	return b
}

func (b *RunMapBuilder) WithChecklists(checklistJSON string) *RunMapBuilder {
	b.runAsMap["ChecklistsJSON"] = checklistJSON
	return b
}

func (b *RunMapBuilder) ToRunAsMap() map[string]interface{} {
	return b.runAsMap
}
