// Code generated by MockGen. DO NOT EDIT.
// Source: github.com/mattermost/mattermost-plugin-incident-collaboration/server/app (interfaces: PlaybookStore)

// Package mock_app is a generated GoMock package.
package mock_app

import (
	gomock "github.com/golang/mock/gomock"
	app "github.com/mattermost/mattermost-plugin-incident-collaboration/server/app"
	reflect "reflect"
)

// MockPlaybookStore is a mock of PlaybookStore interface
type MockPlaybookStore struct {
	ctrl     *gomock.Controller
	recorder *MockPlaybookStoreMockRecorder
}

// MockPlaybookStoreMockRecorder is the mock recorder for MockPlaybookStore
type MockPlaybookStoreMockRecorder struct {
	mock *MockPlaybookStore
}

// NewMockPlaybookStore creates a new mock instance
func NewMockPlaybookStore(ctrl *gomock.Controller) *MockPlaybookStore {
	mock := &MockPlaybookStore{ctrl: ctrl}
	mock.recorder = &MockPlaybookStoreMockRecorder{mock}
	return mock
}

// EXPECT returns an object that allows the caller to indicate expected use
func (m *MockPlaybookStore) EXPECT() *MockPlaybookStoreMockRecorder {
	return m.recorder
}

// Create mocks base method
func (m *MockPlaybookStore) Create(arg0 app.Playbook) (string, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "Create", arg0)
	ret0, _ := ret[0].(string)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// Create indicates an expected call of Create
func (mr *MockPlaybookStoreMockRecorder) Create(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "Create", reflect.TypeOf((*MockPlaybookStore)(nil).Create), arg0)
}

// Delete mocks base method
func (m *MockPlaybookStore) Delete(arg0 string) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "Delete", arg0)
	ret0, _ := ret[0].(error)
	return ret0
}

// Delete indicates an expected call of Delete
func (mr *MockPlaybookStoreMockRecorder) Delete(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "Delete", reflect.TypeOf((*MockPlaybookStore)(nil).Delete), arg0)
}

// Get mocks base method
func (m *MockPlaybookStore) Get(arg0 string) (app.Playbook, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "Get", arg0)
	ret0, _ := ret[0].(app.Playbook)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// Get indicates an expected call of Get
func (mr *MockPlaybookStoreMockRecorder) Get(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "Get", reflect.TypeOf((*MockPlaybookStore)(nil).Get), arg0)
}

// GetNumPlaybooksForTeam mocks base method
func (m *MockPlaybookStore) GetNumPlaybooksForTeam(arg0 string) (int, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetNumPlaybooksForTeam", arg0)
	ret0, _ := ret[0].(int)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetNumPlaybooksForTeam indicates an expected call of GetNumPlaybooksForTeam
func (mr *MockPlaybookStoreMockRecorder) GetNumPlaybooksForTeam(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetNumPlaybooksForTeam", reflect.TypeOf((*MockPlaybookStore)(nil).GetNumPlaybooksForTeam), arg0)
}

// GetPlaybookIDsForUser mocks base method
func (m *MockPlaybookStore) GetPlaybookIDsForUser(arg0, arg1 string) ([]string, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetPlaybookIDsForUser", arg0, arg1)
	ret0, _ := ret[0].([]string)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetPlaybookIDsForUser indicates an expected call of GetPlaybookIDsForUser
func (mr *MockPlaybookStoreMockRecorder) GetPlaybookIDsForUser(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetPlaybookIDsForUser", reflect.TypeOf((*MockPlaybookStore)(nil).GetPlaybookIDsForUser), arg0, arg1)
}

// GetPlaybooks mocks base method
func (m *MockPlaybookStore) GetPlaybooks() ([]app.Playbook, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetPlaybooks")
	ret0, _ := ret[0].([]app.Playbook)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetPlaybooks indicates an expected call of GetPlaybooks
func (mr *MockPlaybookStoreMockRecorder) GetPlaybooks() *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetPlaybooks", reflect.TypeOf((*MockPlaybookStore)(nil).GetPlaybooks))
}

// GetPlaybooksForTeam mocks base method
func (m *MockPlaybookStore) GetPlaybooksForTeam(arg0 app.RequesterInfo, arg1 string, arg2 app.PlaybookFilterOptions) (app.GetPlaybooksResults, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetPlaybooksForTeam", arg0, arg1, arg2)
	ret0, _ := ret[0].(app.GetPlaybooksResults)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetPlaybooksForTeam indicates an expected call of GetPlaybooksForTeam
func (mr *MockPlaybookStoreMockRecorder) GetPlaybooksForTeam(arg0, arg1, arg2 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetPlaybooksForTeam", reflect.TypeOf((*MockPlaybookStore)(nil).GetPlaybooksForTeam), arg0, arg1, arg2)
}

// GetPlaybooksWithKeywords mocks base method
func (m *MockPlaybookStore) GetPlaybooksWithKeywords(arg0 app.PlaybookFilterOptions) ([]app.Playbook, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetPlaybooksWithKeywords", arg0)
	ret0, _ := ret[0].([]app.Playbook)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetPlaybooksWithKeywords indicates an expected call of GetPlaybooksWithKeywords
func (mr *MockPlaybookStoreMockRecorder) GetPlaybooksWithKeywords(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetPlaybooksWithKeywords", reflect.TypeOf((*MockPlaybookStore)(nil).GetPlaybooksWithKeywords), arg0)
}

// GetTimeLastUpdated mocks base method
func (m *MockPlaybookStore) GetTimeLastUpdated(arg0 bool) (int64, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetTimeLastUpdated", arg0)
	ret0, _ := ret[0].(int64)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetTimeLastUpdated indicates an expected call of GetTimeLastUpdated
func (mr *MockPlaybookStoreMockRecorder) GetTimeLastUpdated(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetTimeLastUpdated", reflect.TypeOf((*MockPlaybookStore)(nil).GetTimeLastUpdated), arg0)
}

// Update mocks base method
func (m *MockPlaybookStore) Update(arg0 app.Playbook) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "Update", arg0)
	ret0, _ := ret[0].(error)
	return ret0
}

// Update indicates an expected call of Update
func (mr *MockPlaybookStoreMockRecorder) Update(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "Update", reflect.TypeOf((*MockPlaybookStore)(nil).Update), arg0)
}
