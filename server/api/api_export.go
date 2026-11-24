// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"cmp"
	"context"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/mattermost/mattermost/server/public/shared/i18n"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
	"github.com/mattermost/mattermost-plugin-playbooks/server/report"
	"github.com/mattermost/mattermost-plugin-playbooks/server/report/coretypes"
	"github.com/mattermost/mattermost-plugin-playbooks/server/report/html_writer"
	"github.com/mattermost/mattermost-plugin-playbooks/server/report/markdown_writer"
)

const (
	// exportRequestTimeout is the per-request render budget.
	exportRequestTimeout = 30 * time.Second

	// exportRetryAfterSeconds is sent in the Retry-After header on 429.
	exportRetryAfterSeconds = 5

	// maxConcurrentReports bounds concurrent renders; more get a 429.
	maxConcurrentReports = 4

	// filenameMaxLen bounds the ASCII portion of the Content-Disposition
	// filename per plan §6.4 D5.
	filenameMaxLen = 80

	// exportIntentHeader is the optional client-supplied hint recorded in
	// the audit log for HTML exports: "print" when the client will
	// browser-print the HTML to PDF, "download" when saving it as HTML.
	exportIntentHeader = "X-Playbooks-Export-Intent"
)

// ResolverStats is aliased to the app-layer type the ReportService
// produces alongside each report context.
type ResolverStats = app.ResolverStats

// ReportService is the contract the app-layer ReportService satisfies. It is
// declared here as an interface so this handler can be exercised in isolation.
type ReportService interface {
	AssembleRunReportContext(ctx context.Context, runID, userID string, sections report.SectionFlags) (report.RenderContext, ResolverStats, error)
	AssemblePlaybookReportContext(ctx context.Context, playbookID, userID string, sections report.SectionFlags, hasPlaybookManage bool) (report.PlaybookRenderContext, ResolverStats, error)
}

// ExportHandler owns the GET .../report?format=md|html surfaces for both runs
// and playbooks. The HTML is downloaded directly, or browser-printed to PDF by
// the client. Permission gating, CSRF validation, concurrency throttling,
// filename safety, audit logging, and atomic buffer-then-write all live here.
type ExportHandler struct {
	*ErrorHandler
	pluginAPI          *pluginapi.Client
	config             config.Service
	permissions        *app.PermissionsService
	playbookRunService app.PlaybookRunService
	playbookService    app.PlaybookService
	reportService      ReportService

	// renderSem bounds concurrent renders.
	renderSem chan struct{}
}

// registeredExportHandler holds the active ExportHandler used by the route
// registration shims invoked from playbook_runs.go and playbooks.go.
var (
	exportHandlerMu         sync.RWMutex
	registeredExportHandler *ExportHandler
)

// RegisterExportHandler is called once at plugin startup (from plugin.go).
func RegisterExportHandler(h *ExportHandler) {
	exportHandlerMu.Lock()
	defer exportHandlerMu.Unlock()
	registeredExportHandler = h
}

func currentExportHandler() *ExportHandler {
	exportHandlerMu.RLock()
	defer exportHandlerMu.RUnlock()
	return registeredExportHandler
}

// Report formats, selected with the ?format= query parameter.
const (
	formatMarkdown = "md"
	formatHTML     = "html"
)

// registerRunExportRoute mounts the run report endpoint on the per-run
// subrouter when the ExportHandler is available.
func registerRunExportRoute(runRouter *mux.Router) {
	registerExportRoute(runRouter, (*ExportHandler).exportRun)
}

// registerPlaybookExportRoute mounts the playbook report endpoint on the
// per-playbook subrouter.
func registerPlaybookExportRoute(pbRouter *mux.Router) {
	registerExportRoute(pbRouter, (*ExportHandler).exportPlaybook)
}

func registerExportRoute(router *mux.Router, fn func(*ExportHandler, *Context, http.ResponseWriter, *http.Request)) {
	router.HandleFunc("/report", withContext(func(c *Context, w http.ResponseWriter, r *http.Request) {
		h := currentExportHandler()
		if h == nil {
			HandleErrorWithCode(c.logger, w, http.StatusNotFound, "not found", nil)
			return
		}
		fn(h, c, w, r)
	})).Methods(http.MethodGet)
}

// NewExportHandler wires the export handler.
func NewExportHandler(
	pluginAPI *pluginapi.Client,
	cfg config.Service,
	permissions *app.PermissionsService,
	playbookRunService app.PlaybookRunService,
	playbookService app.PlaybookService,
	reportService ReportService,
) *ExportHandler {
	return &ExportHandler{
		ErrorHandler:       &ErrorHandler{},
		pluginAPI:          pluginAPI,
		config:             cfg,
		permissions:        permissions,
		playbookRunService: playbookRunService,
		playbookService:    playbookService,
		reportService:      reportService,
		renderSem:          make(chan struct{}, maxConcurrentReports),
	}
}

// exportRun is the handler for GET /runs/{id}/report?format=md|html.
func (h *ExportHandler) exportRun(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	runID := vars["id"]
	userID := r.Header.Get("Mattermost-User-Id")
	correlationID := correlationFromRequest(r)
	format := r.URL.Query().Get("format")
	logger := c.logger.
		WithField("correlation_id", correlationID).
		WithField("export_kind", "run").
		WithField("export_format", format)

	if !h.reportsEnabled() {
		h.HandleErrorWithCode(w, logger, http.StatusNotFound, "not found", nil)
		return
	}

	auditRec := newExportAuditRecord(r, userID, "run", runID, format)
	defer h.pluginAPI.Audit.Record(auditRec)
	if format != formatMarkdown && format != formatHTML {
		h.HandleErrorWithCode(w, logger, http.StatusBadRequest, "format must be md or html", nil)
		return
	}

	sections, err := parseSectionsQuery(r.URL.Query().Get("sections"), sectionFlagsForRun)
	if err != nil {
		h.HandleErrorWithCode(w, logger, http.StatusBadRequest, err.Error(), err)
		return
	}
	// The executive summary and status updates are part of every run report.
	sections.ExecutiveSummary = true
	sections.StatusUpdates = true
	model.AddEventParameterToAuditRec(auditRec, "sections", sectionsToList(sections))

	location, err := parseTimeZone(r.URL.Query().Get("time_zone"))
	if err != nil {
		h.HandleErrorWithCode(w, logger, http.StatusBadRequest, err.Error(), err)
		return
	}
	if location != nil {
		model.AddEventParameterToAuditRec(auditRec, "time_zone", location.String())
	}

	run, runErr := h.playbookRunService.GetPlaybookRun(runID)
	if runErr != nil {
		h.HandleErrorWithCode(w, logger, http.StatusNotFound, "not found", runErr)
		return
	}
	if permErr := h.permissions.RunView(userID, run.ID); permErr != nil {
		h.HandleErrorWithCode(w, logger, http.StatusNotFound, "not found", permErr)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), exportRequestTimeout)
	defer cancel()
	if !h.acquireRenderSlot(ctx) {
		w.Header().Set("Retry-After", strconv.Itoa(exportRetryAfterSeconds))
		h.HandleErrorWithCode(w, logger, http.StatusTooManyRequests, "rate limited", nil)
		return
	}
	defer h.releaseRenderSlot()

	rc, _, asmErr := h.reportService.AssembleRunReportContext(ctx, run.ID, userID, sections)
	if asmErr != nil {
		h.HandleErrorWithCode(w, logger, http.StatusInternalServerError, "render failed", asmErr)
		return
	}
	rc.TranscriptMode = parseTranscriptMode(r.URL.Query().Get("transcript_mode"))

	filename := reportFilename(rc.Run.Name, "run-"+run.ID, rc.GeneratedAtMillis)

	view := report.BuildRun(rc, h.reportOptions(userID, location))
	var data []byte
	var renderErr error
	if format == formatMarkdown {
		data = markdown_writer.RenderRunMarkdown(view)
	} else {
		data, renderErr = html_writer.RenderRunHTML(view, html_writer.Options{PageSize: "A4"})
	}
	if renderErr != nil {
		h.HandleErrorWithCode(w, logger, http.StatusInternalServerError, "render failed", renderErr)
		return
	}
	h.writeReportResponse(w, format, data, filename, correlationID, rc.TranscriptTruncation)
	auditRec.AddMeta("truncated", rc.TranscriptTruncation.Hit)
	auditRec.Success()
}

// exportPlaybook is the handler for GET /playbooks/{id}/report?format=md|html.
func (h *ExportHandler) exportPlaybook(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookID := vars["id"]
	userID := r.Header.Get("Mattermost-User-Id")
	correlationID := correlationFromRequest(r)
	format := r.URL.Query().Get("format")
	logger := c.logger.
		WithField("correlation_id", correlationID).
		WithField("export_kind", "playbook").
		WithField("export_format", format)

	if !h.reportsEnabled() {
		h.HandleErrorWithCode(w, logger, http.StatusNotFound, "not found", nil)
		return
	}

	auditRec := newExportAuditRecord(r, userID, "playbook", playbookID, format)
	defer h.pluginAPI.Audit.Record(auditRec)
	if format != formatMarkdown && format != formatHTML {
		h.HandleErrorWithCode(w, logger, http.StatusBadRequest, "format must be md or html", nil)
		return
	}

	sections, err := parseSectionsQuery(r.URL.Query().Get("sections"), sectionFlagsForPlaybook)
	if err != nil {
		h.HandleErrorWithCode(w, logger, http.StatusBadRequest, err.Error(), err)
		return
	}
	model.AddEventParameterToAuditRec(auditRec, "sections", sectionsToList(sections))

	pb, pbErr := h.playbookService.Get(playbookID)
	if pbErr != nil {
		h.HandleErrorWithCode(w, logger, http.StatusNotFound, "not found", pbErr)
		return
	}
	if permErr := h.permissions.PlaybookViewWithPlaybook(userID, pb); permErr != nil {
		h.HandleErrorWithCode(w, logger, http.StatusNotFound, "not found", permErr)
		return
	}
	hasPlaybookManage := h.permissions.PlaybookManageProperties(userID, pb) == nil

	ctx, cancel := context.WithTimeout(r.Context(), exportRequestTimeout)
	defer cancel()
	if !h.acquireRenderSlot(ctx) {
		w.Header().Set("Retry-After", strconv.Itoa(exportRetryAfterSeconds))
		h.HandleErrorWithCode(w, logger, http.StatusTooManyRequests, "rate limited", nil)
		return
	}
	defer h.releaseRenderSlot()

	pc, _, asmErr := h.reportService.AssemblePlaybookReportContext(ctx, pb.ID, userID, sections, hasPlaybookManage)
	if asmErr != nil {
		h.HandleErrorWithCode(w, logger, http.StatusInternalServerError, "render failed", asmErr)
		return
	}

	filename := reportFilename(pc.Playbook.Title, "playbook-"+pb.ID, pc.GeneratedAtMillis)

	view := report.BuildPlaybook(pc, h.reportOptions(userID, nil))
	var data []byte
	var renderErr error
	if format == formatMarkdown {
		data = markdown_writer.RenderPlaybookMarkdown(view)
	} else {
		data, renderErr = html_writer.RenderPlaybookHTML(view, html_writer.Options{PageSize: "A4"})
	}
	if renderErr != nil {
		h.HandleErrorWithCode(w, logger, http.StatusInternalServerError, "render failed", renderErr)
		return
	}
	h.writeReportResponse(w, format, data, filename, correlationID, report.Truncation{})
	auditRec.Success()
}

// ---- response writers ----

// writeReportResponse emits the report as an attachment. The client either
// downloads it or, for HTML, browser-prints it to PDF. Browsers never render
// an attachment, so the headers only guard against sniffing and caching; the
// HTML report carries its own Content-Security-Policy for when it's opened.
func (h *ExportHandler) writeReportResponse(w http.ResponseWriter, format string, data []byte, filename string, correlationID string, trunc report.Truncation) {
	contentType := "text/html; charset=utf-8"
	if format == formatMarkdown {
		contentType = "text/markdown; charset=utf-8"
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Length", strconv.Itoa(len(data)))
	w.Header().Set("Content-Disposition", buildContentDisposition(filename, format))
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	if correlationID != "" {
		w.Header().Set("X-Request-ID", correlationID)
	}
	if trunc.Hit {
		w.Header().Set("X-Playbooks-Report-Truncated", "true")
		if trunc.Reason != "" {
			w.Header().Set("X-Playbooks-Report-Truncated-Reason", trunc.Reason)
		}
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data) //nolint:gosec
}

// ---- gating helpers ----

// reportsEnabled returns true when the reports beta feature is enabled.
func (h *ExportHandler) reportsEnabled() bool {
	return h.config != nil && h.config.IsReportsEnabled()
}

// reportOptions loads the requester once to translate the report into their
// language and show times in location, or in their own time zone when
// location is nil, falling back to English and UTC. Users are named as the
// server's teammate name display setting says.
func (h *ExportHandler) reportOptions(userID string, location *time.Location) report.Options {
	locale, userLocation := "en", time.UTC
	if user, err := h.pluginAPI.User.Get(userID); err == nil && user != nil {
		locale = cmp.Or(user.Locale, locale)
		userLocation = user.GetTimezoneLocation()
	}
	if location == nil {
		location = userLocation
	}
	var nameFormat string
	if cfg := h.pluginAPI.Configuration.GetConfig(); cfg != nil && cfg.TeamSettings.TeammateNameDisplay != nil {
		nameFormat = *cfg.TeamSettings.TeammateNameDisplay
	}
	return report.Options{T: i18n.GetUserTranslations(locale), Locale: locale, Location: location, NameFormat: nameFormat}
}

// acquireRenderSlot returns true when the request obtains a slot; false on
// saturation (caller should respond 429).
func (h *ExportHandler) acquireRenderSlot(ctx context.Context) bool {
	select {
	case h.renderSem <- struct{}{}:
		return true
	case <-ctx.Done():
		return false
	default:
		return false
	}
}

func (h *ExportHandler) releaseRenderSlot() {
	select {
	case <-h.renderSem:
	default:
	}
}

// ---- audit ----

// newExportAuditRecord starts the exportReport audit record for a request.
// It stays a failure unless the handler marks it successful after writing
// the report.
func newExportAuditRecord(r *http.Request, userID, kind, id, format string) *model.AuditRecord {
	rec := plugin.MakeAuditRecord("exportReport", model.AuditStatusFail)
	rec.Actor.UserId = userID
	rec.AddMeta(model.AuditKeyAPIPath, r.URL.Path)
	model.AddEventParameterToAuditRec(rec, "kind", kind)
	model.AddEventParameterToAuditRec(rec, "id", id)
	model.AddEventParameterToAuditRec(rec, "format", format)
	if intent := r.Header.Get(exportIntentHeader); intent != "" {
		model.AddEventParameterToAuditRec(rec, "intent", intent)
	}
	return rec
}

// ---- helpers (file-scoped, no receiver) ----

// sectionFlagsForRun and sectionFlagsForPlaybook are the per-surface section
// catalogs used by parseSectionsQuery.
var (
	sectionFlagsForRun = map[string]func(*report.SectionFlags){
		"summary":    func(s *report.SectionFlags) { s.ExecutiveSummary = true },
		"timeline":   func(s *report.SectionFlags) { s.Timeline = true },
		"updates":    func(s *report.SectionFlags) { s.StatusUpdates = true },
		"tasks":      func(s *report.SectionFlags) { s.Checklists = true },
		"retro":      func(s *report.SectionFlags) { s.Retrospective = true },
		"transcript": func(s *report.SectionFlags) { s.Transcript = true },
	}
	sectionFlagsForPlaybook = map[string]func(*report.SectionFlags){
		"overview": func(s *report.SectionFlags) { s.PlaybookOverview = true },
		"tasks":    func(s *report.SectionFlags) { s.PlaybookChecklistTemplates = true },
		"settings": func(s *report.SectionFlags) { s.PlaybookSettings = true },
	}
)

// parseSectionsQuery interprets the ?sections= query param. Empty/missing
// returns the default set for the surface; an unknown token returns an error.
func parseSectionsQuery(raw string, catalog map[string]func(*report.SectionFlags)) (report.SectionFlags, error) {
	if raw == "" {
		if _, runSurface := catalog["timeline"]; runSurface {
			return report.DefaultRunSections(), nil
		}
		return report.DefaultPlaybookSections(), nil
	}
	var s report.SectionFlags
	for tok := range strings.SplitSeq(raw, ",") {
		tok = strings.TrimSpace(strings.ToLower(tok))
		if tok == "" {
			continue
		}
		setter, ok := catalog[tok]
		if !ok {
			return report.SectionFlags{}, errors.Errorf("unknown section token %q", tok)
		}
		setter(&s)
	}
	return s, nil
}

// sectionsToList renders SectionFlags as a sorted slice for stable audit
// payloads.
func sectionsToList(s report.SectionFlags) []string {
	out := []string{}
	add := func(name string, on bool) {
		if on {
			out = append(out, name)
		}
	}
	add("summary", s.ExecutiveSummary)
	add("timeline", s.Timeline)
	add("updates", s.StatusUpdates)
	add("tasks", s.Checklists)
	add("retro", s.Retrospective)
	add("transcript", s.Transcript)
	add("playbook_overview", s.PlaybookOverview)
	add("playbook_tasks", s.PlaybookChecklistTemplates)
	add("playbook_settings", s.PlaybookSettings)
	sort.Strings(out)
	return out
}

// parseTranscriptMode normalizes the ?transcript_mode= query param. Unknown
// or empty values resolve to threaded — the safer default since orphan
// replies are signaled explicitly rather than silently promoted.
func parseTranscriptMode(raw string) coretypes.TranscriptMode {
	switch coretypes.TranscriptMode(raw) {
	case coretypes.TranscriptModeChronological:
		return coretypes.TranscriptModeChronological
	default:
		return coretypes.TranscriptModeThreaded
	}
}

// parseTimeZone loads the IANA time zone named by the ?time_zone= query
// param. Empty returns nil, meaning the requester's own time zone.
func parseTimeZone(raw string) (*time.Location, error) {
	if raw == "" {
		return nil, nil
	}
	// time.LoadLocation takes "Local" as the server's time zone, which is
	// not a time zone the client can mean.
	location, err := time.LoadLocation(raw)
	if err != nil || raw == "Local" {
		return nil, errors.Errorf("unknown time zone %q", raw)
	}
	return location, nil
}

// safeFilename produces an RFC 6266-safe ASCII filename. The input is the
// human title; fallback is used when input collapses to empty.
func safeFilename(raw, fallback string) string {
	ascii := make([]rune, 0, len(raw))
	for _, r := range raw {
		switch {
		case r >= 'A' && r <= 'Z',
			r >= 'a' && r <= 'z',
			r >= '0' && r <= '9',
			r == '.', r == '_', r == '-':
			ascii = append(ascii, r)
		case r == ' ':
			ascii = append(ascii, '_')
		default:
			ascii = append(ascii, '_')
		}
	}
	out := strings.Trim(string(ascii), "._-")
	out = collapseUnderscores(out)
	if out == "" {
		out = fallback
	}
	if len(out) > filenameMaxLen {
		out = out[:filenameMaxLen]
	}
	return out
}

func collapseUnderscores(s string) string {
	var b strings.Builder
	prev := rune(0)
	for _, r := range s {
		if r == '_' && prev == '_' {
			continue
		}
		b.WriteRune(r)
		prev = r
	}
	return b.String()
}

// reportFilename names a report file, without an extension, after its title
// and generation time in UTC: <title>_<YYYY-MM-DDTHH-MM>. The time keeps
// repeated exports of the same run or playbook apart.
func reportFilename(title, fallback string, generatedAtMs int64) string {
	generatedAt := time.Now()
	if generatedAtMs > 0 {
		generatedAt = time.UnixMilli(generatedAtMs)
	}
	return safeFilename(title, fallback) + "_" + generatedAt.UTC().Format("2006-01-02T15-04")
}

// buildContentDisposition returns an RFC 6266 attachment Content-Disposition
// header with both the ASCII and the UTF-8 filename forms.
func buildContentDisposition(name, ext string) string {
	encoded := url.PathEscape(name)
	return fmt.Sprintf(`attachment; filename="%s.%s"; filename*=UTF-8''%s.%s`, name, ext, encoded, ext)
}

// correlationFromRequest reuses the request's X-Request-ID when present, or
// generates a fresh one.
func correlationFromRequest(r *http.Request) string {
	if id := r.Header.Get("X-Request-ID"); id != "" {
		return id
	}
	return model.NewId()
}
