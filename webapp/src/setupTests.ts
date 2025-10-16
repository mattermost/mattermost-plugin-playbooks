// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Redefine react-redux to make it "configurable" so that we can use jest.spyOn with it
// https://stackoverflow.com/questions/67872622/jest-spyon-not-working-on-index-file-cannot-redefine-property
jest.mock('react-redux', () => ({
    __esModule: true,
    ...jest.requireActual('react-redux'),
}));
