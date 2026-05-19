// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"path"
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
	"github.com/mattermost/mattermost-plugin-playbooks/server/report/coretypes"
	"github.com/mattermost/mattermost-plugin-playbooks/server/report/html_writer"
	"github.com/mattermost/mattermost-plugin-playbooks/server/report/markdown_writer"
	"github.com/mattermost/mattermost-plugin-playbooks/server/report/renderer/html2pdf"
)

// Audit event names per format. The v5.4 cutover replaced the single
// "_pdf" events with three format-specific events.
const (
	exportEventRunMD        = "run_exported_md"
	exportEventRunHTML      = "run_exported_html"
	exportEventRunPDF       = "run_exported_pdf"
	exportEventPlaybookMD   = "playbook_exported_md"
	exportEventPlaybookHTML = "playbook_exported_html"
	exportEventPlaybookPDF  = "playbook_exported_pdf"

	// exportRequestTimeout is the per-request render budget. v5.4 raised
	// this from 15s to 30s to accommodate the Gotenberg round-trip.
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
	// the audit log on HTML exports ("preview" / "print" / "download").
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

// ExportHandler owns the GET .../report.{md,html,pdf} surfaces for both
// runs and playbooks. Permission gating, CSRF validation, concurrency
// throttling, filename safety, audit logging, and atomic buffer-then-write
// all live here.
type ExportHandler struct {
	*ErrorHandler
	pluginAPI          *pluginapi.Client
	config             config.Service
	permissions        *app.PermissionsService
	playbookRunService app.PlaybookRunService
	playbookService    app.PlaybookService
	reportService      ReportService

	// getRenderer returns the currently-active HTMLPdfRenderer, or nil when
	// no PDF backend is configured. The plugin stores the renderer in an
	// atomic.Pointer that is rebuilt on OnConfigurationChange — the closure
	// reads the latest value on every call.
	getRenderer func() html2pdf.HTMLPdfRenderer

	// renderSem bounds concurrent renders. Sized lazily on first request
	// from config.
	renderSemOnce sync.Once
	renderSem     chan struct{}

	// sf coalesces identical in-flight renders. Keyed on
	// (kind|id|userID|format|sectionsHash).
	sf singleflight.Group
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

// registerRunExportRoute mounts the three per-format run report endpoints
// on the per-run subrouter when the ExportHandler is available.
func registerRunExportRoute(runRouter *mux.Router) {
	register := func(suffix string, fn func(*ExportHandler, *Context, http.ResponseWriter, *http.Request)) {
		runRouter.HandleFunc(suffix, withContext(func(c *Context, w http.ResponseWriter, r *http.Request) {
			h := currentExportHandler()
			if h == nil {
				HandleErrorWithCode(c.logger, w, http.StatusNotFound, "not found", nil)
				return
			}
			fn(h, c, w, r)
		})).Methods(http.MethodGet)
	}
	register("/report.md", (*ExportHandler).exportRun)
	register("/report.html", (*ExportHandler).exportRun)
	register("/report.pdf", (*ExportHandler).exportRun)
}

// registerPlaybookExportRoute mounts the three per-format playbook report
// endpoints on the per-playbook subrouter.
func registerPlaybookExportRoute(pbRouter *mux.Router) {
	register := func(suffix string, fn func(*ExportHandler, *Context, http.ResponseWriter, *http.Request)) {
		pbRouter.HandleFunc(suffix, withContext(func(c *Context, w http.ResponseWriter, r *http.Request) {
			h := currentExportHandler()
			if h == nil {
				HandleErrorWithCode(c.logger, w, http.StatusNotFound, "not found", nil)
				return
			}
			fn(h, c, w, r)
		})).Methods(http.MethodGet)
	}
	register("/report.md", (*ExportHandler).exportPlaybook)
	register("/report.html", (*ExportHandler).exportPlaybook)
	register("/report.pdf", (*ExportHandler).exportPlaybook)
}

// NewExportHandler wires the export handler. The getRenderer closure reads
// the plugin's atomic.Pointer[html2pdf.HTMLPdfRenderer] so config changes
// take effect without rebuilding the handler.
func NewExportHandler(
	pluginAPI *pluginapi.Client,
	cfg config.Service,
	permissions *app.PermissionsService,
	playbookRunService app.PlaybookRunService,
	playbookService app.PlaybookService,
	reportService ReportService,
	getRenderer func() html2pdf.HTMLPdfRenderer,
) *ExportHandler {
	return &ExportHandler{
		ErrorHandler:       &ErrorHandler{},
		pluginAPI:          pluginAPI,
		config:             cfg,
		permissions:        permissions,
		playbookRunService: playbookRunService,
		playbookService:    playbookService,
		reportService:      reportService,
		getRenderer:        getRenderer,
	}
}

// exportRun is the unified handler for GET /runs/{id}/report.{md,html,pdf}.
func (h *ExportHandler) exportRun(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	runID := vars["id"]
	userID := r.Header.Get("Mattermost-User-Id")
	correlationID := correlationFromRequest(r)
	format := formatFromPath(r.URL.Path)
	logger := c.logger.
		WithField("correlation_id", correlationID).
		WithField("export_kind", "run").
		WithField("export_format", format)

	if !h.reportsEnabled() {
		h.HandleErrorWithCode(w, logger, http.StatusNotFound, "not found", nil)
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
		h.logAndAuditFailure(logger, eventForRun(format), userID, run.ID, correlationID, sections, asmErr)
		h.HandleErrorWithCode(w, logger, http.StatusInternalServerError, "render failed", asmErr)
		return
	}
	rc.TranscriptMode = parseTranscriptMode(r.URL.Query().Get("transcript_mode"))

	asciiName := safeFilename(rc.Run.Name, "run-"+run.ID)

	switch format {
	case "md":
		data := h.renderRunMarkdown(rc, run.ID, userID, sections)
		h.writeResponse(w, logger, writeArgs{
			contentType:   "text/markdown; charset=utf-8",
			data:          data,
			asciiName:     asciiName,
			ext:           "md",
			download:      isDownload(r),
			correlationID: correlationID,
			trunc:         rc.TranscriptTruncation,
		})
		h.auditSuccess(logger, exportEventRunMD, userID, run.ID, correlationID, sections, resolverStats, rc.TranscriptTruncation, len(data), "")

	case "html":
		htmlOpts := html_writer.Options{Title: rc.Run.Name, PageSize: "A4"}
		data, htmlErr := h.renderRunHTML(rc, htmlOpts, run.ID, userID, sections)
		if htmlErr != nil {
			h.logAndAuditFailure(logger, exportEventRunHTML, userID, run.ID, correlationID, sections, htmlErr)
			h.HandleErrorWithCode(w, logger, http.StatusInternalServerError, "render failed", htmlErr)
			return
		}
		intent := r.Header.Get(exportIntentHeader)
		if intent == "" {
			intent = "html-direct"
		}
		h.writeHTMLResponse(w, data, asciiName, isDownload(r), correlationID, rc.TranscriptTruncation)
		h.auditSuccess(logger, exportEventRunHTML, userID, run.ID, correlationID, sections, resolverStats, rc.TranscriptTruncation, len(data), intent)

	case "pdf":
		renderer := h.activeRenderer()
		if renderer == nil {
			h.HandleErrorWithCode(w, logger, http.StatusNotImplemented, "PDF rendering not configured", nil)
			return
		}
		htmlOpts := html_writer.Options{Title: rc.Run.Name, PageSize: "A4"}
		htmlData, htmlErr := html_writer.RenderRunHTML(rc, htmlOpts)
		if htmlErr != nil {
			h.logAndAuditFailure(logger, exportEventRunPDF, userID, run.ID, correlationID, sections, htmlErr)
			h.HandleErrorWithCode(w, logger, http.StatusInternalServerError, "render failed", htmlErr)
			return
		}
		cfg := h.config.GetConfiguration()
		pdfOpts := html2pdf.Options{
			Title:       rc.Run.Name,
			Filename:    asciiName + ".pdf",
			PdfAFlavor:  pdfAFlavor(cfg),
			EnableLinks: true,
			PageSize:    "A4",
		}
		pdfData, pdfErr := h.renderRunPDF(ctx, renderer, htmlData, pdfOpts, run.ID, userID, sections)
		if pdfErr != nil {
			h.logAndAuditFailure(logger, exportEventRunPDF, userID, run.ID, correlationID, sections, pdfErr)
			w.Header().Set("X-Request-ID", correlationID)
			h.HandleErrorWithCode(w, logger, http.StatusBadGateway, "PDF renderer failed", pdfErr)
			return
		}
		h.writePDFResponse(w, pdfData, asciiName, correlationID, rc.TranscriptTruncation)
		h.auditSuccess(logger, exportEventRunPDF, userID, run.ID, correlationID, sections, resolverStats, rc.TranscriptTruncation, len(pdfData), "")

	default:
		h.HandleErrorWithCode(w, logger, http.StatusNotFound, "unknown format", nil)
	}
}

// exportPlaybook is the unified handler for
// GET /playbooks/{id}/report.{md,html,pdf}.
func (h *ExportHandler) exportPlaybook(c *Context, w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	playbookID := vars["id"]
	userID := r.Header.Get("Mattermost-User-Id")
	correlationID := correlationFromRequest(r)
	format := formatFromPath(r.URL.Path)
	logger := c.logger.
		WithField("correlation_id", correlationID).
		WithField("export_kind", "playbook").
		WithField("export_format", format)

	if !h.reportsEnabled() {
		h.HandleErrorWithCode(w, logger, http.StatusNotFound, "not found", nil)
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

	pc, resolverStats, asmErr := h.reportService.AssemblePlaybookReportContext(ctx, pb.ID, userID, sections, locale, hasPlaybookManage)
	if asmErr != nil {
		h.logAndAuditFailure(logger, eventForPlaybook(format), userID, pb.ID, correlationID, sections, asmErr)
		h.HandleErrorWithCode(w, logger, http.StatusInternalServerError, "render failed", asmErr)
		return
	}

	asciiName := safeFilename(pc.Playbook.Title, "playbook-"+pb.ID)

	switch format {
	case "md":
		data := h.renderPlaybookMarkdown(pc, pb.ID, userID, sections)
		h.writeResponse(w, logger, writeArgs{
			contentType:   "text/markdown; charset=utf-8",
			data:          data,
			asciiName:     asciiName,
			ext:           "md",
			download:      isDownload(r),
			correlationID: correlationID,
		})
		h.auditSuccess(logger, exportEventPlaybookMD, userID, pb.ID, correlationID, sections, resolverStats, report.Truncation{}, len(data), "")

	case "html":
		htmlOpts := html_writer.Options{Title: pc.Playbook.Title, PageSize: "A4"}
		data, htmlErr := h.renderPlaybookHTML(pc, htmlOpts, pb.ID, userID, sections)
		if htmlErr != nil {
			h.logAndAuditFailure(logger, exportEventPlaybookHTML, userID, pb.ID, correlationID, sections, htmlErr)
			h.HandleErrorWithCode(w, logger, http.StatusInternalServerError, "render failed", htmlErr)
			return
		}
		intent := r.Header.Get(exportIntentHeader)
		if intent == "" {
			intent = "html-direct"
		}
		h.writeHTMLResponse(w, data, asciiName, isDownload(r), correlationID, report.Truncation{})
		h.auditSuccess(logger, exportEventPlaybookHTML, userID, pb.ID, correlationID, sections, resolverStats, report.Truncation{}, len(data), intent)

	case "pdf":
		renderer := h.activeRenderer()
		if renderer == nil {
			h.HandleErrorWithCode(w, logger, http.StatusNotImplemented, "PDF rendering not configured", nil)
			return
		}
		htmlOpts := html_writer.Options{Title: pc.Playbook.Title, PageSize: "A4"}
		htmlData, htmlErr := html_writer.RenderPlaybookHTML(pc, htmlOpts)
		if htmlErr != nil {
			h.logAndAuditFailure(logger, exportEventPlaybookPDF, userID, pb.ID, correlationID, sections, htmlErr)
			h.HandleErrorWithCode(w, logger, http.StatusInternalServerError, "render failed", htmlErr)
			return
		}
		cfg := h.config.GetConfiguration()
		pdfOpts := html2pdf.Options{
			Title:       pc.Playbook.Title,
			Filename:    asciiName + ".pdf",
			PdfAFlavor:  pdfAFlavor(cfg),
			EnableLinks: true,
			PageSize:    "A4",
		}
		pdfData, pdfErr := h.renderPlaybookPDF(ctx, renderer, htmlData, pdfOpts, pb.ID, userID, sections)
		if pdfErr != nil {
			h.logAndAuditFailure(logger, exportEventPlaybookPDF, userID, pb.ID, correlationID, sections, pdfErr)
			w.Header().Set("X-Request-ID", correlationID)
			h.HandleErrorWithCode(w, logger, http.StatusBadGateway, "PDF renderer failed", pdfErr)
			return
		}
		h.writePDFResponse(w, pdfData, asciiName, correlationID, report.Truncation{})
		h.auditSuccess(logger, exportEventPlaybookPDF, userID, pb.ID, correlationID, sections, resolverStats, report.Truncation{}, len(pdfData), "")

	default:
		h.HandleErrorWithCode(w, logger, http.StatusNotFound, "unknown format", nil)
	}
}

// ---- single-flight wrappers per (kind, format) ----

func (h *ExportHandler) renderRunMarkdown(rc report.RenderContext, runID, userID string, sections report.SectionFlags) []byte {
	key := exportKey("run", "md", runID, userID, sections)
	v, _, _ := h.sf.Do(key, func() (interface{}, error) {
		return markdown_writer.RenderRunMarkdown(rc), nil
	})
	b, _ := v.([]byte)
	return append([]byte(nil), b...)
}

func (h *ExportHandler) renderPlaybookMarkdown(pc report.PlaybookRenderContext, playbookID, userID string, sections report.SectionFlags) []byte {
	key := exportKey("playbook", "md", playbookID, userID, sections)
	v, _, _ := h.sf.Do(key, func() (interface{}, error) {
		return markdown_writer.RenderPlaybookMarkdown(pc), nil
	})
	b, _ := v.([]byte)
	return append([]byte(nil), b...)
}

func (h *ExportHandler) renderRunHTML(rc report.RenderContext, opts html_writer.Options, runID, userID string, sections report.SectionFlags) ([]byte, error) {
	key := exportKey("run", "html", runID, userID, sections)
	v, err, _ := h.sf.Do(key, func() (interface{}, error) {
		return html_writer.RenderRunHTML(rc, opts)
	})
	if err != nil {
		return nil, err
	}
	b, _ := v.([]byte)
	return append([]byte(nil), b...), nil
}

func (h *ExportHandler) renderPlaybookHTML(pc report.PlaybookRenderContext, opts html_writer.Options, playbookID, userID string, sections report.SectionFlags) ([]byte, error) {
	key := exportKey("playbook", "html", playbookID, userID, sections)
	v, err, _ := h.sf.Do(key, func() (interface{}, error) {
		return html_writer.RenderPlaybookHTML(pc, opts)
	})
	if err != nil {
		return nil, err
	}
	b, _ := v.([]byte)
	return append([]byte(nil), b...), nil
}

func (h *ExportHandler) renderRunPDF(ctx context.Context, renderer html2pdf.HTMLPdfRenderer, htmlData []byte, opts html2pdf.Options, runID, userID string, sections report.SectionFlags) ([]byte, error) {
	key := exportKey("run", "pdf", runID, userID, sections)
	v, err, _ := h.sf.Do(key, func() (interface{}, error) {
		return renderer.Render(ctx, htmlData, opts)
	})
	if err != nil {
		return nil, err
	}
	b, _ := v.([]byte)
	if b == nil {
		return nil, errors.New("renderer returned nil pdf")
	}
	return append([]byte(nil), b...), nil
}

func (h *ExportHandler) renderPlaybookPDF(ctx context.Context, renderer html2pdf.HTMLPdfRenderer, htmlData []byte, opts html2pdf.Options, playbookID, userID string, sections report.SectionFlags) ([]byte, error) {
	key := exportKey("playbook", "pdf", playbookID, userID, sections)
	v, err, _ := h.sf.Do(key, func() (interface{}, error) {
		return renderer.Render(ctx, htmlData, opts)
	})
	if err != nil {
		return nil, err
	}
	b, _ := v.([]byte)
	if b == nil {
		return nil, errors.New("renderer returned nil pdf")
	}
	return append([]byte(nil), b...), nil
}

// activeRenderer reads the current renderer pointer; returns nil when no
// PDF backend is configured.
func (h *ExportHandler) activeRenderer() html2pdf.HTMLPdfRenderer {
	if h.getRenderer == nil {
		return nil
	}
	return h.getRenderer()
}

// ---- response writers ----

type writeArgs struct {
	contentType   string
	data          []byte
	asciiName     string
	ext           string // "md" | "html" | "pdf"
	download      bool
	correlationID string
	trunc         report.Truncation
}

// writeResponse is the unified emitter used for markdown (and as a building
// block). Headers go out atomically; the buffer is fully built before this
// is called so a render error never leaks partial bytes.
func (h *ExportHandler) writeResponse(w http.ResponseWriter, _ logrus.FieldLogger, a writeArgs) {
	w.Header().Set("Content-Type", a.contentType)
	w.Header().Set("Content-Length", strconv.Itoa(len(a.data)))
	w.Header().Set("Content-Disposition", buildDispositionFor(a.asciiName, a.ext, a.download))
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	if a.correlationID != "" {
		w.Header().Set("X-Request-ID", a.correlationID)
	}
	if a.trunc.Hit {
		w.Header().Set("X-Playbooks-Report-Truncated", "true")
		if a.trunc.Reason != "" {
			w.Header().Set("X-Playbooks-Report-Truncated-Reason", a.trunc.Reason)
		}
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(a.data)
}

// writeHTMLResponse emits the HTML report with the v5.4 hardened header set:
// strict CSP, nosniff, frame-deny, referrer-policy.
func (h *ExportHandler) writeHTMLResponse(w http.ResponseWriter, data []byte, asciiName string, download bool, correlationID string, trunc report.Truncation) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Content-Length", strconv.Itoa(len(data)))
	w.Header().Set("Content-Disposition", buildDispositionFor(asciiName, "html", download))
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Security-Policy", cspHeader())
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("Referrer-Policy", "no-referrer")
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
	_, _ = w.Write(data)
}

// writePDFResponse emits a PDF byte slice atomically with the full RFC 6266
// Content-Disposition.
func (h *ExportHandler) writePDFResponse(w http.ResponseWriter, data []byte, asciiName, correlationID string, trunc report.Truncation) {
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Length", strconv.Itoa(len(data)))
	w.Header().Set("Content-Disposition", buildContentDisposition(asciiName))
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("X-Request-ID", correlationID)
	if trunc.Hit {
		w.Header().Set("X-Playbooks-Report-Truncated", "true")
		if trunc.Reason != "" {
			w.Header().Set("X-Playbooks-Report-Truncated-Reason", trunc.Reason)
		}
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

// ---- gating helpers ----

// reportsEnabled returns true when the plugin config permits exports.
// EnableReports is the v5.4 master switch; it falls back to EnablePDFReports
// for one release to keep older operator configs working.
func (h *ExportHandler) reportsEnabled() bool {
	if h.config == nil {
		return true
	}
	cfg := h.config.GetConfiguration()
	if cfg == nil {
		return true
	}
	if cfg.EnableReports {
		return true
	}
	return cfg.EnablePDFReports
}

// checkAcceptPDF is retained for backward compatibility with the existing
// test suite. It is no longer called from the request path in v5.4 — the
// format is decided by the URL suffix, not the Accept header.
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

// exportKey is the single-flight coalescing key. It folds the kind, format,
// id, user, and section-flag JSON into a stable string.
func exportKey(kind, format, id, userID string, s report.SectionFlags) string {
	flags, _ := json.Marshal(s)
	sum := sha256.Sum256(flags)
	return strings.Join([]string{kind, format, id, userID, hex.EncodeToString(sum[:])}, "|")
}

// formatFromPath extracts "md" | "html" | "pdf" from a URL ending in
// report.<ext>. Unknown suffixes return "".
func formatFromPath(p string) string {
	base := path.Base(p)
	switch base {
	case "report.md":
		return "md"
	case "report.html":
		return "html"
	case "report.pdf":
		return "pdf"
	}
	if i := strings.LastIndex(base, "."); i >= 0 {
		return strings.ToLower(base[i+1:])
	}
	return ""
}

// eventForRun returns the audit event constant for a given format on the run surface.
func eventForRun(format string) string {
	switch format {
	case "md":
		return exportEventRunMD
	case "html":
		return exportEventRunHTML
	case "pdf":
		return exportEventRunPDF
	}
	return exportEventRunPDF
}

// eventForPlaybook returns the audit event constant for a given format on
// the playbook surface.
func eventForPlaybook(format string) string {
	switch format {
	case "md":
		return exportEventPlaybookMD
	case "html":
		return exportEventPlaybookHTML
	case "pdf":
		return exportEventPlaybookPDF
	}
	return exportEventPlaybookPDF
}

// isDownload returns true when the client asked for an attachment
// (?download=1). Defaults to inline display.
func isDownload(r *http.Request) bool {
	return r.URL.Query().Get("download") == "1"
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

// buildDispositionFor returns an RFC 6266 Content-Disposition header for the
// given extension. disposition is "inline" by default; "attachment" when
// download is true.
func buildDispositionFor(asciiName, ext string, download bool) string {
	disposition := "inline"
	if download || ext == "pdf" {
		disposition = "attachment"
	}
	encoded := url.PathEscape(asciiName)
	return fmt.Sprintf(`%s; filename="%s.%s"; filename*=UTF-8''%s.%s`,
		disposition, asciiName, ext, encoded, ext)
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

// buildContentDisposition emits both filename="" and filename*=UTF-8 forms
// per RFC 6266 for the PDF surface. Retained as the canonical PDF disposition
// builder used by writePDFResponse and the existing test suite.
func buildContentDisposition(asciiName string) string {
	encoded := url.PathEscape(asciiName)
	return fmt.Sprintf(`attachment; filename="%s.pdf"; filename*=UTF-8''%s.pdf`, asciiName, encoded)
}

// correlationFromRequest reuses the request's X-Request-ID when present, or
// generates a fresh one.
func correlationFromRequest(r *http.Request) string {
	if id := r.Header.Get("X-Request-ID"); id != "" {
		return id
	}
	return model.NewId()
}

// cspHeader is the strict Content-Security-Policy applied to the inline
// HTML report. It forbids scripts, network fetches, and framing entirely;
// inline styles are allowed only because the document embeds its own
// <style> blocks.
func cspHeader() string {
	return "default-src 'none'; script-src 'none'; object-src 'none'; " +
		"connect-src 'none'; worker-src 'none'; media-src 'none'; " +
		"style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
		"font-src 'self' data:; base-uri 'none'; form-action 'none'; " +
		"frame-ancestors 'none'"
}

// pdfAFlavor returns the configured PDF/A flavor or the empty string.
func pdfAFlavor(cfg *config.Configuration) string {
	if cfg == nil {
		return ""
	}
	return cfg.PdfAFlavor
}
