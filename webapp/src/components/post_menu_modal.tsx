// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {useAppDispatch, useAppSelector} from 'src/hooks/redux';

import {hidePostMenuModal} from 'src/actions';

import {isPostMenuModalVisible} from 'src/selectors';

import UpgradeModal from 'src/components/backstage/upgrade_modal';

import {AdminNotificationType} from 'src/constants';

const PostMenuModal = () => {
    const dispatch = useAppDispatch();
    const show = useAppSelector(isPostMenuModalVisible);

    return (
        <UpgradeModal
            messageType={AdminNotificationType.MESSAGE_TO_TIMELINE}
            show={show}
            onHide={() => dispatch(hidePostMenuModal())}
        />
    );
};

export default PostMenuModal;
