package api

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/bot"
	"github.com/pkg/errors"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

const maxItemsInRunsAndPlaybooksCategory = 1000

type CategoryHandler struct {
	*ErrorHandler
	api                *pluginapi.Client
	categoryService    app.CategoryService
	playbookService    app.PlaybookService
	playbookRunService app.PlaybookRunService
}

func NewCategoryHandler(router *mux.Router, api *pluginapi.Client, logger bot.Logger, categoryService app.CategoryService, playbookService app.PlaybookService, playbookRunService app.PlaybookRunService) *CategoryHandler {
	handler := &CategoryHandler{
		ErrorHandler:       &ErrorHandler{log: logger},
		api:                api,
		categoryService:    categoryService,
		playbookService:    playbookService,
		playbookRunService: playbookRunService,
	}

	categoriesRouter := router.PathPrefix("/my_categories").Subrouter()
	categoriesRouter.HandleFunc("", handler.getMyCategories).Methods(http.MethodGet)
	categoriesRouter.HandleFunc("", handler.createMyCategory).Methods(http.MethodPost)

	categoryRouter := categoriesRouter.PathPrefix("/{id:[A-Za-z0-9]+}").Subrouter()
	categoryRouter.HandleFunc("", handler.updateMyCategory).Methods(http.MethodPut)
	categoryRouter.HandleFunc("", handler.deleteMyCategory).Methods(http.MethodDelete)

	return handler
}

func (h *CategoryHandler) getMyCategories(w http.ResponseWriter, r *http.Request) {
	params := r.URL.Query()
	teamID := params.Get("team_id")
	userID := r.Header.Get("Mattermost-User-ID")
	customCategories, err := h.categoryService.GetCategories(teamID, userID)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	runsCategory, err := h.getRunsCategory(teamID, userID)
	if err != nil {
		h.HandleError(w, err)
		return
	}
	filteredRuns := filterDuplicatesFromCategory(runsCategory, customCategories)
	allCategories := append([]app.Category{}, customCategories...)
	allCategories = append(allCategories, filteredRuns)

	playbooksCategory, err := h.getPlaybooksCategory(teamID, userID)
	if err != nil {
		h.HandleError(w, err)
		return
	}
	filteredPlaybooks := filterDuplicatesFromCategory(playbooksCategory, customCategories)
	allCategories = append(allCategories, filteredPlaybooks)

	filteredCategories := filterEmptyCategories(allCategories)
	ReturnJSON(w, filteredCategories, http.StatusOK)
}

func (h *CategoryHandler) createMyCategory(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	var category app.Category
	if err := json.NewDecoder(r.Body).Decode(&category); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode category", err)
		return
	}

	if category.ID != "" {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "Category given already has ID", nil)
		return
	}

	// user can only create category for themselves
	if category.UserID != userID {
		h.HandleErrorWithCode(w, http.StatusBadRequest, fmt.Sprintf("userID %s and category userID %s mismatch", userID, category.UserID), nil)
		return
	}

	createdCategory, err := h.categoryService.Create(category)
	if err != nil {
		h.HandleError(w, err)
		return
	}

	ReturnJSON(w, createdCategory, http.StatusOK)
}

func (h *CategoryHandler) updateMyCategory(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	categoryID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	var category app.Category
	if err := json.NewDecoder(r.Body).Decode(&category); err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "unable to decode category", err)
		return
	}

	if categoryID != category.ID {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "categoryID mismatch in patch and body", nil)
		return
	}

	// user can only update category for themselves
	if category.UserID != userID {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "user ID mismatch in session and category", nil)
		return
	}

	// verify if category belongs to the user
	existingCategory, err := h.categoryService.Get(category.ID)
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "Can't get category", err)
		return
	}

	if existingCategory.DeleteAt != 0 {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "Category deleted", nil)
		return
	}

	if existingCategory.UserID != category.UserID {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "UserID mismatch", nil)
		return
	}

	if err := h.categoryService.Update(category); err != nil {
		h.HandleError(w, err)
	}
}

func (h *CategoryHandler) deleteMyCategory(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	categoryID := vars["id"]
	userID := r.Header.Get("Mattermost-User-ID")

	existingCategory, err := h.categoryService.Get(categoryID)
	if err != nil {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "Can't get category", err)
		return
	}

	// category is already deleted. This avoids
	// overriding the original deleted at timestamp
	if existingCategory.DeleteAt != 0 {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "Category deleted", nil)
		return
	}

	// verify if category belongs to the user
	if existingCategory.UserID != userID {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "UserID mismatch", nil)
		return
	}

	if err := h.categoryService.Delete(categoryID); err != nil {
		h.HandleError(w, err)
	}
}

func (h *CategoryHandler) getRunsCategory(teamID, userID string) (app.Category, error) {
	runs, err := h.playbookRunService.GetPlaybookRuns(
		app.RequesterInfo{
			UserID: userID,
			TeamID: teamID,
		},
		app.PlaybookRunFilterOptions{
			TeamID:                  teamID,
			ParticipantOrFollowerID: userID,
			Statuses:                []string{app.StatusInProgress},
			Page:                    0,
			PerPage:                 maxItemsInRunsAndPlaybooksCategory,
		},
	)
	if err != nil {
		return app.Category{}, errors.Wrapf(err, "can't get playbook runs")
	}

	runCategoryItems := []app.CategoryItem{}
	for _, run := range runs.Items {
		runCategoryItems = append(runCategoryItems, app.CategoryItem{
			ItemID: run.ID,
			Type:   app.RunItemType,
			Name:   run.Name,
		})
	}
	runCategory := app.Category{
		ID:        "runsCategory",
		Name:      "Runs",
		TeamID:    teamID,
		UserID:    userID,
		Collapsed: false,
		Items:     runCategoryItems,
	}
	return runCategory, nil
}

func (h *CategoryHandler) getPlaybooksCategory(teamID, userID string) (app.Category, error) {
	playbooks, err := h.playbookService.GetPlaybooksForTeam(
		app.RequesterInfo{
			TeamID: teamID,
			UserID: userID,
		},
		teamID,
		app.PlaybookFilterOptions{
			Page:    0,
			PerPage: maxItemsInRunsAndPlaybooksCategory,
		},
	)
	if err != nil {
		return app.Category{}, errors.Wrap(err, "can't get playbooks for team")
	}

	playbookCategoryItems := []app.CategoryItem{}
	for _, playbook := range playbooks.Items {
		playbookCategoryItems = append(playbookCategoryItems, app.CategoryItem{
			ItemID: playbook.ID,
			Type:   app.PlaybookItemType,
			Name:   playbook.Title,
			Public: playbook.Public,
		})
	}

	playbookCategory := app.Category{
		ID:        "playbooksCategory",
		Name:      "Playbooks",
		TeamID:    teamID,
		UserID:    userID,
		Collapsed: false,
		Items:     playbookCategoryItems,
	}
	return playbookCategory, nil
}

func categoriesContainItem(categories []app.Category, item app.CategoryItem) bool {
	for _, category := range categories {
		if category.ContainsItem(item) {
			return true
		}
	}
	return false
}

func filterDuplicatesFromCategory(category app.Category, categories []app.Category) app.Category {
	newItems := []app.CategoryItem{}
	for _, item := range category.Items {
		if !categoriesContainItem(categories, item) {
			newItems = append(newItems, item)
		}
	}
	category.Items = newItems
	return category
}

func filterEmptyCategories(categories []app.Category) []app.Category {
	newCategories := []app.Category{}
	for _, category := range categories {
		if len(category.Items) > 0 {
			newCategories = append(newCategories, category)
		}
	}
	return newCategories
}
