// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    Children,
    ReactNode,
    cloneElement,
    isValidElement,
} from 'react';

export const appendTo = (content: JSX.Element, item: ReactNode, atIndex = 0): ReactNode => {
    if (!item) {
        return content;
    }

    return Children.map(content, (child: ReactNode, index) => {
        if (isValidElement(child) && index === atIndex) {
            return cloneElement(child, child.props, <>{child.props.children}{item}</>);
        }

        return child;
    });
};
