// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {
    isFavoriteItem,
    telemetryEventForPlaybookRun,
} from 'src/client';
import {useRunMembership, useUpdateRun} from 'src/graphql/hooks';
import ConfirmModal from 'src/components/widgets/confirmation_modal';
import {PlaybookRunEventTarget} from 'src/types/telemetry';
import {ToastType, useToaster} from 'src/components/backstage/toast_banner';
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

export const useParticipateInRun = (playbookRunId: string) => {
    const {formatMessage} = useIntl();
    const currentUserId = useSelector(getCurrentUserId);
    const {addToRun} = useRunMembership(playbookRunId, [currentUserId]);
    const addToast = useToaster().add;
    const [showParticipateConfirm, setShowParticipateConfirm] = useState(false);
    const onConfirmParticipate = async () => {
        addToRun()
            .then(() => addToast(formatMessage({defaultMessage: 'You\'ve joined this run.'}), ToastType.Success))
            .catch(() => addToast(formatMessage({defaultMessage: 'It wasn\'t possible to join the run'}), ToastType.Failure));
        telemetryEventForPlaybookRun(playbookRunId, PlaybookRunEventTarget.GetInvolvedJoin);
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
            telemetryEventForPlaybookRun(playbookRunId, PlaybookRunEventTarget.RequestUpdateClick);
        },
    };
};
