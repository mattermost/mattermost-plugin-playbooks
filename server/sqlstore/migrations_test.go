package sqlstore

import (
	"fmt"
	"testing"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/morph"
	"github.com/stretchr/testify/require"
)

type MigrationMapping struct {
	Name                 string
	LegacyMigrationIndex int
	MorphMigrationLimit  int
}

func TestDBSchema(t *testing.T) {
	migrationsMapping := []MigrationMapping{
		{
			Name:                 "0.0.0 > 0.0.1",
			LegacyMigrationIndex: 0,
			MorphMigrationLimit:  4, // 000001 <> 000004
		},
		{
			Name:                 "0.2.0 > 0.3.0",
			LegacyMigrationIndex: 2,
			MorphMigrationLimit:  1, // 000005
		},
		{
			Name:                 "0.3.0 > 0.4.0",
			LegacyMigrationIndex: 3,
			MorphMigrationLimit:  4, // 000006 <> 000009
		},
		{
			Name:                 "0.4.0 > 0.5.0",
			LegacyMigrationIndex: 4,
			MorphMigrationLimit:  4, // 000010 <> 000013
		},
		{
			Name:                 "0.5.0 > 0.6.0",
			LegacyMigrationIndex: 5,
			MorphMigrationLimit:  2, // 000014 <> 000015
		},
		{
			Name:                 "0.6.0 > 0.7.0",
			LegacyMigrationIndex: 6,
			MorphMigrationLimit:  1, // 000016
		},
		{
			Name:                 "0.7.0 > 0.8.0",
			LegacyMigrationIndex: 7,
			MorphMigrationLimit:  1, // 000017
		},
		{
			Name:                 "0.8.0 > 0.9.0",
			LegacyMigrationIndex: 8,
			MorphMigrationLimit:  3, // 000018 <> 000020
		},
		{
			Name:                 "0.9.0 > 0.10.0",
			LegacyMigrationIndex: 9,
			MorphMigrationLimit:  3, // 000021 <> 000023
		},
		{
			Name:                 "0.11.0 > 0.12.0",
			LegacyMigrationIndex: 11,
			MorphMigrationLimit:  4, // 000024 <> 000027
		},
		{
			Name:                 "0.12.0 > 0.13.0",
			LegacyMigrationIndex: 12,
			MorphMigrationLimit:  3, // 000028 <> 000030
		},

		{
			Name:                 "0.13.0 > 0.14.0",
			LegacyMigrationIndex: 13,
			MorphMigrationLimit:  2, // 000031 <> 000032
		},
		{
			Name:                 "0.14.0 > 0.15.0",
			LegacyMigrationIndex: 14,
			MorphMigrationLimit:  1, // 000033
		},
		{
			Name:                 "0.15.0 > 0.16.0",
			LegacyMigrationIndex: 15,
			MorphMigrationLimit:  4, // 000034-000037
		},
		{
			Name:                 "0.16.0 > 0.17.0",
			LegacyMigrationIndex: 16,
			MorphMigrationLimit:  1, // 000038
		},
		{
			Name:                 "0.17.0 > 0.18.0",
			LegacyMigrationIndex: 17,
			MorphMigrationLimit:  3, // 000039-000041
		},
		{
			Name:                 "0.18.0 > 0.19.0",
			LegacyMigrationIndex: 18,
			MorphMigrationLimit:  1, // 000042
		},
		{
			Name:                 "0.19.0 > 0.20.0",
			LegacyMigrationIndex: 19,
			MorphMigrationLimit:  3, // 000043-00045
		},
		{
			Name:                 "0.20.0 > 0.21.0",
			LegacyMigrationIndex: 20,
			MorphMigrationLimit:  3, // 000046-00048
		},
		{
			Name:                 "0.21.0 > 0.22.0",
			LegacyMigrationIndex: 21,
			MorphMigrationLimit:  1, // 000049
		},
		{
			Name:                 "0.22.0 > 0.23.0",
			LegacyMigrationIndex: 22,
			MorphMigrationLimit:  2, // 000050-000051
		},
		{
			Name:                 "0.23.0 > 0.24.0",
			LegacyMigrationIndex: 23,
			MorphMigrationLimit:  2, // 000052-000053
		},
		{
			Name:                 "0.24.0 > 0.25.0",
			LegacyMigrationIndex: 24,
			MorphMigrationLimit:  4, // 000054-000057
		},
		{
			Name:                 "0.25.0 > 0.26.0",
			LegacyMigrationIndex: 25,
			MorphMigrationLimit:  2, // 000058-000059
		},
	}

	for _, driverName := range driverNames {
		tableInfoList := tableInfoAfterEachLegacyMigration(t, driverName, migrationsMapping)
		indexInfoList := indexInfoAfterEachLegacyMigration(t, driverName, migrationsMapping)

		// create database for morph migration
		db := setupTestDB(t, driverName)
		store := setupTables(t, db)

		engine, err := store.createMorphEngine()
		require.NoError(t, err)
		defer engine.Close()

		for i, migration := range migrationsMapping {
			t.Run(fmt.Sprintf("validate migration up: %s", migration.Name), func(t *testing.T) {
				runMigrationUp(t, store, engine, migration.MorphMigrationLimit)
				// compare table schemas
				dbSchemaMorph, err := getDBSchemaInfo(store)
				require.NoError(t, err)
				// this way it's easier to find out why test fails
				for j := range dbSchemaMorph {
					require.Equal(t, dbSchemaMorph[j], tableInfoList[i+1][j])
				}

				// compare indexes
				dbIndexesMorph, err := getDBIndexesInfo(store)
				require.NoError(t, err)
				require.Equal(t, dbIndexesMorph, indexInfoList[i+1])
			})
		}

		for i := range migrationsMapping {
			migrationIndex := len(migrationsMapping) - i - 1
			migration := migrationsMapping[migrationIndex]
			t.Run(fmt.Sprintf("validate migration down: %s", migration.Name), func(t *testing.T) {
				runMigrationDown(t, store, engine, migration.MorphMigrationLimit)
				// compare table schemas
				dbSchemaMorph, err := getDBSchemaInfo(store)
				require.NoError(t, err)
				require.Equal(t, dbSchemaMorph, tableInfoList[migrationIndex])

				// compare indexes
				dbIndexesMorph, err := getDBIndexesInfo(store)
				require.NoError(t, err)
				require.Equal(t, dbIndexesMorph, indexInfoList[migrationIndex])
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
			err := InsertRun(store, NewRunMapBuilder().
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
			store := setupTables(t, db)
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
			store := setupTables(t, db)
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

func TestMigration_000014(t *testing.T) {
	insertData := func(t *testing.T, store *SQLStore) {
		err := InsertRun(store, NewRunMapBuilder().WithName("0").ToRunAsMap())
		require.NoError(t, err)
		err = InsertRun(store, NewRunMapBuilder().WithName("1").WithEndAt(100000000000).ToRunAsMap())
		require.NoError(t, err)
		err = InsertRun(store, NewRunMapBuilder().WithName("2").WithEndAt(0).ToRunAsMap())
		require.NoError(t, err)
		err = InsertRun(store, NewRunMapBuilder().WithName("3").WithEndAt(123861298332).ToRunAsMap())
		require.NoError(t, err)
	}

	type Run struct {
		Name          string
		CurrentStatus string
		EndAt         int64
	}

	validateAfter := func(t *testing.T, store *SQLStore) {
		var runs []Run
		err := store.selectBuilder(store.db, &runs, store.builder.
			Select("Name", "CurrentStatus", "EndAt").
			From("IR_Incident"))

		require.NoError(t, err)
		require.Len(t, runs, 4)

		runsStatuses := map[string]string{
			"0": "Active",
			"2": "Active",
			"1": "Resolved",
			"3": "Resolved",
		}
		for _, r := range runs {
			require.Equal(t, runsStatuses[r.Name], r.CurrentStatus)
		}
	}

	for _, driverName := range driverNames {
		t.Run("run migration up", func(t *testing.T) {
			db := setupTestDB(t, driverName)
			store := setupTables(t, db)
			engine, err := store.createMorphEngine()
			require.NoError(t, err)
			defer engine.Close()

			runMigrationUp(t, store, engine, 13)
			insertData(t, store)
			runMigrationUp(t, store, engine, 1)
			validateAfter(t, store)
		})
	}
}

func TestMigration_000049(t *testing.T) {
	numRuns := 5
	numPosts := 10

	getPostCreatedAtByIndex := func(i int) int64 { return int64(100000000 + i*100) }

	for _, driverName := range driverNames {
		db := setupTestDB(t, driverName)
		store := setupTables(t, db)
		engine, err := store.createMorphEngine()
		require.NoError(t, err)
		defer engine.Close()

		runMigrationUp(t, store, engine, 48)

		// insert test data
		runsIDs := []string{}
		postsIDs := []string{}
		for i := 0; i < numRuns; i++ {
			run := NewRunMapBuilder().WithName(fmt.Sprintf("run %d", i)).ToRunAsMap()
			err := InsertRun(store, run)
			require.NoError(t, err)
			runsIDs = append(runsIDs, run["ID"].(string))
		}

		for i := 0; i < numPosts; i++ {
			postsIDs = append(postsIDs, model.NewId())
			err := InsertPost(store, postsIDs[i], getPostCreatedAtByIndex(i))
			require.NoError(t, err)
		}

		_ = InsertStatusPost(store, runsIDs[0], postsIDs[2])
		_ = InsertStatusPost(store, runsIDs[0], postsIDs[3])
		_ = InsertStatusPost(store, runsIDs[0], postsIDs[0])
		_ = InsertStatusPost(store, runsIDs[0], postsIDs[1])

		_ = InsertStatusPost(store, runsIDs[1], postsIDs[4])
		_ = InsertStatusPost(store, runsIDs[1], postsIDs[5])

		_ = InsertStatusPost(store, runsIDs[2], postsIDs[7])
		_ = InsertStatusPost(store, runsIDs[2], postsIDs[6])

		runMigrationUp(t, store, engine, 1)

		// validate migration
		type Run struct {
			ID                 string
			Name               string
			CreateAt           int64
			LastStatusUpdateAt int64
		}

		var runs []Run
		err = store.selectBuilder(store.db, &runs, store.builder.
			Select("ID", "Name", "CreateAt", "LastStatusUpdateAt").
			From("IR_Incident").
			OrderBy("Name ASC"))

		require.NoError(t, err)
		require.Len(t, runs, numRuns)

		require.Equal(t, getPostCreatedAtByIndex(3), runs[0].LastStatusUpdateAt)
		require.Equal(t, getPostCreatedAtByIndex(5), runs[1].LastStatusUpdateAt)
		require.Equal(t, getPostCreatedAtByIndex(7), runs[2].LastStatusUpdateAt)
		require.Equal(t, runs[3].CreateAt, runs[3].LastStatusUpdateAt)
		require.Equal(t, runs[4].CreateAt, runs[4].LastStatusUpdateAt)
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

// tableInfoAfterEachLegacyMigration runs legacy migrations, extracts database schema after each migration
// and returns the list. The first and last elements in the list describe DB before and after running all migrations.
func tableInfoAfterEachLegacyMigration(t *testing.T, driverName string, migrationsToRun []MigrationMapping) [][]TableInfo {
	// create database for legacy migration
	db := setupTestDB(t, driverName)
	store := setupTables(t, db)

	list := make([][]TableInfo, len(migrationsToRun)+1)
	schema, err := getDBSchemaInfo(store)
	require.NoError(t, err)
	list[0] = schema

	for i, mm := range migrationsToRun {
		runLegacyMigration(t, store, mm.LegacyMigrationIndex)

		schema, err = getDBSchemaInfo(store)
		require.NoError(t, err)
		list[i+1] = schema
	}

	return list
}

// indexInfoAfterEachLegacyMigration runs legacy migrations, extracts database indexes info after each migration
// and returns the list. The first and last elements in the list describe DB before and after running all migrations.
func indexInfoAfterEachLegacyMigration(t *testing.T, driverName string, migrationsToRun []MigrationMapping) [][]IndexInfo {
	// create database for legacy migration
	db := setupTestDB(t, driverName)
	store := setupTables(t, db)

	list := make([][]IndexInfo, len(migrationsToRun)+1)
	indexes, err := getDBIndexesInfo(store)
	require.NoError(t, err)
	list[0] = indexes

	for i, mm := range migrationsToRun {
		runLegacyMigration(t, store, mm.LegacyMigrationIndex)

		indexes, err = getDBIndexesInfo(store)
		require.NoError(t, err)
		list[i+1] = indexes
	}

	return list
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
			"ActiveStage":     0,
			"ChecklistsJSON":  "[]",
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

func (b *RunMapBuilder) WithEndAt(endAt int64) *RunMapBuilder {
	b.runAsMap["EndAt"] = endAt
	return b
}

func (b *RunMapBuilder) ToRunAsMap() map[string]interface{} {
	return b.runAsMap
}
