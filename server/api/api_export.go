// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"context"
	"crypto/subtle"
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
	"github.com/sirupsen/logrus"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/pluginapi"

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

	// defaultMaxConcurrentReports is the fallback semaphore size when config
	// is unset or non-positive.
	defaultMaxConcurrentReports = 4

	// filenameMaxLen bounds the ASCII portion of the Content-Disposition
	// filename per plan §6.4 D5.
	filenameMaxLen = 80

	// exportIntentHeader is the optional client-supplied hint recorded in
	// the audit log for HTML exports: "print" when the client will
	// browser-print the HTML to PDF, "download" when saving it as HTML.
	exportIntentHeader = "X-Playbooks-Export-Intent"
)

// ResolverStats is aliased to the app-layer type the ReportService
// produces. The handler folds the values into audit records.
type ResolverStats = app.ResolverStats

// ReportService is the contract the app-layer ReportService satisfies. It is
// declared here as an interface so this handler can be exercised in isolation.
type ReportService interface {
	AssembleRunReportContext(ctx context.Context, runID, userID string, sections report.SectionFlags, locale string) (report.RenderContext, ResolverStats, error)
	AssemblePlaybookReportContext(ctx context.Context, playbookID, userID string, sections report.SectionFlags, locale string, hasPlaybookManage bool) (report.PlaybookRenderContext, ResolverStats, error)
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

	// renderSem bounds concurrent renders. Sized lazily on first request
	// from config.
	renderSemOnce sync.Once
	renderSem     chan struct{}
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
	event := exportEvent("run", format)

	if !h.reportsEnabled() {
		h.HandleErrorWithCode(w, logger, http.StatusNotFound, "not found", nil)
		return
	}
	if err := h.verifyCSRF(r); err != nil {
		h.HandleErrorWithCode(w, logger, http.StatusForbidden, "CSRF check failed", err)
		return
	}
	if format != formatMarkdown && format != formatHTML {
		h.HandleErrorWithCode(w, logger, http.StatusBadRequest, "format must be md or html", nil)
		return
	}

	transcriptDefault := false
	if cfg := h.config.GetConfiguration(); cfg != nil {
		transcriptDefault = cfg.ExportTranscriptDefault
	}
	sections, err := parseSectionsQuery(r.URL.Query().Get("sections"), sectionFlagsForRun, transcriptDefault)
	if err != nil {
		h.HandleErrorWithCode(w, logger, http.StatusBadRequest, err.Error(), err)
		return
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

	locale := h.resolveLocale(userID)

	rc, resolverStats, asmErr := h.reportService.AssembleRunReportContext(ctx, run.ID, userID, sections, locale)
	if asmErr != nil {
		h.logAndAuditFailure(logger, event, userID, run.ID, correlationID, sections, asmErr)
		h.HandleErrorWithCode(w, logger, http.StatusInternalServerError, "render failed", asmErr)
		return
	}
	rc.TranscriptMode = parseTranscriptMode(r.URL.Query().Get("transcript_mode"))

	filename := reportFilename(rc.Run.Name, "run-"+run.ID, rc.GeneratedAtMillis)

	var data []byte
	var renderErr error
	if format == formatMarkdown {
		data = markdown_writer.RenderRunMarkdown(rc)
	} else {
		data, renderErr = html_writer.RenderRunHTML(rc, html_writer.Options{Title: rc.Run.Name, PageSize: "A4"})
	}
	if renderErr != nil {
		h.logAndAuditFailure(logger, event, userID, run.ID, correlationID, sections, renderErr)
		h.HandleErrorWithCode(w, logger, http.StatusInternalServerError, "render failed", renderErr)
		return
	}
	h.writeReportResponse(w, format, data, filename, correlationID, rc.TranscriptTruncation)
	h.auditSuccess(logger, event, userID, run.ID, correlationID, sections, resolverStats, rc.TranscriptTruncation, len(data), exportIntent(r, format))
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
	event := exportEvent("playbook", format)

	if !h.reportsEnabled() {
		h.HandleErrorWithCode(w, logger, http.StatusNotFound, "not found", nil)
		return
	}
	if err := h.verifyCSRF(r); err != nil {
		h.HandleErrorWithCode(w, logger, http.StatusForbidden, "CSRF check failed", err)
		return
	}
	if format != formatMarkdown && format != formatHTML {
		h.HandleErrorWithCode(w, logger, http.StatusBadRequest, "format must be md or html", nil)
		return
	}

	sections, err := parseSectionsQuery(r.URL.Query().Get("sections"), sectionFlagsForPlaybook, false)
	if err != nil {
		h.HandleErrorWithCode(w, logger, http.StatusBadRequest, err.Error(), err)
		return
	}

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

	locale := h.resolveLocale(userID)

	pc, resolverStats, asmErr := h.reportService.AssemblePlaybookReportContext(ctx, pb.ID, userID, sections, locale, hasPlaybookManage)
	if asmErr != nil {
		h.logAndAuditFailure(logger, event, userID, pb.ID, correlationID, sections, asmErr)
		h.HandleErrorWithCode(w, logger, http.StatusInternalServerError, "render failed", asmErr)
		return
	}

	filename := reportFilename(pc.Playbook.Title, "playbook-"+pb.ID, pc.GeneratedAtMillis)

	var data []byte
	var renderErr error
	if format == formatMarkdown {
		data = markdown_writer.RenderPlaybookMarkdown(pc)
	} else {
		data, renderErr = html_writer.RenderPlaybookHTML(pc, html_writer.Options{Title: pc.Playbook.Title, PageSize: "A4"})
	}
	if renderErr != nil {
		h.logAndAuditFailure(logger, event, userID, pb.ID, correlationID, sections, renderErr)
		h.HandleErrorWithCode(w, logger, http.StatusInternalServerError, "render failed", renderErr)
		return
	}
	h.writeReportResponse(w, format, data, filename, correlationID, report.Truncation{})
	h.auditSuccess(logger, event, userID, pb.ID, correlationID, sections, resolverStats, report.Truncation{}, len(data), exportIntent(r, format))
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

// reportsEnabled returns true when the plugin config permits exports.
func (h *ExportHandler) reportsEnabled() bool {
	if h.config == nil {
		return true
	}
	cfg := h.config.GetConfiguration()
	if cfg == nil {
		return true
	}
	return cfg.EnableReports
}

// verifyCSRF defends a GET-with-side-effects endpoint against cross-origin
// abuse via the triple-defense: CSRF token, X-Requested-With, or same-site
// Origin/Referer.
func (h *ExportHandler) verifyCSRF(r *http.Request) error {
	if h.csrfTokenMatchesSession(r) {
		return nil
	}
	if strings.EqualFold(r.Header.Get("X-Requested-With"), "XMLHttpRequest") {
		return nil
	}
	if h.originIsSameSite(r) {
		return nil
	}
	return errors.New("CSRF: no matching defense (X-CSRF-Token / X-Requested-With / same-Origin)")
}

func (h *ExportHandler) csrfTokenMatchesSession(r *http.Request) bool {
	headerToken := r.Header.Get("X-CSRF-Token")
	if headerToken == "" {
		return false
	}
	sessionID := readSessionToken(r)
	if sessionID == "" {
		return false
	}
	session, err := h.pluginAPI.Session.Get(sessionID)
	if err != nil || session == nil {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(headerToken), []byte(session.GetCSRF())) == 1
}

func (h *ExportHandler) originIsSameSite(r *http.Request) bool {
	siteURL := h.siteURL()
	if siteURL == "" {
		return false
	}
	if origin := r.Header.Get("Origin"); origin != "" {
		return strings.HasPrefix(origin, siteURL)
	}
	if referer := r.Header.Get("Referer"); referer != "" {
		return strings.HasPrefix(referer, siteURL)
	}
	return false
}

func (h *ExportHandler) siteURL() string {
	cfg := h.pluginAPI.Configuration.GetConfig()
	if cfg == nil || cfg.ServiceSettings.SiteURL == nil {
		return ""
	}
	return *cfg.ServiceSettings.SiteURL
}

// readSessionToken returns the session ID from the standard MM cookie or
// Authorization header; empty when neither is present.
func readSessionToken(r *http.Request) string {
	if c, err := r.Cookie(model.SessionCookieToken); err == nil && c.Value != "" {
		return c.Value
	}
	auth := r.Header.Get("Authorization")
	if after, ok := strings.CutPrefix(auth, "Bearer "); ok {
		return strings.TrimSpace(after)
	}
	return ""
}

// resolveLocale reads the requester's profile locale. Falls back to "en".
func (h *ExportHandler) resolveLocale(userID string) string {
	user, err := h.pluginAPI.User.Get(userID)
	if err != nil || user == nil || user.Locale == "" {
		return "en"
	}
	return user.Locale
}

// acquireRenderSlot returns true when the request obtains a slot; false on
// saturation (caller should respond 429).
func (h *ExportHandler) acquireRenderSlot(ctx context.Context) bool {
	h.renderSemOnce.Do(func() {
		max := defaultMaxConcurrentReports
		if cfg := h.config.GetConfiguration(); cfg != nil && cfg.MaxConcurrentReports > 0 {
			max = cfg.MaxConcurrentReports
		}
		h.renderSem = make(chan struct{}, max)
	})
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
	if h.renderSem == nil {
		return
	}
	select {
	case <-h.renderSem:
	default:
	}
}

// ---- audit ----

func (h *ExportHandler) logAndAuditFailure(logger logrus.FieldLogger, event, userID, resourceID, correlationID string, sections report.SectionFlags, internalErr error) {
	rec := plugin.MakeAuditRecord(event, model.AuditStatusFail)
	model.AddEventParameterToAuditRec(rec, "user_id", userID)
	model.AddEventParameterToAuditRec(rec, "resource_id", resourceID)
	model.AddEventParameterToAuditRec(rec, "correlation_id", correlationID)
	model.AddEventParameterToAuditRec(rec, "sections", sectionsToList(sections))
	if internalErr != nil {
		rec.AddErrorCode(http.StatusInternalServerError)
		rec.AddMeta("error", internalErr.Error())
	}
	logger.WithError(internalErr).WithFields(logrus.Fields{
		"event":          event,
		"user_id":        userID,
		"resource_id":    resourceID,
		"correlation_id": correlationID,
	}).Warn("playbooks export failed")
	_ = rec
}

func (h *ExportHandler) auditSuccess(logger logrus.FieldLogger, event, userID, resourceID, correlationID string, sections report.SectionFlags, stats ResolverStats, trunc report.Truncation, bytesWritten int, intent string) {
	fields := logrus.Fields{
		"event":            event,
		"user_id":          userID,
		"resource_id":      resourceID,
		"correlation_id":   correlationID,
		"sections":         sectionsToList(sections),
		"resolver_lookups": stats.Lookups,
		"resolver_cached":  stats.Cached,
		"resolver_cap_hit": stats.CapHit,
		"truncated":        trunc.Hit,
		"truncated_reason": trunc.Reason,
		"truncated_posts":  trunc.Posts,
		"truncated_bytes":  trunc.Bytes,
		"bytes_written":    bytesWritten,
	}
	if intent != "" {
		fields["intent"] = intent
	}
	logger.WithFields(fields).Info("playbooks export succeeded")
}

// ---- helpers (file-scoped, no receiver) ----

// sectionFlagsForRun and sectionFlagsForPlaybook are the per-surface section
// catalogs used by parseSectionsQuery.
var (
	sectionFlagsForRun = map[string]func(*report.SectionFlags){
		"cover":      func(s *report.SectionFlags) { s.Cover = true },
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
func parseSectionsQuery(raw string, catalog map[string]func(*report.SectionFlags), transcriptDefault bool) (report.SectionFlags, error) {
	if raw == "" {
		if _, runSurface := catalog["timeline"]; runSurface {
			s := report.DefaultRunSections()
			s.Transcript = transcriptDefault
			return s, nil
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
	add("cover", s.Cover)
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

// exportEvent returns the audit event name for a kind ("run" | "playbook")
// and format, e.g. "run_exported_md".
func exportEvent(kind, format string) string {
	return kind + "_exported_" + format
}

// exportIntent returns the client-supplied intent recorded in the audit log.
// It only applies to HTML exports.
func exportIntent(r *http.Request, format string) string {
	if format != formatHTML {
		return ""
	}
	if intent := r.Header.Get(exportIntentHeader); intent != "" {
		return intent
	}
	return "download"
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
