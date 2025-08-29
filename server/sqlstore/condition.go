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
func (c *conditionStore) CreateCondition(playbookID string, condition app.StoredCondition) (*app.StoredCondition, error) {
	if condition.ID == "" {
		condition.ID = model.NewId()
	}

	// Ensure condition belongs to the specified playbook
	condition.PlaybookID = playbookID

	now := model.GetMillis()
	condition.CreateAt = now
	condition.UpdateAt = now

	conditionExprJSON, err := json.Marshal(condition.ConditionExpr)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal condition expression")
	}

	propertyFieldIDsJSON, err := json.Marshal(condition.PropertyFieldIDs)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal property field IDs")
	}

	propertyOptionsIDsJSON, err := json.Marshal(condition.PropertyOptionsIDs)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal property options IDs")
	}

	_, err = c.store.execBuilder(c.store.db, c.queryBuilder.
		Insert("IR_Condition").
		SetMap(map[string]any{
			"ID":                 condition.ID,
			"ConditionExpr":      conditionExprJSON,
			"PlaybookID":         condition.PlaybookID,
			"RunID":              condition.RunID,
			"PropertyFieldIDs":   propertyFieldIDsJSON,
			"PropertyOptionsIDs": propertyOptionsIDsJSON,
			"CreateAt":           condition.CreateAt,
			"UpdateAt":           condition.UpdateAt,
			"DeleteAt":           condition.DeleteAt,
		}))

	if err != nil {
		return nil, errors.Wrap(err, "failed to store condition")
	}

	return &condition, nil
}

// GetCondition retrieves a stored condition by ID
func (c *conditionStore) GetCondition(playbookID, conditionID string) (*app.StoredCondition, error) {
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

	condition, err := c.toCondition(sqlCondition)
	if err != nil {
		return nil, err
	}

	return &condition, nil
}

// UpdateCondition updates an existing stored condition
func (c *conditionStore) UpdateCondition(playbookID string, condition app.StoredCondition) (*app.StoredCondition, error) {
	condition.UpdateAt = model.GetMillis()

	conditionExprJSON, err := json.Marshal(condition.ConditionExpr)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal condition expression")
	}

	propertyFieldIDsJSON, err := json.Marshal(condition.PropertyFieldIDs)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal property field IDs")
	}

	propertyOptionsIDsJSON, err := json.Marshal(condition.PropertyOptionsIDs)
	if err != nil {
		return nil, errors.Wrap(err, "failed to marshal property options IDs")
	}

	_, err = c.store.execBuilder(c.store.db, c.queryBuilder.
		Update("IR_Condition").
		SetMap(map[string]any{
			"ConditionExpr":      conditionExprJSON,
			"RunID":              condition.RunID,
			"PropertyFieldIDs":   propertyFieldIDsJSON,
			"PropertyOptionsIDs": propertyOptionsIDsJSON,
			"UpdateAt":           condition.UpdateAt,
		}).
		Where(sq.Eq{
			"ID":         condition.ID,
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
func (c *conditionStore) GetConditions(playbookID string, options app.ConditionFilterOptions) ([]app.StoredCondition, error) {
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

	conditions := make([]app.StoredCondition, 0, len(sqlConditions))
	for _, sqlCondition := range sqlConditions {
		condition, err := c.toCondition(sqlCondition)
		if err != nil {
			return nil, err
		}
		conditions = append(conditions, condition)
	}

	return conditions, nil
}

func (c *conditionStore) toCondition(sqlCondition conditionForDB) (app.StoredCondition, error) {
	var conditionExpr app.ConditionExpr
	if err := json.Unmarshal(sqlCondition.ConditionExpr, &conditionExpr); err != nil {
		return app.StoredCondition{}, errors.Wrap(err, "failed to unmarshal condition expression")
	}

	var propertyFieldIDs []string
	if err := json.Unmarshal(sqlCondition.PropertyFieldIDs, &propertyFieldIDs); err != nil {
		return app.StoredCondition{}, errors.Wrap(err, "failed to unmarshal property field IDs")
	}

	var propertyOptionsIDs []string
	if err := json.Unmarshal(sqlCondition.PropertyOptionsIDs, &propertyOptionsIDs); err != nil {
		return app.StoredCondition{}, errors.Wrap(err, "failed to unmarshal property options IDs")
	}

	return app.StoredCondition{
		Condition: app.Condition{
			ID:            sqlCondition.ID,
			ConditionExpr: conditionExpr,
			PlaybookID:    sqlCondition.PlaybookID,
			RunID:         sqlCondition.RunID,
			CreateAt:      sqlCondition.CreateAt,
			UpdateAt:      sqlCondition.UpdateAt,
			DeleteAt:      sqlCondition.DeleteAt,
		},
		PropertyFieldIDs:   propertyFieldIDs,
		PropertyOptionsIDs: propertyOptionsIDs,
	}, nil
}
