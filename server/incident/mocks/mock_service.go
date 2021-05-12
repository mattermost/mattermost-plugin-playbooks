// Code generated by MockGen. DO NOT EDIT.
// Source: github.com/mattermost/mattermost-plugin-incident-collaboration/server/incident (interfaces: Service)

// Package mock_incident is a generated GoMock package.
package mock_incident

import (
	gomock "github.com/golang/mock/gomock"
	incident "github.com/mattermost/mattermost-plugin-incident-collaboration/server/incident"
	permissions "github.com/mattermost/mattermost-plugin-incident-collaboration/server/permissions"
	playbook "github.com/mattermost/mattermost-plugin-incident-collaboration/server/playbook"
	model "github.com/mattermost/mattermost-server/v5/model"
	reflect "reflect"
	time "time"
)

// MockService is a mock of Service interface
type MockService struct {
	ctrl     *gomock.Controller
	recorder *MockServiceMockRecorder
}

// MockServiceMockRecorder is the mock recorder for MockService
type MockServiceMockRecorder struct {
	mock *MockService
}

// NewMockService creates a new mock instance
func NewMockService(ctrl *gomock.Controller) *MockService {
	mock := &MockService{ctrl: ctrl}
	mock.recorder = &MockServiceMockRecorder{mock}
	return mock
}

// EXPECT returns an object that allows the caller to indicate expected use
func (m *MockService) EXPECT() *MockServiceMockRecorder {
	return m.recorder
}

// AddChecklistItem mocks base method
func (m *MockService) AddChecklistItem(arg0, arg1 string, arg2 int, arg3 playbook.ChecklistItem) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "AddChecklistItem", arg0, arg1, arg2, arg3)
	ret0, _ := ret[0].(error)
	return ret0
}

// AddChecklistItem indicates an expected call of AddChecklistItem
func (mr *MockServiceMockRecorder) AddChecklistItem(arg0, arg1, arg2, arg3 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "AddChecklistItem", reflect.TypeOf((*MockService)(nil).AddChecklistItem), arg0, arg1, arg2, arg3)
}

// AddPostToTimeline mocks base method
func (m *MockService) AddPostToTimeline(arg0, arg1, arg2, arg3 string) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "AddPostToTimeline", arg0, arg1, arg2, arg3)
	ret0, _ := ret[0].(error)
	return ret0
}

// AddPostToTimeline indicates an expected call of AddPostToTimeline
func (mr *MockServiceMockRecorder) AddPostToTimeline(arg0, arg1, arg2, arg3 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "AddPostToTimeline", reflect.TypeOf((*MockService)(nil).AddPostToTimeline), arg0, arg1, arg2, arg3)
}

// ChangeCommander mocks base method
func (m *MockService) ChangeCommander(arg0, arg1, arg2 string) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "ChangeCommander", arg0, arg1, arg2)
	ret0, _ := ret[0].(error)
	return ret0
}

// ChangeCommander indicates an expected call of ChangeCommander
func (mr *MockServiceMockRecorder) ChangeCommander(arg0, arg1, arg2 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "ChangeCommander", reflect.TypeOf((*MockService)(nil).ChangeCommander), arg0, arg1, arg2)
}

// ChangeCreationDate mocks base method
func (m *MockService) ChangeCreationDate(arg0 string, arg1 time.Time) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "ChangeCreationDate", arg0, arg1)
	ret0, _ := ret[0].(error)
	return ret0
}

// ChangeCreationDate indicates an expected call of ChangeCreationDate
func (mr *MockServiceMockRecorder) ChangeCreationDate(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "ChangeCreationDate", reflect.TypeOf((*MockService)(nil).ChangeCreationDate), arg0, arg1)
}

// CreateIncident mocks base method
func (m *MockService) CreateIncident(arg0 *incident.Incident, arg1 *playbook.Playbook, arg2 string, arg3 bool) (*incident.Incident, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "CreateIncident", arg0, arg1, arg2, arg3)
	ret0, _ := ret[0].(*incident.Incident)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// CreateIncident indicates an expected call of CreateIncident
func (mr *MockServiceMockRecorder) CreateIncident(arg0, arg1, arg2, arg3 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "CreateIncident", reflect.TypeOf((*MockService)(nil).CreateIncident), arg0, arg1, arg2, arg3)
}

// EditChecklistItem mocks base method
func (m *MockService) EditChecklistItem(arg0, arg1 string, arg2, arg3 int, arg4, arg5, arg6 string) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "EditChecklistItem", arg0, arg1, arg2, arg3, arg4, arg5, arg6)
	ret0, _ := ret[0].(error)
	return ret0
}

// EditChecklistItem indicates an expected call of EditChecklistItem
func (mr *MockServiceMockRecorder) EditChecklistItem(arg0, arg1, arg2, arg3, arg4, arg5, arg6 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "EditChecklistItem", reflect.TypeOf((*MockService)(nil).EditChecklistItem), arg0, arg1, arg2, arg3, arg4, arg5, arg6)
}

// GetChecklistAutocomplete mocks base method
func (m *MockService) GetChecklistAutocomplete(arg0 string) ([]model.AutocompleteListItem, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetChecklistAutocomplete", arg0)
	ret0, _ := ret[0].([]model.AutocompleteListItem)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetChecklistAutocomplete indicates an expected call of GetChecklistAutocomplete
func (mr *MockServiceMockRecorder) GetChecklistAutocomplete(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetChecklistAutocomplete", reflect.TypeOf((*MockService)(nil).GetChecklistAutocomplete), arg0)
}

// GetChecklistItemAutocomplete mocks base method
func (m *MockService) GetChecklistItemAutocomplete(arg0 string) ([]model.AutocompleteListItem, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetChecklistItemAutocomplete", arg0)
	ret0, _ := ret[0].([]model.AutocompleteListItem)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetChecklistItemAutocomplete indicates an expected call of GetChecklistItemAutocomplete
func (mr *MockServiceMockRecorder) GetChecklistItemAutocomplete(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetChecklistItemAutocomplete", reflect.TypeOf((*MockService)(nil).GetChecklistItemAutocomplete), arg0)
}

// GetCommanders mocks base method
func (m *MockService) GetCommanders(arg0 permissions.RequesterInfo, arg1 incident.FilterOptions) ([]incident.CommanderInfo, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetCommanders", arg0, arg1)
	ret0, _ := ret[0].([]incident.CommanderInfo)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetCommanders indicates an expected call of GetCommanders
func (mr *MockServiceMockRecorder) GetCommanders(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetCommanders", reflect.TypeOf((*MockService)(nil).GetCommanders), arg0, arg1)
}

// GetIncident mocks base method
func (m *MockService) GetIncident(arg0 string) (*incident.Incident, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetIncident", arg0)
	ret0, _ := ret[0].(*incident.Incident)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetIncident indicates an expected call of GetIncident
func (mr *MockServiceMockRecorder) GetIncident(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetIncident", reflect.TypeOf((*MockService)(nil).GetIncident), arg0)
}

// GetIncidentIDForChannel mocks base method
func (m *MockService) GetIncidentIDForChannel(arg0 string) (string, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetIncidentIDForChannel", arg0)
	ret0, _ := ret[0].(string)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetIncidentIDForChannel indicates an expected call of GetIncidentIDForChannel
func (mr *MockServiceMockRecorder) GetIncidentIDForChannel(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetIncidentIDForChannel", reflect.TypeOf((*MockService)(nil).GetIncidentIDForChannel), arg0)
}

// GetIncidentMetadata mocks base method
func (m *MockService) GetIncidentMetadata(arg0 string) (*incident.Metadata, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetIncidentMetadata", arg0)
	ret0, _ := ret[0].(*incident.Metadata)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetIncidentMetadata indicates an expected call of GetIncidentMetadata
func (mr *MockServiceMockRecorder) GetIncidentMetadata(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetIncidentMetadata", reflect.TypeOf((*MockService)(nil).GetIncidentMetadata), arg0)
}

// GetIncidents mocks base method
func (m *MockService) GetIncidents(arg0 permissions.RequesterInfo, arg1 incident.FilterOptions) (*incident.GetIncidentsResults, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetIncidents", arg0, arg1)
	ret0, _ := ret[0].(*incident.GetIncidentsResults)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetIncidents indicates an expected call of GetIncidents
func (mr *MockServiceMockRecorder) GetIncidents(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetIncidents", reflect.TypeOf((*MockService)(nil).GetIncidents), arg0, arg1)
}

// HandleReminder mocks base method
func (m *MockService) HandleReminder(arg0 string) {
	m.ctrl.T.Helper()
	m.ctrl.Call(m, "HandleReminder", arg0)
}

// HandleReminder indicates an expected call of HandleReminder
func (mr *MockServiceMockRecorder) HandleReminder(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "HandleReminder", reflect.TypeOf((*MockService)(nil).HandleReminder), arg0)
}

// IsCommander mocks base method
func (m *MockService) IsCommander(arg0, arg1 string) bool {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "IsCommander", arg0, arg1)
	ret0, _ := ret[0].(bool)
	return ret0
}

// IsCommander indicates an expected call of IsCommander
func (mr *MockServiceMockRecorder) IsCommander(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "IsCommander", reflect.TypeOf((*MockService)(nil).IsCommander), arg0, arg1)
}

// ModifyCheckedState mocks base method
func (m *MockService) ModifyCheckedState(arg0, arg1, arg2 string, arg3, arg4 int) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "ModifyCheckedState", arg0, arg1, arg2, arg3, arg4)
	ret0, _ := ret[0].(error)
	return ret0
}

// ModifyCheckedState indicates an expected call of ModifyCheckedState
func (mr *MockServiceMockRecorder) ModifyCheckedState(arg0, arg1, arg2, arg3, arg4 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "ModifyCheckedState", reflect.TypeOf((*MockService)(nil).ModifyCheckedState), arg0, arg1, arg2, arg3, arg4)
}

// MoveChecklistItem mocks base method
func (m *MockService) MoveChecklistItem(arg0, arg1 string, arg2, arg3, arg4 int) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "MoveChecklistItem", arg0, arg1, arg2, arg3, arg4)
	ret0, _ := ret[0].(error)
	return ret0
}

// MoveChecklistItem indicates an expected call of MoveChecklistItem
func (mr *MockServiceMockRecorder) MoveChecklistItem(arg0, arg1, arg2, arg3, arg4 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "MoveChecklistItem", reflect.TypeOf((*MockService)(nil).MoveChecklistItem), arg0, arg1, arg2, arg3, arg4)
}

// NukeDB mocks base method
func (m *MockService) NukeDB() error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "NukeDB")
	ret0, _ := ret[0].(error)
	return ret0
}

// NukeDB indicates an expected call of NukeDB
func (mr *MockServiceMockRecorder) NukeDB() *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "NukeDB", reflect.TypeOf((*MockService)(nil).NukeDB))
}

// OpenAddChecklistItemDialog mocks base method
func (m *MockService) OpenAddChecklistItemDialog(arg0, arg1 string, arg2 int) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "OpenAddChecklistItemDialog", arg0, arg1, arg2)
	ret0, _ := ret[0].(error)
	return ret0
}

// OpenAddChecklistItemDialog indicates an expected call of OpenAddChecklistItemDialog
func (mr *MockServiceMockRecorder) OpenAddChecklistItemDialog(arg0, arg1, arg2 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "OpenAddChecklistItemDialog", reflect.TypeOf((*MockService)(nil).OpenAddChecklistItemDialog), arg0, arg1, arg2)
}

// OpenAddToTimelineDialog mocks base method
func (m *MockService) OpenAddToTimelineDialog(arg0 permissions.RequesterInfo, arg1, arg2, arg3 string) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "OpenAddToTimelineDialog", arg0, arg1, arg2, arg3)
	ret0, _ := ret[0].(error)
	return ret0
}

// OpenAddToTimelineDialog indicates an expected call of OpenAddToTimelineDialog
func (mr *MockServiceMockRecorder) OpenAddToTimelineDialog(arg0, arg1, arg2, arg3 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "OpenAddToTimelineDialog", reflect.TypeOf((*MockService)(nil).OpenAddToTimelineDialog), arg0, arg1, arg2, arg3)
}

// OpenCreateIncidentDialog mocks base method
func (m *MockService) OpenCreateIncidentDialog(arg0, arg1, arg2, arg3, arg4 string, arg5 []playbook.Playbook, arg6 bool) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "OpenCreateIncidentDialog", arg0, arg1, arg2, arg3, arg4, arg5, arg6)
	ret0, _ := ret[0].(error)
	return ret0
}

// OpenCreateIncidentDialog indicates an expected call of OpenCreateIncidentDialog
func (mr *MockServiceMockRecorder) OpenCreateIncidentDialog(arg0, arg1, arg2, arg3, arg4, arg5, arg6 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "OpenCreateIncidentDialog", reflect.TypeOf((*MockService)(nil).OpenCreateIncidentDialog), arg0, arg1, arg2, arg3, arg4, arg5, arg6)
}

// OpenUpdateStatusDialog mocks base method
func (m *MockService) OpenUpdateStatusDialog(arg0, arg1 string) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "OpenUpdateStatusDialog", arg0, arg1)
	ret0, _ := ret[0].(error)
	return ret0
}

// OpenUpdateStatusDialog indicates an expected call of OpenUpdateStatusDialog
func (mr *MockServiceMockRecorder) OpenUpdateStatusDialog(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "OpenUpdateStatusDialog", reflect.TypeOf((*MockService)(nil).OpenUpdateStatusDialog), arg0, arg1)
}

// PublishRetrospective mocks base method
func (m *MockService) PublishRetrospective(arg0, arg1 string) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "PublishRetrospective", arg0, arg1)
	ret0, _ := ret[0].(error)
	return ret0
}

// PublishRetrospective indicates an expected call of PublishRetrospective
func (mr *MockServiceMockRecorder) PublishRetrospective(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "PublishRetrospective", reflect.TypeOf((*MockService)(nil).PublishRetrospective), arg0, arg1)
}

// RemoveChecklistItem mocks base method
func (m *MockService) RemoveChecklistItem(arg0, arg1 string, arg2, arg3 int) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "RemoveChecklistItem", arg0, arg1, arg2, arg3)
	ret0, _ := ret[0].(error)
	return ret0
}

// RemoveChecklistItem indicates an expected call of RemoveChecklistItem
func (mr *MockServiceMockRecorder) RemoveChecklistItem(arg0, arg1, arg2, arg3 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "RemoveChecklistItem", reflect.TypeOf((*MockService)(nil).RemoveChecklistItem), arg0, arg1, arg2, arg3)
}

// RemoveReminder mocks base method
func (m *MockService) RemoveReminder(arg0 string) {
	m.ctrl.T.Helper()
	m.ctrl.Call(m, "RemoveReminder", arg0)
}

// RemoveReminder indicates an expected call of RemoveReminder
func (mr *MockServiceMockRecorder) RemoveReminder(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "RemoveReminder", reflect.TypeOf((*MockService)(nil).RemoveReminder), arg0)
}

// RemoveReminderPost mocks base method
func (m *MockService) RemoveReminderPost(arg0 string) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "RemoveReminderPost", arg0)
	ret0, _ := ret[0].(error)
	return ret0
}

// RemoveReminderPost indicates an expected call of RemoveReminderPost
func (mr *MockServiceMockRecorder) RemoveReminderPost(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "RemoveReminderPost", reflect.TypeOf((*MockService)(nil).RemoveReminderPost), arg0)
}

// RemoveTimelineEvent mocks base method
func (m *MockService) RemoveTimelineEvent(arg0, arg1, arg2 string) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "RemoveTimelineEvent", arg0, arg1, arg2)
	ret0, _ := ret[0].(error)
	return ret0
}

// RemoveTimelineEvent indicates an expected call of RemoveTimelineEvent
func (mr *MockServiceMockRecorder) RemoveTimelineEvent(arg0, arg1, arg2 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "RemoveTimelineEvent", reflect.TypeOf((*MockService)(nil).RemoveTimelineEvent), arg0, arg1, arg2)
}

// RunChecklistItemSlashCommand mocks base method
func (m *MockService) RunChecklistItemSlashCommand(arg0, arg1 string, arg2, arg3 int) (string, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "RunChecklistItemSlashCommand", arg0, arg1, arg2, arg3)
	ret0, _ := ret[0].(string)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// RunChecklistItemSlashCommand indicates an expected call of RunChecklistItemSlashCommand
func (mr *MockServiceMockRecorder) RunChecklistItemSlashCommand(arg0, arg1, arg2, arg3 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "RunChecklistItemSlashCommand", reflect.TypeOf((*MockService)(nil).RunChecklistItemSlashCommand), arg0, arg1, arg2, arg3)
}

// SetAssignee mocks base method
func (m *MockService) SetAssignee(arg0, arg1, arg2 string, arg3, arg4 int) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "SetAssignee", arg0, arg1, arg2, arg3, arg4)
	ret0, _ := ret[0].(error)
	return ret0
}

// SetAssignee indicates an expected call of SetAssignee
func (mr *MockServiceMockRecorder) SetAssignee(arg0, arg1, arg2, arg3, arg4 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "SetAssignee", reflect.TypeOf((*MockService)(nil).SetAssignee), arg0, arg1, arg2, arg3, arg4)
}

// SetReminder mocks base method
func (m *MockService) SetReminder(arg0 string, arg1 time.Duration) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "SetReminder", arg0, arg1)
	ret0, _ := ret[0].(error)
	return ret0
}

// SetReminder indicates an expected call of SetReminder
func (mr *MockServiceMockRecorder) SetReminder(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "SetReminder", reflect.TypeOf((*MockService)(nil).SetReminder), arg0, arg1)
}

// ToggleCheckedState mocks base method
func (m *MockService) ToggleCheckedState(arg0, arg1 string, arg2, arg3 int) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "ToggleCheckedState", arg0, arg1, arg2, arg3)
	ret0, _ := ret[0].(error)
	return ret0
}

// ToggleCheckedState indicates an expected call of ToggleCheckedState
func (mr *MockServiceMockRecorder) ToggleCheckedState(arg0, arg1, arg2, arg3 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "ToggleCheckedState", reflect.TypeOf((*MockService)(nil).ToggleCheckedState), arg0, arg1, arg2, arg3)
}

// UpdateRetrospective mocks base method
func (m *MockService) UpdateRetrospective(arg0, arg1, arg2 string) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "UpdateRetrospective", arg0, arg1, arg2)
	ret0, _ := ret[0].(error)
	return ret0
}

// UpdateRetrospective indicates an expected call of UpdateRetrospective
func (mr *MockServiceMockRecorder) UpdateRetrospective(arg0, arg1, arg2 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "UpdateRetrospective", reflect.TypeOf((*MockService)(nil).UpdateRetrospective), arg0, arg1, arg2)
}

// UpdateStatus mocks base method
func (m *MockService) UpdateStatus(arg0, arg1 string, arg2 incident.StatusUpdateOptions) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "UpdateStatus", arg0, arg1, arg2)
	ret0, _ := ret[0].(error)
	return ret0
}

// UpdateStatus indicates an expected call of UpdateStatus
func (mr *MockServiceMockRecorder) UpdateStatus(arg0, arg1, arg2 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "UpdateStatus", reflect.TypeOf((*MockService)(nil).UpdateStatus), arg0, arg1, arg2)
}

// UserHasJoinedChannel mocks base method
func (m *MockService) UserHasJoinedChannel(arg0, arg1, arg2 string) {
	m.ctrl.T.Helper()
	m.ctrl.Call(m, "UserHasJoinedChannel", arg0, arg1, arg2)
}

// UserHasJoinedChannel indicates an expected call of UserHasJoinedChannel
func (mr *MockServiceMockRecorder) UserHasJoinedChannel(arg0, arg1, arg2 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "UserHasJoinedChannel", reflect.TypeOf((*MockService)(nil).UserHasJoinedChannel), arg0, arg1, arg2)
}

// UserHasLeftChannel mocks base method
func (m *MockService) UserHasLeftChannel(arg0, arg1, arg2 string) {
	m.ctrl.T.Helper()
	m.ctrl.Call(m, "UserHasLeftChannel", arg0, arg1, arg2)
}

// UserHasLeftChannel indicates an expected call of UserHasLeftChannel
func (mr *MockServiceMockRecorder) UserHasLeftChannel(arg0, arg1, arg2 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "UserHasLeftChannel", reflect.TypeOf((*MockService)(nil).UserHasLeftChannel), arg0, arg1, arg2)
}
