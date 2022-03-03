// Code generated by MockGen. DO NOT EDIT.
// Source: github.com/mattermost/mattermost-plugin-playbooks/server/bot (interfaces: Poster)

// Package mock_bot is a generated GoMock package.
package mock_bot

import (
	gomock "github.com/golang/mock/gomock"
	model "github.com/mattermost/mattermost-server/v6/model"
	reflect "reflect"
)

// MockPoster is a mock of Poster interface
type MockPoster struct {
	ctrl     *gomock.Controller
	recorder *MockPosterMockRecorder
}

// MockPosterMockRecorder is the mock recorder for MockPoster
type MockPosterMockRecorder struct {
	mock *MockPoster
}

// NewMockPoster creates a new mock instance
func NewMockPoster(ctrl *gomock.Controller) *MockPoster {
	mock := &MockPoster{ctrl: ctrl}
	mock.recorder = &MockPosterMockRecorder{mock}
	return mock
}

// EXPECT returns an object that allows the caller to indicate expected use
func (m *MockPoster) EXPECT() *MockPosterMockRecorder {
	return m.recorder
}

// DM mocks base method
func (m *MockPoster) DM(arg0 string, arg1 *model.Post) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "DM", arg0, arg1)
	ret0, _ := ret[0].(error)
	return ret0
}

// DM indicates an expected call of DM
func (mr *MockPosterMockRecorder) DM(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "DM", reflect.TypeOf((*MockPoster)(nil).DM), arg0, arg1)
}

// EphemeralPost mocks base method
func (m *MockPoster) EphemeralPost(arg0, arg1 string, arg2 *model.Post) {
	m.ctrl.T.Helper()
	m.ctrl.Call(m, "EphemeralPost", arg0, arg1, arg2)
}

// EphemeralPost indicates an expected call of EphemeralPost
func (mr *MockPosterMockRecorder) EphemeralPost(arg0, arg1, arg2 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "EphemeralPost", reflect.TypeOf((*MockPoster)(nil).EphemeralPost), arg0, arg1, arg2)
}

// EphemeralPostWithAttachments mocks base method
func (m *MockPoster) EphemeralPostWithAttachments(arg0, arg1, arg2 string, arg3 []*model.SlackAttachment, arg4 string, arg5 ...interface{}) {
	m.ctrl.T.Helper()
	varargs := []interface{}{arg0, arg1, arg2, arg3, arg4}
	for _, a := range arg5 {
		varargs = append(varargs, a)
	}
	m.ctrl.Call(m, "EphemeralPostWithAttachments", varargs...)
}

// EphemeralPostWithAttachments indicates an expected call of EphemeralPostWithAttachments
func (mr *MockPosterMockRecorder) EphemeralPostWithAttachments(arg0, arg1, arg2, arg3, arg4 interface{}, arg5 ...interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	varargs := append([]interface{}{arg0, arg1, arg2, arg3, arg4}, arg5...)
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "EphemeralPostWithAttachments", reflect.TypeOf((*MockPoster)(nil).EphemeralPostWithAttachments), varargs...)
}

// NotifyAdmins mocks base method
func (m *MockPoster) NotifyAdmins(arg0, arg1 string, arg2 bool) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "NotifyAdmins", arg0, arg1, arg2)
	ret0, _ := ret[0].(error)
	return ret0
}

// NotifyAdmins indicates an expected call of NotifyAdmins
func (mr *MockPosterMockRecorder) NotifyAdmins(arg0, arg1, arg2 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "NotifyAdmins", reflect.TypeOf((*MockPoster)(nil).NotifyAdmins), arg0, arg1, arg2)
}

// Post mocks base method
func (m *MockPoster) Post(arg0 *model.Post) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "Post", arg0)
	ret0, _ := ret[0].(error)
	return ret0
}

// Post indicates an expected call of Post
func (mr *MockPosterMockRecorder) Post(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "Post", reflect.TypeOf((*MockPoster)(nil).Post), arg0)
}

// PostCustomMessageWithAttachments mocks base method
func (m *MockPoster) PostCustomMessageWithAttachments(arg0, arg1 string, arg2 []*model.SlackAttachment, arg3 string, arg4 ...interface{}) (*model.Post, error) {
	m.ctrl.T.Helper()
	varargs := []interface{}{arg0, arg1, arg2, arg3}
	for _, a := range arg4 {
		varargs = append(varargs, a)
	}
	ret := m.ctrl.Call(m, "PostCustomMessageWithAttachments", varargs...)
	ret0, _ := ret[0].(*model.Post)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// PostCustomMessageWithAttachments indicates an expected call of PostCustomMessageWithAttachments
func (mr *MockPosterMockRecorder) PostCustomMessageWithAttachments(arg0, arg1, arg2, arg3 interface{}, arg4 ...interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	varargs := append([]interface{}{arg0, arg1, arg2, arg3}, arg4...)
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "PostCustomMessageWithAttachments", reflect.TypeOf((*MockPoster)(nil).PostCustomMessageWithAttachments), varargs...)
}

// PostMessage mocks base method
func (m *MockPoster) PostMessage(arg0, arg1 string, arg2 ...interface{}) (*model.Post, error) {
	m.ctrl.T.Helper()
	varargs := []interface{}{arg0, arg1}
	for _, a := range arg2 {
		varargs = append(varargs, a)
	}
	ret := m.ctrl.Call(m, "PostMessage", varargs...)
	ret0, _ := ret[0].(*model.Post)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// PostMessage indicates an expected call of PostMessage
func (mr *MockPosterMockRecorder) PostMessage(arg0, arg1 interface{}, arg2 ...interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	varargs := append([]interface{}{arg0, arg1}, arg2...)
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "PostMessage", reflect.TypeOf((*MockPoster)(nil).PostMessage), varargs...)
}

// PostMessageToThread mocks base method
func (m *MockPoster) PostMessageToThread(arg0 string, arg1 *model.Post) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "PostMessageToThread", arg0, arg1)
	ret0, _ := ret[0].(error)
	return ret0
}

// PostMessageToThread indicates an expected call of PostMessageToThread
func (mr *MockPosterMockRecorder) PostMessageToThread(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "PostMessageToThread", reflect.TypeOf((*MockPoster)(nil).PostMessageToThread), arg0, arg1)
}

// PostMessageWithAttachments mocks base method
func (m *MockPoster) PostMessageWithAttachments(arg0 string, arg1 []*model.SlackAttachment, arg2 string, arg3 ...interface{}) (*model.Post, error) {
	m.ctrl.T.Helper()
	varargs := []interface{}{arg0, arg1, arg2}
	for _, a := range arg3 {
		varargs = append(varargs, a)
	}
	ret := m.ctrl.Call(m, "PostMessageWithAttachments", varargs...)
	ret0, _ := ret[0].(*model.Post)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// PostMessageWithAttachments indicates an expected call of PostMessageWithAttachments
func (mr *MockPosterMockRecorder) PostMessageWithAttachments(arg0, arg1, arg2 interface{}, arg3 ...interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	varargs := append([]interface{}{arg0, arg1, arg2}, arg3...)
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "PostMessageWithAttachments", reflect.TypeOf((*MockPoster)(nil).PostMessageWithAttachments), varargs...)
}

// PromptForFeedback mocks base method
func (m *MockPoster) PromptForFeedback(arg0 string) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "PromptForFeedback", arg0)
	ret0, _ := ret[0].(error)
	return ret0
}

// PromptForFeedback indicates an expected call of PromptForFeedback
func (mr *MockPosterMockRecorder) PromptForFeedback(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "PromptForFeedback", reflect.TypeOf((*MockPoster)(nil).PromptForFeedback), arg0)
}

// PublishWebsocketEventToChannel mocks base method
func (m *MockPoster) PublishWebsocketEventToChannel(arg0 string, arg1 interface{}, arg2 string) {
	m.ctrl.T.Helper()
	m.ctrl.Call(m, "PublishWebsocketEventToChannel", arg0, arg1, arg2)
}

// PublishWebsocketEventToChannel indicates an expected call of PublishWebsocketEventToChannel
func (mr *MockPosterMockRecorder) PublishWebsocketEventToChannel(arg0, arg1, arg2 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "PublishWebsocketEventToChannel", reflect.TypeOf((*MockPoster)(nil).PublishWebsocketEventToChannel), arg0, arg1, arg2)
}

// PublishWebsocketEventToTeam mocks base method
func (m *MockPoster) PublishWebsocketEventToTeam(arg0 string, arg1 interface{}, arg2 string) {
	m.ctrl.T.Helper()
	m.ctrl.Call(m, "PublishWebsocketEventToTeam", arg0, arg1, arg2)
}

// PublishWebsocketEventToTeam indicates an expected call of PublishWebsocketEventToTeam
func (mr *MockPosterMockRecorder) PublishWebsocketEventToTeam(arg0, arg1, arg2 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "PublishWebsocketEventToTeam", reflect.TypeOf((*MockPoster)(nil).PublishWebsocketEventToTeam), arg0, arg1, arg2)
}

// PublishWebsocketEventToUser mocks base method
func (m *MockPoster) PublishWebsocketEventToUser(arg0 string, arg1 interface{}, arg2 string) {
	m.ctrl.T.Helper()
	m.ctrl.Call(m, "PublishWebsocketEventToUser", arg0, arg1, arg2)
}

// PublishWebsocketEventToUser indicates an expected call of PublishWebsocketEventToUser
func (mr *MockPosterMockRecorder) PublishWebsocketEventToUser(arg0, arg1, arg2 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "PublishWebsocketEventToUser", reflect.TypeOf((*MockPoster)(nil).PublishWebsocketEventToUser), arg0, arg1, arg2)
}

// SystemEphemeralPost mocks base method
func (m *MockPoster) SystemEphemeralPost(arg0, arg1 string, arg2 *model.Post) {
	m.ctrl.T.Helper()
	m.ctrl.Call(m, "SystemEphemeralPost", arg0, arg1, arg2)
}

// SystemEphemeralPost indicates an expected call of SystemEphemeralPost
func (mr *MockPosterMockRecorder) SystemEphemeralPost(arg0, arg1, arg2 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "SystemEphemeralPost", reflect.TypeOf((*MockPoster)(nil).SystemEphemeralPost), arg0, arg1, arg2)
}
