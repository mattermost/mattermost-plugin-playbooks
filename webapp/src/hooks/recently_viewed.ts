import {useEffect} from 'react';

import {Playbook} from 'src/types/playbook';
import {PlaybookRun} from 'src/types/playbook_run';

export const usePlaybookIsRecentlyViewed = (playbook?: Playbook) => {
    useEffect(() => {
        if (playbook) {
            let recentlyViewedPlaybooks;
            try {
                recentlyViewedPlaybooks = JSON.parse(localStorage.getItem('recently-viewed-playbooks'));
            } catch (e) {
            }

            if (!Array.isArray(recentlyViewedPlaybooks)) {
                recentlyViewedPlaybooks = [];
            }

            recentlyViewedPlaybooks = [
                {id: playbook.id, title: playbook.title, team_id: playbook.team_id, public: playbook.public},
                ...recentlyViewedPlaybooks.filter((p) => p.id !== playbook.id),
            ].slice(0, 10);

            localStorage.setItem('recently-viewed-playbooks', JSON.stringify(recentlyViewedPlaybooks));
        }
    }, [playbook?.id]);
};

export const useRunIsRecentlyViewed = (playbookRun?: PlaybookRun) => {
    useEffect(() => {
        if (playbookRun) {
            let recentlyViewedRuns;
            try {
                recentlyViewedRuns = JSON.parse(localStorage.getItem('recently-viewed-runs'));
            } catch (e) {
            }

            if (!Array.isArray(recentlyViewedRuns)) {
                recentlyViewedRuns = [];
            }

            recentlyViewedRuns = [
                {id: playbookRun.id, name: playbookRun.name, team_id: playbookRun.team_id},
                ...recentlyViewedRuns.filter((r) => r.id !== playbookRun.id),
            ].slice(0, 10);

            localStorage.setItem('recently-viewed-runs', JSON.stringify(recentlyViewedRuns));
        }
    }, [playbookRun?.id]);
};
