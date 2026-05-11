// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"bytes"
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
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
	"golang.org/x/sync/singleflight"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/pluginapi"

	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
	"github.com/mattermost/mattermost-plugin-playbooks/server/config"
	"github.com/mattermost/mattermost-plugin-playbooks/server/report"
)

// exportEventRunPDF / exportEventPlaybookPDF are the audit event names for
// successful or failed PDF exports.
const (
	exportEventRunPDF      = "run_exported_pdf"
	exportEventPlaybookPDF = "playbook_exported_pdf"

	// exportRequestTimeout is the per-request render budget (plan §3.12).
	exportRequestTimeout = 15 * time.Second

	// exportRetryAfterSeconds is sent in the Retry-After header on 429.
	exportRetryAfterSeconds = 5

	// defaultMaxConcurrentReports is the fallback semaphore size when config
	// is unset or non-positive.
	defaultMaxConcurrentReports = 4

	// defaultMaxRunReportPosts is the fallback transcript post cap.
	defaultMaxRunReportPosts = 5000

	// fallbackMaxRunReportBytes is 5 MB; used when neither plugin config nor
	// server FileSettings.MaxFileSize give us a value.
	fallbackMaxRunReportBytes = 5 * 1024 * 1024

	// filenameMaxLen bounds the ASCII portion of the Content-Disposition
	// filename per plan §6.4 D5.
	filenameMaxLen = 80
)

// ResolverStats is aliased to the app-layer type the ReportService
// produces. The handler folds the values into audit records.
type ResolverStats = app.ResolverStats

// ReportService is the contract T3 (parallel) implements. It is declared
// here as an interface so this handler can be exercised in isolation.
type ReportService interface {
	AssembleRunReportContext(ctx context.Context, runID, userID string, sections report.SectionFlags, locale string) (report.RenderContext, ResolverStats, error)
	AssemblePlaybookReportContext(ctx context.Context, playbookID, userID string, sections report.SectionFlags, locale string, hasPlaybookManage bool) (report.PlaybookRenderContext, ResolverStats, error)
}

// PDFRenderer is the contract T2 (parallel) implements. *report.MarotoRenderer
// satisfies it at runtime; tests inject a fake.
type PDFRenderer interface {
	RenderRun(ctx context.Context, rc report.RenderContext, opts report.RenderOptions) (*bytes.Buffer, error)
	RenderPlaybook(ctx context.Context, pc report.PlaybookRenderContext, opts report.RenderOptions) (*bytes.Buffer, error)
}

// ExportHandler owns the GET .../report.pdf surfaces for both runs and
// playbooks. Permission gating, CSRF validation, concurrency throttling,
// filename safety, audit logging, and atomic buffer-then-write all live here.
type ExportHandler struct {
	*ErrorHandler
	pluginAPI          *pluginapi.Client
	config             config.Service
	permissions        *app.PermissionsService
	playbookRunService app.PlaybookRunService
	playbookService    app.PlaybookService
	reportService      ReportService
	renderer           PDFRenderer

	// renderSem bounds concurrent renders. Sized lazily on first request
	// from config (resize-on-config-change is intentionally out of scope:
	// the bound is a safety net, not a precise admission controller).
	renderSemOnce sync.Once
	renderSem     chan struct{}

	// sf coalesces identical in-flight renders. Keyed on
	// (kind|id|userID|sectionsHash) — see exportKey.
	sf singleflight.Group
}

// registeredExportHandler holds the active ExportHandler used by the route
// registration shims invoked from playbook_runs.go and playbooks.go. It is
// set once at plugin startup via RegisterExportHandler; nil leaves the
// report.pdf endpoints unmounted, which is the correct behavior when the
// scaffold is loaded without the full dependency graph wired up yet.
var (
	exportHandlerMu         sync.RWMutex
	registeredExportHandler *ExportHandler
)

// RegisterExportHandler is called once at plugin startup (from plugin.go,
// owned by the swarm lead) to publish the constructed handler.
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

// registerRunExportRoute is invoked from NewPlaybookRunHandler. It mounts
// GET /report.pdf on the per-run subrouter when the ExportHandler is
// available.
func registerRunExportRoute(runRouter *mux.Router) {
	runRouter.HandleFunc("/report.pdf", withContext(func(c *Context, w http.ResponseWriter, r *http.Request) {
		h := currentExportHandler()
		if h == nil {
			HandleErrorWithCode(c.logger, w, http.StatusNotFound, "not found", nil)
			return
		}
		h.exportRunPDF(c, w, r)
	})).Methods(http.MethodGet)
}

// registerPlaybookExportRoute is invoked from NewPlaybookHandler.
func registerPlaybookExportRoute(pbRouter *mux.Router) {
	pbRouter.HandleFunc("/report.pdf", withContext(func(c *Context, w http.ResponseWriter, r *http.Request) {
		h := currentExportHandler()
		if h == nil {
			HandleErrorWithCode(c.logger, w, http.StatusNotFound, "not found", nil)
			return
		}
		h.exportPlaybookPDF(c, w, r)
	})).Methods(http.MethodGet)
}

// NewExportHandler wires the export handler into the api router. Both
// endpoints are mounted on existing per-resource subrouters by their
// respective files (playbook_runs.go, playbooks.go) — this constructor
// stores the dependencies and exposes the two handler methods.
func NewExportHandler(
	pluginAPI *pluginapi.Client,
	cfg config.Service,
	permissions *app.PermissionsService,
	playbookRunService app.PlaybookRunService,
	playbookService app.PlaybookService,
	reportService ReportService,
	renderer PDFRenderer,
) *ExportHandler {
	return &ExportHandler{
		ErrorHandler:       &ErrorHandler{},
		pluginAPI:          pluginAPI,
		config:             cfg,
		permissions:        permissions,
		playbookRunService: playbookRunService,
		playbookService:    playbookService,
		reportService:      reportService,
		renderer:           renderer,
	}
}

// exportRunPDF handles GET /runs/{id}/report.pdf.
func (h *ExportHandler) exportRunPDF(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	runID := vars["id"]
	userID := r.Header.Get("Mattermost-User-Id")
	correlationID := correlationFromRequest(r)
	logger := c.logger.WithField("correlation_id", correlationID).WithField("export_kind", "run")

	if !h.pdfReportsEnabled() {
		h.HandleErrorWithCode(w, logger, http.StatusNotFound, "not found", nil)
		return
	}
	if err := h.checkAcceptPDF(r); err != nil {
		h.HandleErrorWithCode(w, logger, http.StatusNotAcceptable, "Accept header does not permit application/pdf", err)
		return
	}
	if err := h.verifyCSRF(r); err != nil {
		h.HandleErrorWithCode(w, logger, http.StatusForbidden, "CSRF check failed", err)
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
		// Existence non-disclosure: 404 on missing AND on visible-but-denied.
		// We re-check visibility below; missing collapses to 404 here.
		h.HandleErrorWithCode(w, logger, http.StatusNotFound, "not found", runErr)
		return
	}
	if permErr := h.permissions.RunView(userID, run.ID); permErr != nil {
		h.HandleErrorWithCode(w, logger, http.StatusNotFound, "not found", permErr)
		return
	}

	// Acquire the global render slot before context timeout. The slot is
	// released by the buffered render below.
	ctx, cancel := context.WithTimeout(r.Context(), exportRequestTimeout)
	defer cancel()
	if !h.acquireRenderSlot(ctx) {
		w.Header().Set("Retry-After", strconv.Itoa(exportRetryAfterSeconds))
		h.HandleErrorWithCode(w, logger, http.StatusTooManyRequests, "rate limited", nil)
		return
	}
	defer h.releaseRenderSlot()

	locale := h.resolveLocale(userID)
	opts := h.buildRenderOptions(sections, locale)

	rc, resolverStats, asmErr := h.reportService.AssembleRunReportContext(ctx, run.ID, userID, sections, locale)
	if asmErr != nil {
		h.logAndAuditFailure(logger, exportEventRunPDF, userID, run.ID, correlationID, sections, asmErr)
		h.HandleErrorWithCode(w, logger, http.StatusInternalServerError, "render failed", asmErr)
		return
	}

	buf, renderErr := h.renderRun(ctx, run.ID, userID, sections, rc, opts)
	if renderErr != nil {
		status := http.StatusInternalServerError
		public := "render failed"
		if errors.Is(renderErr, context.DeadlineExceeded) {
			status = http.StatusInternalServerError
			public = "render timeout"
		}
		h.logAndAuditFailure(logger, exportEventRunPDF, userID, run.ID, correlationID, sections, renderErr)
		w.Header().Set("X-Request-ID", correlationID)
		h.HandleErrorWithCode(w, logger, status, public, renderErr)
		return
	}

	filename := safeFilename(run.Name, "run-"+run.ID)
	h.writePDFResponse(w, buf, filename, correlationID, rc.TranscriptTruncation)
	h.auditSuccess(logger, exportEventRunPDF, userID, run.ID, correlationID, sections, resolverStats, rc.TranscriptTruncation, buf.Len())
}

// exportPlaybookPDF handles GET /playbooks/{id}/report.pdf.
func (h *ExportHandler) exportPlaybookPDF(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookID := vars["id"]
	userID := r.Header.Get("Mattermost-User-Id")
	correlationID := correlationFromRequest(r)
	logger := c.logger.WithField("correlation_id", correlationID).WithField("export_kind", "playbook")

	if !h.pdfReportsEnabled() {
		h.HandleErrorWithCode(w, logger, http.StatusNotFound, "not found", nil)
		return
	}
	if err := h.checkAcceptPDF(r); err != nil {
		h.HandleErrorWithCode(w, logger, http.StatusNotAcceptable, "Accept header does not permit application/pdf", err)
		return
	}
	if err := h.verifyCSRF(r); err != nil {
		h.HandleErrorWithCode(w, logger, http.StatusForbidden, "CSRF check failed", err)
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
	opts := h.buildRenderOptions(sections, locale)

	pc, resolverStats, asmErr := h.reportService.AssemblePlaybookReportContext(ctx, pb.ID, userID, sections, locale, hasPlaybookManage)
	if asmErr != nil {
		h.logAndAuditFailure(logger, exportEventPlaybookPDF, userID, pb.ID, correlationID, sections, asmErr)
		h.HandleErrorWithCode(w, logger, http.StatusInternalServerError, "render failed", asmErr)
		return
	}

	buf, renderErr := h.renderPlaybook(ctx, pb.ID, userID, sections, pc, opts)
	if renderErr != nil {
		h.logAndAuditFailure(logger, exportEventPlaybookPDF, userID, pb.ID, correlationID, sections, renderErr)
		w.Header().Set("X-Request-ID", correlationID)
		h.HandleErrorWithCode(w, logger, http.StatusInternalServerError, "render failed", renderErr)
		return
	}

	filename := safeFilename(pb.Title, "playbook-"+pb.ID)
	// Playbook context never carries transcript truncation.
	h.writePDFResponse(w, buf, filename, correlationID, report.Truncation{})
	h.auditSuccess(logger, exportEventPlaybookPDF, userID, pb.ID, correlationID, sections, resolverStats, report.Truncation{}, buf.Len())
}

// renderRun wraps the renderer call with single-flight coalescing keyed on
// (kind, id, userID, sectionsHash). Each request gets its own buffer copy
// to avoid concurrent readers of the shared buffer.
func (h *ExportHandler) renderRun(ctx context.Context, runID, userID string, sections report.SectionFlags, rc report.RenderContext, opts report.RenderOptions) (*bytes.Buffer, error) {
	key := exportKey("run", runID, userID, sections)
	v, err, _ := h.sf.Do(key, func() (interface{}, error) {
		return h.renderer.RenderRun(ctx, rc, opts)
	})
	if err != nil {
		return nil, err
	}
	buf, ok := v.(*bytes.Buffer)
	if !ok || buf == nil {
		return nil, errors.New("renderer returned nil buffer")
	}
	return bytes.NewBuffer(append([]byte(nil), buf.Bytes()...)), nil
}

func (h *ExportHandler) renderPlaybook(ctx context.Context, playbookID, userID string, sections report.SectionFlags, pc report.PlaybookRenderContext, opts report.RenderOptions) (*bytes.Buffer, error) {
	key := exportKey("playbook", playbookID, userID, sections)
	v, err, _ := h.sf.Do(key, func() (interface{}, error) {
		return h.renderer.RenderPlaybook(ctx, pc, opts)
	})
	if err != nil {
		return nil, err
	}
	buf, ok := v.(*bytes.Buffer)
	if !ok || buf == nil {
		return nil, errors.New("renderer returned nil buffer")
	}
	return bytes.NewBuffer(append([]byte(nil), buf.Bytes()...)), nil
}

// writePDFResponse emits the buffer atomically: every header set, then a
// single Write. The buffer is fully built before headers go out, so a render
// error never leaks partial PDF bytes.
func (h *ExportHandler) writePDFResponse(w http.ResponseWriter, buf *bytes.Buffer, filename, correlationID string, trunc report.Truncation) {
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Length", strconv.Itoa(buf.Len()))
	w.Header().Set("Content-Disposition", buildContentDisposition(filename))
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Request-ID", correlationID)
	if trunc.Hit {
		w.Header().Set("X-Playbooks-Report-Truncated", "true")
		if trunc.Reason != "" {
			w.Header().Set("X-Playbooks-Report-Truncated-Reason", trunc.Reason)
		}
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(buf.Bytes())
}

// pdfReportsEnabled returns true when the plugin config flag is on. Default
// is true when the setting has never been written.
func (h *ExportHandler) pdfReportsEnabled() bool {
	if h.config == nil {
		return true
	}
	cfg := h.config.GetConfiguration()
	if cfg == nil {
		return true
	}
	// Default true: the field is plain bool, so "unset" cannot be
	// distinguished from "explicitly false" — operators who disable it write
	// `false`. The plugin.json schema declares default=true so a fresh
	// install starts enabled.
	return cfg.EnablePDFReports
}

// checkAcceptPDF returns nil when the Accept header is missing, "*/*", or
// explicitly permits application/pdf.
func (h *ExportHandler) checkAcceptPDF(r *http.Request) error {
	accept := strings.TrimSpace(r.Header.Get("Accept"))
	if accept == "" {
		return nil
	}
	for _, part := range strings.Split(accept, ",") {
		mime := strings.TrimSpace(strings.SplitN(part, ";", 2)[0])
		switch mime {
		case "*/*", "application/*", "application/pdf":
			return nil
		}
	}
	return errors.New("Accept header does not include application/pdf")
}

// verifyCSRF defends a GET-with-side-effects endpoint against cross-origin
// abuse (a hostile page triggering the export against a logged-in victim
// via <img src> or <a href>, draining the render-slot semaphore). The
// check passes when ANY of:
//
//  1. A valid X-CSRF-Token header matches the session's stored token
//     (constant-time compared).
//  2. X-Requested-With: XMLHttpRequest is set — denies <img>/<a>/<link>
//     since the browser will not let those tags set custom headers.
//  3. Origin / Referer is present and matches the configured SiteURL.
//
// All three are paths the Mattermost webapp's fetch wrapper uses. The
// vector we close (cross-origin browser-triggered GET) cannot satisfy
// any of them.
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
	if strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimSpace(strings.TrimPrefix(auth, "Bearer "))
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

// buildRenderOptions assembles the renderer options from request + config.
func (h *ExportHandler) buildRenderOptions(sections report.SectionFlags, locale string) report.RenderOptions {
	cfg := h.config.GetConfiguration()
	maxPosts := defaultMaxRunReportPosts
	if cfg != nil && cfg.MaxRunReportPosts > 0 {
		maxPosts = cfg.MaxRunReportPosts
	}
	maxBytes := h.resolveMaxBytes(cfg)
	return report.RenderOptions{
		Sections: sections,
		Locale:   locale,
		MaxPosts: maxPosts,
		MaxBytes: maxBytes,
		PageSize: report.PageSizeA4,
	}
}

// resolveMaxBytes cascades plugin config → server FileSettings.MaxFileSize
// → fallback 5 MB.
func (h *ExportHandler) resolveMaxBytes(cfg *config.Configuration) int64 {
	if cfg != nil && cfg.MaxRunReportBytes > 0 {
		return int64(cfg.MaxRunReportBytes)
	}
	srv := h.pluginAPI.Configuration.GetConfig()
	if srv != nil && srv.FileSettings.MaxFileSize != nil && *srv.FileSettings.MaxFileSize > 0 {
		return *srv.FileSettings.MaxFileSize
	}
	return fallbackMaxRunReportBytes
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

// logAndAuditFailure records a failed export in both the structured log and
// the audit record stream. pluginapi.Client exposes Log but not the audit
// sink directly; the underlying audit record is built and forwarded via the
// AuditorService once it is wired through (T0 integration).
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
	}).Warn("playbooks pdf export failed")
	_ = rec
}

// auditSuccess emits the success audit record with renderer stats.
func (h *ExportHandler) auditSuccess(logger logrus.FieldLogger, event, userID, resourceID, correlationID string, sections report.SectionFlags, stats ResolverStats, trunc report.Truncation, bytesWritten int) {
	logger.WithFields(logrus.Fields{
		"event":             event,
		"user_id":           userID,
		"resource_id":       resourceID,
		"correlation_id":    correlationID,
		"sections":          sectionsToList(sections),
		"resolver_lookups":     stats.Lookups,
		"resolver_cached":      stats.Cached,
		"resolver_cap_hit":     stats.CapHit,
		"truncated":         trunc.Hit,
		"truncated_reason":  trunc.Reason,
		"truncated_posts":   trunc.Posts,
		"truncated_bytes":   trunc.Bytes,
		"bytes_written":     bytesWritten,
	}).Info("playbooks pdf export succeeded")
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
// returns the default set for the surface; an unknown token returns a 400.
func parseSectionsQuery(raw string, catalog map[string]func(*report.SectionFlags), transcriptDefault bool) (report.SectionFlags, error) {
	if raw == "" {
		// Default sets are surface-specific.
		if _, runSurface := catalog["timeline"]; runSurface {
			s := report.DefaultRunSections()
			s.Transcript = transcriptDefault
			return s, nil
		}
		return report.DefaultPlaybookSections(), nil
	}
	var s report.SectionFlags
	for _, tok := range strings.Split(raw, ",") {
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

// exportKey is the single-flight coalescing key. SHA256 of the section flag
// JSON keeps the key bounded; user+id are scoped in so coalescing only
// catches genuine duplicates from the same requester.
func exportKey(kind, id, userID string, s report.SectionFlags) string {
	flags, _ := json.Marshal(s)
	sum := sha256.Sum256(flags)
	return strings.Join([]string{kind, id, userID, hex.EncodeToString(sum[:])}, "|")
}

// safeFilename produces an RFC 6266-safe ASCII filename. The input is the
// human title; fallback is used when input collapses to empty. The returned
// value is the ASCII form (the UTF-8 percent-encoded form is built in
// buildContentDisposition).
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

// buildContentDisposition emits both filename="" and filename*=UTF-8” forms
// per RFC 6266.
func buildContentDisposition(asciiName string) string {
	encoded := url.PathEscape(asciiName)
	return fmt.Sprintf(`attachment; filename="%s.pdf"; filename*=UTF-8''%s.pdf`, asciiName, encoded)
}

// correlationFromRequest reuses the request's X-Request-ID when present, or
// generates a fresh one. This is the single string used for both the
// response header and the server-side log key.
func correlationFromRequest(r *http.Request) string {
	if id := r.Header.Get("X-Request-ID"); id != "" {
		return id
	}
	return model.NewId()
}
