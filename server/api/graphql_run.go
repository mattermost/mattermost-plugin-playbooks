package api

import (
	"context"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/pkg/errors"
)

type RunResolver struct {
	app.PlaybookRun
}

func (r *RunResolver) IsFavorite(ctx context.Context) (bool, error) {
	c, err := getContext(ctx)
	if err != nil {
		return false, err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	isFavorite, err := c.categoryService.IsItemFavorite(
		app.CategoryItem{
			ItemID: r.ID,
			Type:   app.RunItemType,
		},
		r.TeamID,
		userID,
	)
	if err != nil {
		return false, errors.Wrap(err, "can't determine if item is favorite or not")
	}

	return isFavorite, nil
}

func (r *RunResolver) CreateAt() float64 {
	return float64(r.PlaybookRun.CreateAt)
}

func (r *RunResolver) EndAt() float64 {
	return float64(r.PlaybookRun.EndAt)
}

func (r *RunResolver) SummaryModifiedAt() float64 {
	return float64(r.PlaybookRun.SummaryModifiedAt)
}
func (r *RunResolver) LastStatusUpdateAt() float64 {
	return float64(r.PlaybookRun.LastStatusUpdateAt)
}

func (r *RunResolver) Checklists() []*ChecklistResolver {
	checklistResolvers := make([]*ChecklistResolver, 0, len(r.PlaybookRun.Checklists))
	for _, checklist := range r.PlaybookRun.Checklists {
		checklistResolvers = append(checklistResolvers, &ChecklistResolver{checklist})
	}

	return checklistResolvers
}
