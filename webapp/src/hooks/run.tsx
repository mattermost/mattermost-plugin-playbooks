// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {useUpdateEffect} from 'react-use';

import {
    isFavoriteItem,
    telemetryEvent,
} from 'src/client';
import {useManageRunMembership, useUpdateRun} from 'src/graphql/hooks';
import ConfirmModal from 'src/components/widgets/confirmation_modal';
import {PlaybookRunEventTarget} from 'src/types/telemetry';
import {useToaster} from 'src/components/backstage/toast_banner';
import {ToastStyle} from 'src/components/backstage/toast';
import {CategoryItemType} from 'src/types/category';

export const useFavoriteRun = (teamID: string, runID: string): [boolean, () => void] => {
    const [isFavoriteRun, setIsFavoriteRun] = useState(false);
    const updateRun = useUpdateRun(runID);

    useEffect(() => {
        isFavoriteItem(teamID, runID, CategoryItemType.RunItemType)
            .then(setIsFavoriteRun)
            .catch(() => setIsFavoriteRun(false));
    }, [teamID, runID]);

    const toggleFavorite = () => {
        if (isFavoriteRun) {
            updateRun({isFavorite: false});
            setIsFavoriteRun(false);
            return;
        }
        updateRun({isFavorite: true});
        setIsFavoriteRun(true);
    };
    return [isFavoriteRun, toggleFavorite];
};

export const useParticipateInRun = (playbookRunId: string, from: 'channel_rhs'|'run_details') => {
    const {formatMessage} = useIntl();
    const currentUserId = useSelector(getCurrentUserId);
    const {addToRun} = useManageRunMembership(playbookRunId);
    const addToast = useToaster().add;
    const [showParticipateConfirm, setShowParticipateConfirm] = useState(false);
    const onConfirmParticipate = async () => {
        addToRun([currentUserId])
            .then(() => addToast({
                content: formatMessage({defaultMessage: 'You\'ve joined this run.'}),
                toastStyle: ToastStyle.Success,
            }))
            .catch(() => addToast({
                content: formatMessage({defaultMessage: 'It wasn\'t possible to join the run'}),
                toastStyle: ToastStyle.Failure,
            }));
        telemetryEvent(PlaybookRunEventTarget.Participate, {playbookrun_id: playbookRunId, from, trigger: 'participate', count: '1'});
    };
    const ParticipateConfirmModal = (
        <ConfirmModal
            show={showParticipateConfirm}
            title={formatMessage({defaultMessage: 'Participate in the run'})}
            message={formatMessage({defaultMessage: 'Become a participant of the run. As a participant, you can post status updates, assign and complete tasks, and perform retrospectives.'})}
            confirmButtonText={formatMessage({defaultMessage: 'Confirm'})}
            onConfirm={() => {
                onConfirmParticipate();
                setShowParticipateConfirm(false);
            }}
            onCancel={() => setShowParticipateConfirm(false)}
        />
    );
    return {
        ParticipateConfirmModal,
        showParticipateConfirm: () => {
            setShowParticipateConfirm(true);
        },
    };
};

export const useRunFollowers = (metadataFollowers: string[]) => {
    const currentUserId = useSelector(getCurrentUserId);
    const [followers, setFollowers] = useState(metadataFollowers);
    const [isFollowing, setIsFollowing] = useState(followers.includes(currentUserId));

    useUpdateEffect(() => {
        setFollowers(metadataFollowers);
    }, [currentUserId, JSON.stringify(metadataFollowers)]);

    useUpdateEffect(() => {
        setIsFollowing(followers.includes(currentUserId));
    }, [currentUserId, JSON.stringify(followers)]);

    return {isFollowing, followers, setFollowers};
};
