package metrics

import (
	"os"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
)

const (
	MetricsNamespace          = "playbook"
	MetricsSubsystemPlaybooks = "playbooks"
	MetricsSubsystemRuns      = "runs"
	MetricsSubsystemSystem    = "system"

	MetricsCloudInstallationLabel = "installationId"
)

type InstanceInfo struct {
	Version        string
	InstallationID string
}

// Metrics used to instrumentate metrics in prometheus.
type Metrics struct {
	registry *prometheus.Registry

	instance *prometheus.GaugeVec

	playbooksCreatedTotal  prometheus.Counter
	playbooksArchivedTotal prometheus.Counter
	playbooksRestoredTotal prometheus.Counter
	runsCreatedTotal       prometheus.Counter
	runsFinishedTotal      prometheus.Counter
	errorsTotal            prometheus.Counter

	playbooksActiveTotal      prometheus.Gauge
	runsActiveTotal           prometheus.Gauge
	remindersOutstandingTotal prometheus.Gauge
	retrosOutstandingTotal    prometheus.Gauge
}

// NewMetrics Factory method to create a new metrics collector.
func NewMetrics(info InstanceInfo) *Metrics {
	m := &Metrics{}

	m.registry = prometheus.NewRegistry()
	options := collectors.ProcessCollectorOpts{
		Namespace: MetricsNamespace,
	}
	m.registry.MustRegister(collectors.NewProcessCollector(options))
	m.registry.MustRegister(collectors.NewGoCollector())

	additionalLabels := map[string]string{}
	if info.InstallationID != "" {
		additionalLabels[MetricsCloudInstallationLabel] = os.Getenv("MM_CLOUD_INSTALLATION_ID")
	}

	m.instance = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemSystem,
		Name:        "playbook_instance_info",
		Help:        "Instance information for Playbook.",
		ConstLabels: additionalLabels,
	}, []string{"Version"})
	m.registry.MustRegister(m.instance)
	m.instance.WithLabelValues(info.Version).Set(1)

	m.playbooksCreatedTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemPlaybooks,
		Name:        "playbook_created_total",
		Help:        "Total number of playbooks created.",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.playbooksCreatedTotal)

	m.playbooksArchivedTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemPlaybooks,
		Name:        "playbook_archived_total",
		Help:        "Total number of playbooks archived.",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.playbooksArchivedTotal)

	m.playbooksRestoredTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemPlaybooks,
		Name:        "playbook_restored_total",
		Help:        "Total number of playbooks restored.",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.playbooksRestoredTotal)

	m.runsCreatedTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemRuns,
		Name:        "runs_restored_total",
		Help:        "Total number of runs restored.",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.runsCreatedTotal)

	m.runsFinishedTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemRuns,
		Name:        "runs_finished_total",
		Help:        "Total number of runs finished.",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.runsFinishedTotal)

	m.errorsTotal = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemSystem,
		Name:        "errors_total",
		Help:        "Total number of errors.",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.errorsTotal)

	m.playbooksActiveTotal = prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemPlaybooks,
		Name:        "playbooks_active_total",
		Help:        "Total number of active playbooks.",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.playbooksActiveTotal)

	m.runsActiveTotal = prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemPlaybooks,
		Name:        "runs_active_total",
		Help:        "Total number of active runs.",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.runsActiveTotal)

	m.remindersOutstandingTotal = prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemPlaybooks,
		Name:        "reminders_outstanding_total",
		Help:        "Total number of outstanding reminders.",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.remindersOutstandingTotal)

	m.remindersOutstandingTotal = prometheus.NewGauge(prometheus.GaugeOpts{
		Namespace:   MetricsNamespace,
		Subsystem:   MetricsSubsystemPlaybooks,
		Name:        "retros_outstanding_total",
		Help:        "Total number of outstanding retrospectives.",
		ConstLabels: additionalLabels,
	})
	m.registry.MustRegister(m.remindersOutstandingTotal)

	return m
}

func (m *Metrics) IncrementPlaybookCreatedTotal(num int) {
	if m != nil {
		m.playbooksCreatedTotal.Add(float64(num))
	}
}

func (m *Metrics) IncrementPlaybookArchivedTotal(num int) {
	if m != nil {
		m.playbooksArchivedTotal.Add(float64(num))
	}
}

func (m *Metrics) IncrementPlaybookRestoredTotal(num int) {
	if m != nil {
		m.playbooksRestoredTotal.Add(float64(num))
	}
}

func (m *Metrics) IncrementRunsCreatedTotal(num int) {
	if m != nil {
		m.runsCreatedTotal.Add(float64(num))
	}
}

func (m *Metrics) IncrementRunsFinishedTotal(num int) {
	if m != nil {
		m.runsFinishedTotal.Add(float64(num))
	}
}

func (m *Metrics) IncrementErrorsTotal(num int) {
	if m != nil {
		m.errorsTotal.Add(float64(num))
	}
}

func (m *Metrics) ObservePlaybooksActiveTotal(count int64) {
	if m != nil {
		m.playbooksActiveTotal.Set(float64(count))
	}
}

func (m *Metrics) ObserveRunsActiveTotal(count int64) {
	if m != nil {
		m.runsActiveTotal.Set(float64(count))
	}
}

func (m *Metrics) ObserveRemindersOutstandingTotal(count int64) {
	if m != nil {
		m.remindersOutstandingTotal.Set(float64(count))
	}
}

func (m *Metrics) ObserveRetrosOutstandingTotal(count int64) {
	if m != nil {
		m.retrosOutstandingTotal.Set(float64(count))
	}
}
