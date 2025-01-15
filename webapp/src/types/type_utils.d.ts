// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

declare type Maybe<T> = T | undefined | null;

type DeepPartial<T> = {
    [P in keyof T]?: DeepPartial<T[P]>;
}
