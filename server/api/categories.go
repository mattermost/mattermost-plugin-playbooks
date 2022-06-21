package api

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/bot"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

type CategoryHandler struct {
	*ErrorHandler
	api             *pluginapi.Client
	categoryService app.CategoryService
}

func NewCategoryHandler(router *mux.Router, api *pluginapi.Client, logger bot.Logger, categoryService app.CategoryService) *CategoryHandler {
	handler := &CategoryHandler{
		ErrorHandler:    &ErrorHandler{log: logger},
		api:             api,
		categoryService: categoryService,
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
	categories, err := h.categoryService.GetCategories(teamID, userID)
	if err != nil {
		h.HandleError(w, err)
		return
	}
	ReturnJSON(w, categories, http.StatusOK)
}

func (h *CategoryHandler) createMyCategory(w http.ResponseWriter, r *http.Request) {
	params := r.URL.Query()
	userID := r.Header.Get("Mattermost-User-ID")
	teamID := params.Get("team_id")

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

	if category.TeamID != teamID {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "teamID mismatch", nil)
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
	params := r.URL.Query()
	teamID := params.Get("team_id")

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

	if category.TeamID != teamID {
		h.HandleErrorWithCode(w, http.StatusBadRequest, "teamID mismatch", nil)
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
	params := r.URL.Query()
	teamID := params.Get("team_id")

	if err := h.categoryService.Delete(categoryID, teamID, userID); err != nil {
		h.HandleError(w, err)
	}
}
