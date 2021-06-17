// Code generated by MockGen. DO NOT EDIT.
// Source: github.com/mattermost/mattermost-plugin-incident-collaboration/server/playbook (interfaces: Service)

// Package mock_playbook is a generated GoMock package.
package mock_playbook

import (
	gomock "github.com/golang/mock/gomock"
	playbook "github.com/mattermost/mattermost-plugin-incident-collaboration/server/playbook"
	model "github.com/mattermost/mattermost-server/v5/model"
	reflect "reflect"
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

// Create mocks base method
func (m *MockService) Create(arg0 playbook.Playbook, arg1 string) (string, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "Create", arg0, arg1)
	ret0, _ := ret[0].(string)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// Create indicates an expected call of Create
func (mr *MockServiceMockRecorder) Create(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "Create", reflect.TypeOf((*MockService)(nil).Create), arg0, arg1)
}

// Delete mocks base method
func (m *MockService) Delete(arg0 playbook.Playbook, arg1 string) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "Delete", arg0, arg1)
	ret0, _ := ret[0].(error)
	return ret0
}

// Delete indicates an expected call of Delete
func (mr *MockServiceMockRecorder) Delete(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "Delete", reflect.TypeOf((*MockService)(nil).Delete), arg0, arg1)
}

// Get mocks base method
func (m *MockService) Get(arg0 string) (playbook.Playbook, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "Get", arg0)
	ret0, _ := ret[0].(playbook.Playbook)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// Get indicates an expected call of Get
func (mr *MockServiceMockRecorder) Get(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "Get", reflect.TypeOf((*MockService)(nil).Get), arg0)
}

// GetNumPlaybooksForTeam mocks base method
func (m *MockService) GetNumPlaybooksForTeam(arg0 string) (int, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetNumPlaybooksForTeam", arg0)
	ret0, _ := ret[0].(int)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetNumPlaybooksForTeam indicates an expected call of GetNumPlaybooksForTeam
func (mr *MockServiceMockRecorder) GetNumPlaybooksForTeam(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetNumPlaybooksForTeam", reflect.TypeOf((*MockService)(nil).GetNumPlaybooksForTeam), arg0)
}

// GetPlaybooks mocks base method
func (m *MockService) GetPlaybooks() ([]playbook.Playbook, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetPlaybooks")
	ret0, _ := ret[0].([]playbook.Playbook)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetPlaybooks indicates an expected call of GetPlaybooks
func (mr *MockServiceMockRecorder) GetPlaybooks() *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetPlaybooks", reflect.TypeOf((*MockService)(nil).GetPlaybooks))
}

// GetPlaybooksForTeam mocks base method
func (m *MockService) GetPlaybooksForTeam(arg0 playbook.RequesterInfo, arg1 string, arg2 playbook.Options) (playbook.GetPlaybooksResults, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetPlaybooksForTeam", arg0, arg1, arg2)
	ret0, _ := ret[0].(playbook.GetPlaybooksResults)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetPlaybooksForTeam indicates an expected call of GetPlaybooksForTeam
func (mr *MockServiceMockRecorder) GetPlaybooksForTeam(arg0, arg1, arg2 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetPlaybooksForTeam", reflect.TypeOf((*MockService)(nil).GetPlaybooksForTeam), arg0, arg1, arg2)
}

// GetSuggestedPlaybooks mocks base method
func (m *MockService) GetSuggestedPlaybooks(arg0, arg1, arg2 string) ([]*playbook.CachedPlaybook, []string) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetSuggestedPlaybooks", arg0, arg1, arg2)
	ret0, _ := ret[0].([]*playbook.CachedPlaybook)
	ret1, _ := ret[1].([]string)
	return ret0, ret1
}

// GetSuggestedPlaybooks indicates an expected call of GetSuggestedPlaybooks
func (mr *MockServiceMockRecorder) GetSuggestedPlaybooks(arg0, arg1, arg2 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetSuggestedPlaybooks", reflect.TypeOf((*MockService)(nil).GetSuggestedPlaybooks), arg0, arg1, arg2)
}

// MessageHasBeenPosted mocks base method
func (m *MockService) MessageHasBeenPosted(arg0 string, arg1 *model.Post) {
	m.ctrl.T.Helper()
	m.ctrl.Call(m, "MessageHasBeenPosted", arg0, arg1)
}

// MessageHasBeenPosted indicates an expected call of MessageHasBeenPosted
func (mr *MockServiceMockRecorder) MessageHasBeenPosted(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "MessageHasBeenPosted", reflect.TypeOf((*MockService)(nil).MessageHasBeenPosted), arg0, arg1)
}

// Update mocks base method
func (m *MockService) Update(arg0 playbook.Playbook, arg1 string) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "Update", arg0, arg1)
	ret0, _ := ret[0].(error)
	return ret0
}

// Update indicates an expected call of Update
func (mr *MockServiceMockRecorder) Update(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "Update", reflect.TypeOf((*MockService)(nil).Update), arg0, arg1)
}
