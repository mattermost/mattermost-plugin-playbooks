// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"

	sq "github.com/Masterminds/squirrel"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

type conditionForDB struct {
	ID                 string
	PlaybookID         string
	RunID              string
	CreateAt           int64
	UpdateAt           int64
	DeleteAt           int64
	ConditionExpr      []byte
	PropertyFieldIDs   []byte
	PropertyOptionsIDs []byte
}

// conditionStore is a sql store for conditions. Use NewConditionStore to create it.
type conditionStore struct {
	pluginAPI       PluginAPIClient
	store           *SQLStore
	queryBuilder    sq.StatementBuilderType
	conditionSelect sq.SelectBuilder
}

// Ensure conditionStore implements the app.ConditionStore interface.
var _ app.ConditionStore = (*conditionStore)(nil)

// NewConditionStore creates a new store for condition service.
func NewConditionStore(pluginAPI PluginAPIClient, sqlStore *SQLStore) app.ConditionStore {
	conditionSelect := sqlStore.builder.
		Select(
			"ID",
			"ConditionExpr",
			"PlaybookID",
			"RunID",
			"PropertyFieldIDs",
			"PropertyOptionsIDs",
			"CreateAt",
			"UpdateAt",
			"DeleteAt",
		).
		From("IR_Condition").
		Where(sq.Eq{"DeleteAt": 0})

	newStore := &conditionStore{
		pluginAPI:       pluginAPI,
		store:           sqlStore,
		queryBuilder:    sqlStore.builder,
		conditionSelect: conditionSelect,
	}
	return newStore
}

// CreateCondition creates a new stored condition
func (c *conditionStore) CreateCondition(playbookID string, condition app.Condition) (*app.Condition, error) {
	if condition.ID == "" {
		condition.ID = model.NewId()
	}

	// Set timestamps if not provided
	now := model.GetMillis()
	if condition.CreateAt == 0 {
		condition.CreateAt = now
	}
	if condition.UpdateAt == 0 {
		condition.UpdateAt = now
	}

	// Ensure condition belongs to the specified playbook
	condition.PlaybookID = playbookID

	// Convert to database representation
	dbCondition, err := c.toConditionForDB(condition)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert condition for database")
	}

	_, err = c.store.execBuilder(c.store.db, c.queryBuilder.
		Insert("IR_Condition").
		SetMap(map[string]any{
			"ID":                 dbCondition.ID,
			"ConditionExpr":      dbCondition.ConditionExpr,
			"PlaybookID":         dbCondition.PlaybookID,
			"RunID":              dbCondition.RunID,
			"PropertyFieldIDs":   dbCondition.PropertyFieldIDs,
			"PropertyOptionsIDs": dbCondition.PropertyOptionsIDs,
			"CreateAt":           dbCondition.CreateAt,
			"UpdateAt":           dbCondition.UpdateAt,
			"DeleteAt":           dbCondition.DeleteAt,
		}))

	if err != nil {
		return nil, errors.Wrap(err, "failed to store condition")
	}

	return &condition, nil
}

// GetCondition retrieves a stored condition by ID
func (c *conditionStore) GetCondition(playbookID, conditionID string) (*app.Condition, error) {
	var sqlCondition conditionForDB

	err := c.store.getBuilder(c.store.db, &sqlCondition, c.conditionSelect.
		Where(sq.Eq{
			"ID":         conditionID,
			"PlaybookID": playbookID,
		}))

	if err == sql.ErrNoRows {
		return nil, errors.New("condition not found")
	}
	if err != nil {
		return nil, errors.Wrap(err, "failed to get condition")
	}

	condition, err := c.fromConditionForDB(sqlCondition)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert condition from database")
	}

	return &condition, nil
}

// UpdateCondition updates an existing stored condition
func (c *conditionStore) UpdateCondition(playbookID string, condition app.Condition) (*app.Condition, error) {
	// Set UpdateAt if not provided
	if condition.UpdateAt == 0 {
		condition.UpdateAt = model.GetMillis()
	}

	// Convert to database representation
	dbCondition, err := c.toConditionForDB(condition)
	if err != nil {
		return nil, errors.Wrap(err, "failed to convert condition for database")
	}

	_, err = c.store.execBuilder(c.store.db, c.queryBuilder.
		Update("IR_Condition").
		SetMap(map[string]any{
			"ConditionExpr":      dbCondition.ConditionExpr,
			"RunID":              dbCondition.RunID,
			"PropertyFieldIDs":   dbCondition.PropertyFieldIDs,
			"PropertyOptionsIDs": dbCondition.PropertyOptionsIDs,
			"UpdateAt":           dbCondition.UpdateAt,
		}).
		Where(sq.Eq{
			"ID":         dbCondition.ID,
			"PlaybookID": playbookID,
			"DeleteAt":   0,
		}))

	if err != nil {
		return nil, errors.Wrap(err, "failed to update condition")
	}

	return &condition, nil
}

// DeleteCondition soft-deletes a stored condition
func (c *conditionStore) DeleteCondition(playbookID, conditionID string) error {
	_, err := c.store.execBuilder(c.store.db, c.queryBuilder.
		Update("IR_Condition").
		Set("DeleteAt", model.GetMillis()).
		Where(sq.Eq{
			"ID":         conditionID,
			"PlaybookID": playbookID,
			"DeleteAt":   0,
		}))

	if err != nil {
		return errors.Wrap(err, "failed to delete condition")
	}

	return nil
}

// GetConditions retrieves stored conditions with filtering
func (c *conditionStore) GetConditions(playbookID string, options app.ConditionFilterOptions) ([]app.Condition, error) {
	query := c.conditionSelect.
		Where(sq.Eq{"PlaybookID": playbookID}).
		OrderBy("CreateAt DESC")

	if options.RunID != "" {
		query = query.Where(sq.Eq{"RunID": options.RunID})
	}

	if options.PerPage > 0 {
		query = query.Limit(uint64(options.PerPage))
	}

	if options.Page > 0 && options.PerPage > 0 {
		query = query.Offset(uint64(options.Page * options.PerPage))
	}

	var sqlConditions []conditionForDB
	err := c.store.selectBuilder(c.store.db, &sqlConditions, query)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get conditions")
	}

	conditions := make([]app.Condition, 0, len(sqlConditions))
	for _, sqlCondition := range sqlConditions {
		condition, err := c.fromConditionForDB(sqlCondition)
		if err != nil {
			return nil, errors.Wrap(err, "failed to convert condition from database")
		}
		conditions = append(conditions, condition)
	}

	return conditions, nil
}

func (c *conditionStore) fromConditionForDB(sqlCondition conditionForDB) (app.Condition, error) {
	var conditionExpr app.ConditionExpr
	if err := json.Unmarshal(sqlCondition.ConditionExpr, &conditionExpr); err != nil {
		return app.Condition{}, errors.Wrap(err, "failed to unmarshal condition expression")
	}

	return app.Condition{
		ID:            sqlCondition.ID,
		ConditionExpr: conditionExpr,
		PlaybookID:    sqlCondition.PlaybookID,
		RunID:         sqlCondition.RunID,
		CreateAt:      sqlCondition.CreateAt,
		UpdateAt:      sqlCondition.UpdateAt,
		DeleteAt:      sqlCondition.DeleteAt,
	}, nil
}

// toConditionForDB converts an app.Condition to conditionForDB for database operations
func (c *conditionStore) toConditionForDB(condition app.Condition) (conditionForDB, error) {
	// Extract metadata for storage
	propertyFieldIDs := extractPropertyFieldIDs(condition.ConditionExpr)
	propertyOptionsIDs := extractPropertyOptionsIDs(condition.ConditionExpr)

	conditionExprJSON, err := json.Marshal(condition.ConditionExpr)
	if err != nil {
		return conditionForDB{}, errors.Wrap(err, "failed to marshal condition expression")
	}

	propertyFieldIDsJSON, err := json.Marshal(propertyFieldIDs)
	if err != nil {
		return conditionForDB{}, errors.Wrap(err, "failed to marshal property field IDs")
	}

	propertyOptionsIDsJSON, err := json.Marshal(propertyOptionsIDs)
	if err != nil {
		return conditionForDB{}, errors.Wrap(err, "failed to marshal property options IDs")
	}

	return conditionForDB{
		ID:                 condition.ID,
		PlaybookID:         condition.PlaybookID,
		RunID:              condition.RunID,
		CreateAt:           condition.CreateAt,
		UpdateAt:           condition.UpdateAt,
		DeleteAt:           condition.DeleteAt,
		ConditionExpr:      conditionExprJSON,
		PropertyFieldIDs:   propertyFieldIDsJSON,
		PropertyOptionsIDs: propertyOptionsIDsJSON,
	}, nil
}

// extractPropertyFieldIDs recursively extracts all property field IDs from a condition
func extractPropertyFieldIDs(condition app.ConditionExpr) []string {
	var fieldIDs []string
	fieldIDSet := make(map[string]struct{})

	extractFromCondition(condition, fieldIDSet)

	for fieldID := range fieldIDSet {
		fieldIDs = append(fieldIDs, fieldID)
	}

	return fieldIDs
}

func extractFromCondition(condition app.ConditionExpr, fieldIDSet map[string]struct{}) {
	if condition.And != nil {
		for _, subCondition := range condition.And {
			extractFromCondition(subCondition, fieldIDSet)
		}
	}

	if condition.Or != nil {
		for _, subCondition := range condition.Or {
			extractFromCondition(subCondition, fieldIDSet)
		}
	}

	if condition.Is != nil {
		fieldIDSet[condition.Is.FieldID] = struct{}{}
	}

	if condition.IsNot != nil {
		fieldIDSet[condition.IsNot.FieldID] = struct{}{}
	}
}

// extractPropertyOptionsIDs recursively extracts all property options IDs from a condition
func extractPropertyOptionsIDs(condition app.ConditionExpr) []string {
	var optionsIDs []string
	optionsIDSet := make(map[string]struct{})

	extractOptionsFromCondition(condition, optionsIDSet)

	for optionsID := range optionsIDSet {
		optionsIDs = append(optionsIDs, optionsID)
	}

	return optionsIDs
}

func extractOptionsFromCondition(condition app.ConditionExpr, optionsIDSet map[string]struct{}) {
	if condition.And != nil {
		for _, subCondition := range condition.And {
			extractOptionsFromCondition(subCondition, optionsIDSet)
		}
	}

	if condition.Or != nil {
		for _, subCondition := range condition.Or {
			extractOptionsFromCondition(subCondition, optionsIDSet)
		}
	}

	if condition.Is != nil {
		extractOptionsFromComparison(condition.Is, optionsIDSet)
	}

	if condition.IsNot != nil {
		extractOptionsFromComparison(condition.IsNot, optionsIDSet)
	}
}

func extractOptionsFromComparison(comparison *app.ComparisonCondition, optionsIDSet map[string]struct{}) {
	var arrayValue []string
	if err := json.Unmarshal(comparison.Value, &arrayValue); err == nil {
		// Successfully unmarshaled as array (select/multiselect fields)
		for _, optionID := range arrayValue {
			optionsIDSet[optionID] = struct{}{}
		}
	}
}
