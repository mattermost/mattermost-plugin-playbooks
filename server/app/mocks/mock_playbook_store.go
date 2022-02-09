// Code generated by MockGen. DO NOT EDIT.
// Source: github.com/mattermost/mattermost-plugin-playbooks/server/app (interfaces: PlaybookStore)

// Package mock_app is a generated GoMock package.
package mock_app

import (
	gomock "github.com/golang/mock/gomock"
	app "github.com/mattermost/mattermost-plugin-playbooks/server/app"
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

// Archive mocks base method
func (m *MockPlaybookStore) Archive(arg0 string) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "Archive", arg0)
	ret0, _ := ret[0].(error)
	return ret0
}

// Archive indicates an expected call of Archive
func (mr *MockPlaybookStoreMockRecorder) Archive(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "Archive", reflect.TypeOf((*MockPlaybookStore)(nil).Archive), arg0)
}

// AutoFollow mocks base method
func (m *MockPlaybookStore) AutoFollow(arg0, arg1 string) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "AutoFollow", arg0, arg1)
	ret0, _ := ret[0].(error)
	return ret0
}

// AutoFollow indicates an expected call of AutoFollow
func (mr *MockPlaybookStoreMockRecorder) AutoFollow(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "AutoFollow", reflect.TypeOf((*MockPlaybookStore)(nil).AutoFollow), arg0, arg1)
}

// AutoUnfollow mocks base method
func (m *MockPlaybookStore) AutoUnfollow(arg0, arg1 string) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "AutoUnfollow", arg0, arg1)
	ret0, _ := ret[0].(error)
	return ret0
}

// AutoUnfollow indicates an expected call of AutoUnfollow
func (mr *MockPlaybookStoreMockRecorder) AutoUnfollow(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "AutoUnfollow", reflect.TypeOf((*MockPlaybookStore)(nil).AutoUnfollow), arg0, arg1)
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

// GetAutoFollows mocks base method
func (m *MockPlaybookStore) GetAutoFollows(arg0 string) ([]string, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetAutoFollows", arg0)
	ret0, _ := ret[0].([]string)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// GetAutoFollows indicates an expected call of GetAutoFollows
func (mr *MockPlaybookStoreMockRecorder) GetAutoFollows(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetAutoFollows", reflect.TypeOf((*MockPlaybookStore)(nil).GetAutoFollows), arg0)
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

// IsAutoFollowing mocks base method
func (m *MockPlaybookStore) IsAutoFollowing(arg0, arg1 string) (bool, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "IsAutoFollowing", arg0, arg1)
	ret0, _ := ret[0].(bool)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// IsAutoFollowing indicates an expected call of IsAutoFollowing
func (mr *MockPlaybookStoreMockRecorder) IsAutoFollowing(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "IsAutoFollowing", reflect.TypeOf((*MockPlaybookStore)(nil).IsAutoFollowing), arg0, arg1)
}

// Restore mocks base method
func (m *MockPlaybookStore) Restore(arg0 string) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "Restore", arg0)
	ret0, _ := ret[0].(error)
	return ret0
}

// Restore indicates an expected call of Restore
func (mr *MockPlaybookStoreMockRecorder) Restore(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "Restore", reflect.TypeOf((*MockPlaybookStore)(nil).Restore), arg0)
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
