// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react';

import classNames from 'classnames';

export default function StatusBadge(props: { isActive: boolean }) {
    const badgeClass = classNames('badge', {
        ongoing: props.isActive,
    });
    const badgeText = props.isActive ? 'Ongoing' : 'Ended';

    return (
        <span className={badgeClass}>
            {badgeText}
        </span>
    );
}
