// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

type userInfoService struct {
	store UserInfoStore
}

func NewUserInfoService(store UserInfoStore) UserInfoService {
	return &userInfoService{store: store}
}

// Get retrieves a UserInfo struct by the userID id.
func (s *userInfoService) Get(id string) (UserInfo, error) {
	return s.store.Get(id)
}

// Upsert inserts (creates) or updates the UserInfo struct.
func (s *userInfoService) Upsert(info UserInfo) error {
	return s.store.Upsert(info)
}
